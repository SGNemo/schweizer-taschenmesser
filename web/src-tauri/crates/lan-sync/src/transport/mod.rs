//! The only module of the crate that opens sockets (`tests/rules.rs` enforces that).
//!
//! * Listens only on the exact addresses it is given and refuses any address the policy does not
//!   allow (never `0.0.0.0`, loopback or a public address). The caller passes the addresses of
//!   `netpolicy::decide`; on a network change the whole [`Server`] is stopped and a new one built.
//! * Frames on the stream: `u16` big-endian length, then the Noise message. A frame longer than
//!   the connection's current cap is refused before it is buffered; a frame that is not complete
//!   within [`ServerConfig::frame_deadline`] ends the connection (slow-loris), as does silence
//!   longer than the idle limit.
//! * Caps: connections in total and per peer address (admission only limits *first messages*).
//! * Threads (`std::thread`, like `local-api`), no async runtime. Nothing is logged; peer
//!   addresses and frames are never formatted.
//! * A pairing connection waits for the sealed data-key frame that `PairingHost::confirm` returns:
//!   the shell hands it over with [`Server::deliver`], keyed by the attempt id of the connection.

use crate::hub::netpolicy::{is_allowed_hub_addr, Bind};
use crate::hub::router::{Connection, Opened, Outcome, Router};
use crate::noise::frame::PRE_HANDSHAKE_CAP;
use std::collections::HashMap;
use std::io::{ErrorKind, Read, Write};
use std::net::{IpAddr, SocketAddr, SocketAddrV4, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy)]
pub struct ServerConfig {
    pub max_connections: usize,
    pub max_per_ip: usize,
    /// A first message must arrive complete within this.
    pub handshake_timeout: Duration,
    /// Once a frame has started it must be complete within this.
    pub frame_deadline: Duration,
    /// A session without any frame for this long is closed.
    pub idle_timeout: Duration,
    /// A pairing connection lives at most this long (the window's hard cap is 240 s).
    pub pairing_lifetime: Duration,
    /// Poll interval: how quickly stop, revoke and delivery are noticed.
    pub tick: Duration,
}

