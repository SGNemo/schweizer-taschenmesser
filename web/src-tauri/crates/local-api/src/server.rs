//! Accept loop, per-request checks and the bridge to the app.

use std::collections::HashMap;
use std::io::{self, ErrorKind, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex, RwLock};
use std::thread::JoinHandle;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::auth::{authenticate, Auth, TokenEntry};
use crate::http::{read_request, Request};
use crate::limiter::RateLimiter;

const FAILURES_KEY: &str = "auth-failures";
const MAX_IDEMPOTENCY_KEY: usize = 200;

#[derive(Clone, Debug)]
pub struct Limits {
    pub max_header_bytes: usize,
    pub max_body_bytes: usize,
    pub read_timeout: Duration,
    /// Total time a client gets to deliver its whole request (a slow trickle cannot hold a slot).
    pub request_deadline: Duration,
    /// How long the app may take to answer.
    pub response_timeout: Duration,
    pub max_connections: usize,
    pub requests_per_minute: u32,
    pub auth_failures_per_minute: u32,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            max_header_bytes: 16 * 1024,
            max_body_bytes: 1024 * 1024,
            read_timeout: Duration::from_secs(5),
            request_deadline: Duration::from_secs(15),
            response_timeout: Duration::from_secs(30),
            max_connections: 8,
            requests_per_minute: 120,
            auth_failures_per_minute: 20,
        }
    }
}

/// An authenticated request as the app receives it. No token, no other headers.
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Forwarded {
    pub id: u64,
    pub token_id: String,
    pub method: String,
    pub path: String,
    pub query: String,
    pub idempotency_key: Option<String>,
    pub body: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Reply {
    pub status: u16,
    /// JSON text.
    pub body: String,
}

type ForwardFn = Box<dyn Fn(Forwarded) -> bool + Send + Sync>;

struct Shared {
    port: u16,
    limits: Limits,
    stop: AtomicBool,
    tokens: RwLock<Vec<TokenEntry>>,
    pending: Mutex<HashMap<u64, mpsc::Sender<Reply>>>,
    next_id: AtomicU64,
    active: AtomicUsize,
    requests: Mutex<RateLimiter>,
    failures: Mutex<RateLimiter>,
    forward: ForwardFn,
}

pub struct Server {
    shared: Arc<Shared>,
    accept: Option<JoinHandle<()>>,
    addr: SocketAddr,
}

/// The only address the server ever binds: loopback. There is deliberately no setting for it.
pub fn bind_addr(port: u16) -> SocketAddr {
    SocketAddr::from((Ipv4Addr::LOCALHOST, port))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

impl Server {
    /// Binds `127.0.0.1:<port>` (0 = any free port, for tests) and starts accepting.
    pub fn start(
        port: u16,
        tokens: Vec<TokenEntry>,
        limits: Limits,
        forward: impl Fn(Forwarded) -> bool + Send + Sync + 'static,
    ) -> io::Result<Server> {
        let listener = TcpListener::bind(bind_addr(port))?;
        let addr = listener.local_addr()?;
        if !addr.ip().is_loopback() {
            return Err(io::Error::other("not loopback"));
        }
        listener.set_nonblocking(true)?;
        let shared = Arc::new(Shared {
            port: addr.port(),
            requests: Mutex::new(RateLimiter::new(
                limits.requests_per_minute,
                Duration::from_secs(60),
            )),
            failures: Mutex::new(RateLimiter::new(
                limits.auth_failures_per_minute,
                Duration::from_secs(60),
            )),
            limits,
            stop: AtomicBool::new(false),
            tokens: RwLock::new(tokens),
            pending: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
            active: AtomicUsize::new(0),
            forward: Box::new(forward),
        });
        let accept_shared = Arc::clone(&shared);
        let accept = std::thread::Builder::new()
            .name("local-api".into())
            .spawn(move || accept_loop(listener, accept_shared))?;
        Ok(Server {
            shared,
            accept: Some(accept),
            addr,
        })
    }

    pub fn local_addr(&self) -> SocketAddr {
        self.addr
    }

    /// Replaces the known tokens (new, revoked or expired ones take effect immediately).
    pub fn set_tokens(&self, tokens: Vec<TokenEntry>) {
        if let Ok(mut guard) = self.shared.tokens.write() {
            *guard = tokens;
        }
    }

    /// The app's answer to a forwarded request; false when it is unknown or timed out.
    pub fn respond(&self, id: u64, reply: Reply) -> bool {
        let sender = self
            .shared
            .pending
            .lock()
            .ok()
            .and_then(|mut p| p.remove(&id));
        sender.is_some_and(|s| s.send(reply).is_ok())
    }

    pub fn stop(mut self) {
        self.shutdown();
    }

    fn shutdown(&mut self) {
        self.shared.stop.store(true, Ordering::SeqCst);
        // Waiting requests get "unavailable" instead of hanging until their timeout.
        if let Ok(mut pending) = self.shared.pending.lock() {
            pending.clear();
        }
        if let Some(handle) = self.accept.take() {
            let _ = handle.join();
        }
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn accept_loop(listener: TcpListener, shared: Arc<Shared>) {
    while !shared.stop.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((stream, peer)) => {
                if !peer.ip().is_loopback() {
                    continue;
                }
                if stream.set_nonblocking(false).is_err() {
                    continue;
                }
                let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));
                if shared.active.load(Ordering::SeqCst) >= shared.limits.max_connections {
                    let mut stream = stream;
                    let _ = write_error(&mut stream, 503, "busy");
                    continue;
                }
                shared.active.fetch_add(1, Ordering::SeqCst);
                let conn_shared = Arc::clone(&shared);
                let spawned = std::thread::Builder::new()
                    .name("local-api-conn".into())
                    .spawn(move || {
                        let mut stream = stream;
                        handle_connection(&mut stream, &conn_shared);
                        conn_shared.active.fetch_sub(1, Ordering::SeqCst);
                    });
                if spawned.is_err() {
                    shared.active.fetch_sub(1, Ordering::SeqCst);
                }
            }
            Err(e) if e.kind() == ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(_) => std::thread::sleep(Duration::from_millis(50)),
        }
    }
}

fn handle_connection(stream: &mut TcpStream, shared: &Shared) {
    let mut timed = Deadline {
        stream: &mut *stream,
        until: Instant::now() + shared.limits.request_deadline,
        per_read: shared.limits.read_timeout,
    };
    let request = match read_request(
        &mut timed,
        shared.limits.max_header_bytes,
        shared.limits.max_body_bytes,
    ) {
        Ok(r) => r,
        Err(e) => {
            if let Some((status, code)) = e.response() {
                let _ = write_error(stream, status, code);
            }
            return;
        }
    };
    let reply = process(&request, shared);
    let _ = write_response(stream, &reply);
}

/// Reads with a per-read timeout that never extends past the request's overall deadline.
struct Deadline<'a> {
    stream: &'a mut TcpStream,
    until: Instant,
    per_read: Duration,
}

impl io::Read for Deadline<'_> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let left = self.until.saturating_duration_since(Instant::now());
        if left.is_zero() {
            return Err(io::Error::new(ErrorKind::TimedOut, "request deadline"));
        }
        self.stream
            .set_read_timeout(Some(left.min(self.per_read)))?;
        self.stream.read(buf)
    }
}

impl io::Write for Deadline<'_> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.stream.write(buf)
    }
    fn flush(&mut self) -> io::Result<()> {
        self.stream.flush()
    }
}

fn error(status: u16, code: &str) -> Reply {
    Reply {
        status,
        body: format!("{{\"error\":\"{code}\"}}"),
    }
}