impl Default for ServerConfig {
    fn default() -> Self {
        ServerConfig {
            max_connections: 32,
            max_per_ip: 4,
            handshake_timeout: Duration::from_secs(5),
            frame_deadline: Duration::from_secs(10),
            idle_timeout: Duration::from_secs(120),
            pairing_lifetime: Duration::from_secs(250),
            tick: Duration::from_millis(200),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServerError {
    /// An address the policy refuses (wildcard, loopback, public, IPv6 …): nothing was bound.
    ForbiddenAddress,
    NoAddress,
    Bind,
}

struct Shared {
    router: Arc<Router>,
    cfg: ServerConfig,
    stop: AtomicBool,
    started: Instant,
    counts: Mutex<Counts>,
    deliveries: Mutex<HashMap<u64, Sender<Vec<u8>>>>,
}

#[derive(Default)]
struct Counts {
    total: usize,
    per_ip: HashMap<IpAddr, usize>,
}

/// Releases a connection slot on drop.
struct Slot {
    shared: Arc<Shared>,
    ip: IpAddr,
}

impl Slot {
    fn take(shared: &Arc<Shared>, ip: IpAddr) -> Option<Slot> {
        let mut c = shared.counts.lock().ok()?;
        let mine = c.per_ip.get(&ip).copied().unwrap_or(0);
        if c.total >= shared.cfg.max_connections || mine >= shared.cfg.max_per_ip {
            return None;
        }
        c.total += 1;
        c.per_ip.insert(ip, mine + 1);
        Some(Slot {
            shared: shared.clone(),
            ip,
        })
    }
}

impl Drop for Slot {
    fn drop(&mut self) {
        if let Ok(mut c) = self.shared.counts.lock() {
            c.total = c.total.saturating_sub(1);
            if let Some(n) = c.per_ip.get_mut(&self.ip) {
                *n = n.saturating_sub(1);
                if *n == 0 {
                    c.per_ip.remove(&self.ip);
                }
            }
        }
    }
}

pub struct Server {
    shared: Arc<Shared>,
    addrs: Vec<SocketAddrV4>,
    accepters: Vec<JoinHandle<()>>,
}

impl Server {
    /// Binds every address of `binds` (all or nothing). `port` 0 picks a free port for the first
    /// address and uses the same one for the rest.
    pub fn start(
        binds: &[Bind],
        port: u16,
        router: Arc<Router>,
        cfg: ServerConfig,
    ) -> Result<Server, ServerError> {
        Self::start_with(binds, port, router, cfg, is_allowed_hub_addr)
    }

    /// Tests listen on loopback; there is no way to get here from production code.
    #[cfg(test)]
    pub(crate) fn start_for_tests(
        binds: &[Bind],
        router: Arc<Router>,
        cfg: ServerConfig,
    ) -> Result<Server, ServerError> {
        Self::start_with(binds, 0, router, cfg, |ip| {
            is_allowed_hub_addr(ip) || ip.is_loopback()
        })
    }

    fn start_with(
        binds: &[Bind],
        port: u16,
        router: Arc<Router>,
        cfg: ServerConfig,
        allowed: fn(IpAddr) -> bool,
    ) -> Result<Server, ServerError> {
        if binds.is_empty() {
            return Err(ServerError::NoAddress);
        }
        if binds.iter().any(|b| !allowed(IpAddr::V4(b.ip()))) {
            return Err(ServerError::ForbiddenAddress);
        }
        let mut listeners = Vec::new();
        let mut port = port;
        for b in binds {
            let l = TcpListener::bind(SocketAddrV4::new(b.ip(), port))
                .map_err(|_| ServerError::Bind)?;
            l.set_nonblocking(true).map_err(|_| ServerError::Bind)?;
            match l.local_addr() {
                Ok(SocketAddr::V4(a)) => {
                    port = a.port();
                    listeners.push((l, a));
                }
                _ => return Err(ServerError::Bind),
            }
        }
        let shared = Arc::new(Shared {
            router,
            cfg,
            stop: AtomicBool::new(false),
            started: Instant::now(),
            counts: Mutex::new(Counts::default()),
            deliveries: Mutex::new(HashMap::new()),
        });
        let addrs = listeners.iter().map(|(_, a)| *a).collect();
        let mut accepters = Vec::new();
        for (listener, _) in listeners {
            let sh = shared.clone();
            let h = std::thread::Builder::new()
                .name("lan-sync-accept".into())
                .spawn(move || accept_loop(listener, sh))
                .map_err(|_| ServerError::Bind)?;
            accepters.push(h);
        }
        Ok(Server {
            shared,
            addrs,
            accepters,
        })
    }

    /// Where the server listens (exactly the requested addresses).
    pub fn local_addrs(&self) -> &[SocketAddrV4] {
        &self.addrs
    }

    pub fn port(&self) -> u16 {
        self.addrs.first().map_or(0, SocketAddrV4::port)
    }

    pub fn open_connections(&self) -> usize {
        self.shared.counts.lock().map_or(0, |c| c.total)
    }

    /// Hands the sealed data-key frame of a confirmed pairing to the connection of `attempt`.
    pub fn deliver(&self, attempt: u64, wire: Vec<u8>) -> bool {
        self.shared
            .deliveries
            .lock()
            .ok()
            .and_then(|m| m.get(&attempt).map(|tx| tx.send(wire).is_ok()))
            .unwrap_or(false)
    }

    /// Closes the listeners and every connection; returns when all threads are gone (or after
    /// a short grace period for stragglers, which exit on their next tick).
    pub fn stop(mut self) {
        self.shutdown();
    }

    fn shutdown(&mut self) {
        self.shared.stop.store(true, Ordering::SeqCst);
        for h in self.accepters.drain(..) {
            let _ = h.join();
        }
        let until = Instant::now() + Duration::from_secs(2);
        while self.open_connections() > 0 && Instant::now() < until {
            std::thread::sleep(Duration::from_millis(20));
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
                let ip = peer.ip();
                // slots first: a flood from one address costs a thread only up to its cap
                let Some(slot) = Slot::take(&shared, ip) else {
                    continue; // dropped (closed) right here
                };
                let sh = shared.clone();
                let spawned = std::thread::Builder::new()
                    .name("lan-sync-conn".into())
                    .spawn(move || {
                        let _slot = slot;
                        serve(stream, ip, &sh);
                    });
                let _ = spawned; // on failure the closure (and the slot) is dropped
            }
            Err(e) if e.kind() == ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(25));
            }
            Err(_) => std::thread::sleep(Duration::from_millis(100)),
        }
    }
}

/// Incremental frame reader: survives read timeouts without losing bytes.
struct FrameReader {
    buf: Vec<u8>,
    started: Option<Instant>,
}

enum Polled {
    Frame(Vec<u8>),
    Nothing,
    Close,
}

impl FrameReader {
    fn new() -> Self {
        FrameReader {
            buf: Vec::new(),
            started: None,
        }
    }

    fn poll(&mut self, s: &mut TcpStream, cap: usize, deadline: Duration) -> Polled {
        loop {
            let want = match self.buf.len() {
                0 | 1 => 2 - self.buf.len(),
                n => {
                    let len = usize::from(u16::from_be_bytes([self.buf[0], self.buf[1]]));
                    if len == 0 || len > cap {
                        return Polled::Close;
                    }
                    (2 + len) - n
                }
            };
            if want == 0 {
                let frame = self.buf.split_off(2);
                self.buf.clear();
                self.started = None;
                return Polled::Frame(frame);
            }
            let mut chunk = [0u8; 4096];
            let take = want.min(chunk.len());
            match s.read(&mut chunk[..take]) {
                Ok(0) => return Polled::Close,
                Ok(n) => {
                    self.started.get_or_insert_with(Instant::now);
                    self.buf.extend_from_slice(&chunk[..n]);
                }
                Err(e) if matches!(e.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) => {
                    return match self.started {
                        Some(t) if t.elapsed() > deadline => Polled::Close,
                        _ => Polled::Nothing,
                    };
                }
                Err(e) if e.kind() == ErrorKind::Interrupted => {}
                Err(_) => return Polled::Close,
            }
        }
    }
}

fn write_frame(s: &mut TcpStream, wire: &[u8]) -> bool {
    let Ok(len) = u16::try_from(wire.len()) else {
        return false;
    };
    let mut out = Vec::with_capacity(2 + wire.len());
    out.extend_from_slice(&len.to_be_bytes());
    out.extend_from_slice(wire);
    s.write_all(&out).is_ok()
}

fn unix_now() -> (u64, u64) {
    let d = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    (
        d.as_secs(),
        u64::try_from(d.as_millis()).unwrap_or(u64::MAX),
    )
}

fn serve(mut stream: TcpStream, ip: IpAddr, sh: &Arc<Shared>) {
    let cfg = sh.cfg;
    if stream.set_nonblocking(false).is_err()
        || stream.set_read_timeout(Some(cfg.tick)).is_err()
        || stream.set_write_timeout(Some(cfg.frame_deadline)).is_err()
        || stream.set_nodelay(true).is_err()
    {
        return;
    }
    let mut reader = FrameReader::new();
    // 1. the first message, complete within the handshake timeout
    let began = Instant::now();
    let first = loop {
        if sh.stop.load(Ordering::SeqCst) || began.elapsed() > cfg.handshake_timeout {
            return;
        }
        match reader.poll(&mut stream, PRE_HANDSHAKE_CAP, cfg.handshake_timeout) {
            Polled::Frame(f) => break f,
            Polled::Nothing => {}
            Polled::Close => return,
        }
    };
    let now = sh.started.elapsed();
    let (m2, mut conn) = match sh.router.accept(ip, &first, now) {
        Opened::Drop(_) => return,
        Opened::Refuse(m2) => {
            let _ = write_frame(&mut stream, &m2);
            return;
        }
        Opened::Accept { m2, conn } => (m2, conn),
    };
    if !write_frame(&mut stream, &m2) {
        return;
    }
    // 2. the frames of this connection, routed to this connection's own state only
    let attempt = conn.pairing_attempt();
    let (tx, rx): (Sender<Vec<u8>>, Receiver<Vec<u8>>) = mpsc::channel();
    if let Some(a) = attempt {
        if let Ok(mut m) = sh.deliveries.lock() {
            m.insert(a, tx);
        }
    }
    drive(
        &mut stream,
        &mut reader,
        &mut conn,
        &rx,
        attempt.is_some(),
        sh,
    );
    if let Some(a) = attempt {
        if let Ok(mut m) = sh.deliveries.lock() {
            m.remove(&a);
        }
    }
}

fn drive(
    stream: &mut TcpStream,
    reader: &mut FrameReader,
    conn: &mut Connection,
    rx: &Receiver<Vec<u8>>,
    pairing: bool,
    sh: &Arc<Shared>,
) {
    let cfg = sh.cfg;
    let born = Instant::now();
    let mut last = Instant::now();
    loop {
        if sh.stop.load(Ordering::SeqCst) || conn.is_closed() {
            return;
        }
        if pairing {
            if born.elapsed() > cfg.pairing_lifetime {
                return;
            }
            match rx.try_recv() {
                Ok(wire) => {
                    // the key frame is the last thing a pairing connection ever carries
                    let _ = write_frame(stream, &wire);
                    return;
                }
                Err(TryRecvError::Empty) => {}
                Err(TryRecvError::Disconnected) => return,
            }
        } else if last.elapsed() > cfg.idle_timeout {
            return;
        }
        match reader.poll(stream, conn.frame_cap(), cfg.frame_deadline) {
            Polled::Frame(wire) => {
                last = Instant::now();
                let (unix_s, unix_ms) = unix_now();
                match conn.on_frame(&wire, unix_s, unix_ms) {
                    Outcome::Continue => {}
                    Outcome::Reply(w) => {
                        if !write_frame(stream, &w) {
                            return;
                        }
                    }
                    Outcome::Close => return,
                }
            }
            Polled::Nothing => {}
            Polled::Close => return,
        }
    }
}

#[cfg(test)]
mod tests;