/// Every check that must pass before the app sees a request, then the round trip to the app.
fn process(req: &Request, shared: &Shared) -> Reply {
    // DNS rebinding: only our own loopback names with the right port.
    let host_ok = match req.header("host") {
        Ok(Some(host)) => {
            host == format!("127.0.0.1:{}", shared.port)
                || host == format!("localhost:{}", shared.port)
        }
        _ => false,
    };
    if !host_ok {
        return error(421, "bad-host");
    }
    // Requests from a web page carry Origin / Sec-Fetch-Site; no CORS is offered at all.
    let from_browser = req.has_header("origin")
        || req
            .header("sec-fetch-site")
            .map(|v| v.is_some_and(|v| v != "none"))
            .unwrap_or(true);
    if from_browser {
        return error(403, "origin-not-allowed");
    }
    if !matches!(req.method.as_str(), "GET" | "POST" | "DELETE") {
        return error(405, "method-not-allowed");
    }
    if !req.path.starts_with("/v1/") {
        return error(404, "not-found");
    }

    let now = Instant::now();
    if shared
        .failures
        .lock()
        .map(|mut f| f.exhausted(FAILURES_KEY, now))
        .unwrap_or(true)
    {
        return error(429, "too-many-requests");
    }
    let authorization = match req.header("authorization") {
        Ok(v) => v,
        Err(()) => return error(400, "bad-request"),
    };
    let auth = shared
        .tokens
        .read()
        .map(|tokens| authenticate(authorization, &tokens, now_ms()))
        .unwrap_or(Auth::Invalid);
    let token_id = match auth {
        Auth::Ok(id) => id,
        other => {
            if let Ok(mut f) = shared.failures.lock() {
                f.hit(FAILURES_KEY, now);
            }
            let code = match other {
                Auth::Missing => "token-missing",
                Auth::Expired => "token-expired",
                _ => "token-invalid",
            };
            return error(401, code);
        }
    };
    if !shared
        .requests
        .lock()
        .map(|mut r| r.hit(&token_id, now))
        .unwrap_or(false)
    {
        return error(429, "too-many-requests");
    }

    let body = if req.method == "POST" {
        let json = matches!(req.header("content-type"), Ok(Some(ct))
            if ct.split(';').next().is_some_and(|m| m.trim().eq_ignore_ascii_case("application/json")));
        if !json {
            return error(415, "json-required");
        }
        match String::from_utf8(req.body.clone()) {
            Ok(text) => Some(text),
            Err(_) => return error(400, "bad-request"),
        }
    } else {
        None
    };
    let idempotency_key = match req.header("idempotency-key") {
        Err(()) => return error(400, "bad-request"),
        Ok(None) => None,
        Ok(Some(k))
            if !k.is_empty()
                && k.len() <= MAX_IDEMPOTENCY_KEY
                && k.bytes().all(|b| b.is_ascii_graphic()) =>
        {
            Some(k.to_owned())
        }
        Ok(Some(_)) => return error(400, "bad-idempotency-key"),
    };

    let id = shared.next_id.fetch_add(1, Ordering::SeqCst);
    let (tx, rx) = mpsc::channel();
    match shared.pending.lock() {
        Ok(mut pending) => {
            pending.insert(id, tx);
        }
        Err(_) => return error(503, "app-not-ready"),
    }
    let forwarded = Forwarded {
        id,
        token_id,
        method: req.method.clone(),
        path: req.path.clone(),
        query: req.query.clone(),
        idempotency_key,
        body,
    };
    let delivered = (shared.forward)(forwarded);
    let reply = if delivered {
        match rx.recv_timeout(shared.limits.response_timeout) {
            Ok(reply) if (200..=599).contains(&reply.status) => reply,
            Ok(_) => error(500, "internal"),
            Err(mpsc::RecvTimeoutError::Timeout) => error(504, "timeout"),
            Err(mpsc::RecvTimeoutError::Disconnected) => error(503, "app-not-ready"),
        }
    } else {
        error(503, "app-not-ready")
    };
    if let Ok(mut pending) = shared.pending.lock() {
        pending.remove(&id);
    }
    reply
}

fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        201 => "Created",
        202 => "Accepted",
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        408 => "Request Timeout",
        409 => "Conflict",
        411 => "Length Required",
        413 => "Content Too Large",
        415 => "Unsupported Media Type",
        421 => "Misdirected Request",
        422 => "Unprocessable Content",
        429 => "Too Many Requests",
        431 => "Request Header Fields Too Large",
        501 => "Not Implemented",
        503 => "Service Unavailable",
        504 => "Gateway Timeout",
        _ => "Error",
    }
}

fn write_response(stream: &mut TcpStream, reply: &Reply) -> io::Result<()> {
    let mut head = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n",
        reply.status,
        reason(reply.status),
        reply.body.len()
    );
    if reply.status == 401 {
        head.push_str("WWW-Authenticate: Bearer\r\n");
    }
    if reply.status == 429 || reply.status == 503 {
        head.push_str("Retry-After: 60\r\n");
    }
    head.push_str("\r\n");
    stream.write_all(head.as_bytes())?;
    stream.write_all(reply.body.as_bytes())?;
    stream.flush()?;
    let _ = stream.shutdown(std::net::Shutdown::Write);
    Ok(())
}

fn write_error(stream: &mut TcpStream, status: u16, code: &str) -> io::Result<()> {
    write_response(stream, &error(status, code))
}
