//! The app side: accepts connections from the native host, forwards each request to the app
//! (TypeScript decides what it means), and writes the reply back.
//!
//! Strict lockstep per connection. Bodies are never logged. Nothing is stored.

use crate::frame::{read_frame, write_frame, MAX_MESSAGE};
use crate::host::error_reply;
use crate::ipc::{connect, Endpoint, Listener, Stream};
use std::collections::HashMap;
use std::io;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

/// How long the app may take to answer before the host gets an `internal` error.
pub const RESPONSE_TIMEOUT: Duration = Duration::from_secs(30);
/// More simultaneous hosts than this are dropped (a browser runs one per profile and extension).
pub const MAX_CONNECTIONS: usize = 8;

/// One request on its way to the app.
pub struct Forwarded {
    pub id: u64,
    /// The request JSON, already stamped with the browser-reported origin by the host.
    pub body: String,
}

type Forward = dyn Fn(Forwarded) -> bool + Send + Sync;

struct Shared {
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, mpsc::Sender<Vec<u8>>>>,
    stopped: AtomicBool,
    connections: AtomicUsize,
    forward: Box<Forward>,
}

/// Cheap handle the app uses to answer a forwarded request from any thread.
#[derive(Clone)]
pub struct Responder(Arc<Shared>);

impl Responder {
    /// False when the request is unknown (answered already, timed out, or the host went away).
    pub fn respond(&self, id: u64, body: String) -> bool {
        let sender = self.0.pending.lock().ok().and_then(|mut p| p.remove(&id));
        sender.is_some_and(|tx| tx.send(body.into_bytes()).is_ok())
    }
}

pub struct Server {
    shared: Arc<Shared>,
    endpoint: Endpoint,
    thread: Option<JoinHandle<()>>,
}

impl Server {
    /// Binds the per-user channel and starts accepting. `forward` returns false when the app
    /// cannot take the request (the host then gets `internal`).
    pub fn start(
        endpoint: Endpoint,
        forward: impl Fn(Forwarded) -> bool + Send + Sync + 'static,
    ) -> io::Result<Server> {
        let listener = Listener::bind(&endpoint)?;
        let shared = Arc::new(Shared {
            next_id: AtomicU64::new(1),
            pending: Mutex::new(HashMap::new()),
            stopped: AtomicBool::new(false),
            connections: AtomicUsize::new(0),
            forward: Box::new(forward),
        });
        let accept_shared = Arc::clone(&shared);
        let thread = std::thread::Builder::new()
            .name("vault-bridge".into())
            .spawn(move || accept_loop(listener, accept_shared))?;
        Ok(Server {
            shared,
            endpoint,
            thread: Some(thread),
        })
    }

    pub fn responder(&self) -> Responder {
        Responder(Arc::clone(&self.shared))
    }

    /// Stops accepting and answers nothing further. Idle connections end with their host.
    pub fn stop(&mut self) {
        self.shared.stopped.store(true, Ordering::SeqCst);
        // Wake the blocked accept with a throw-away connection.
        let _ = connect(&self.endpoint);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
        if let Ok(mut pending) = self.shared.pending.lock() {
            pending.clear(); // waiting connections get their timeout error at once
        }
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        self.stop();
    }
}

fn accept_loop(listener: Listener, shared: Arc<Shared>) {
    while !shared.stopped.load(Ordering::SeqCst) {
        let Ok(stream) = listener.accept() else {
            if shared.stopped.load(Ordering::SeqCst) {
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
            continue;
        };
        if shared.stopped.load(Ordering::SeqCst) {
            break;
        }
        if shared.connections.fetch_add(1, Ordering::SeqCst) >= MAX_CONNECTIONS {
            shared.connections.fetch_sub(1, Ordering::SeqCst);
            continue; // dropped: closes the connection
        }
        let conn = Arc::clone(&shared);
        let spawned = std::thread::Builder::new()
            .name("vault-bridge-conn".into())
            .spawn(move || {
                let _ = serve(stream, &conn);
                conn.connections.fetch_sub(1, Ordering::SeqCst);
            });
        if spawned.is_err() {
            shared.connections.fetch_sub(1, Ordering::SeqCst);
        }
    }
}

fn request_id(body: &str) -> String {
    serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|v| v.get("id").and_then(|i| i.as_str().map(str::to_owned)))
        .unwrap_or_default()
}

fn serve(mut stream: Stream, shared: &Shared) -> io::Result<()> {
    while let Some(frame) = read_frame(&mut stream, MAX_MESSAGE)? {
        if shared.stopped.load(Ordering::SeqCst) {
            break;
        }
        let Ok(body) = String::from_utf8(frame) else {
            write_frame(&mut stream, &error_reply("", "bad-request"), MAX_MESSAGE)?;
            continue;
        };
        let id = shared.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = mpsc::channel();
        if let Ok(mut pending) = shared.pending.lock() {
            pending.insert(id, tx);
        }
        let request = request_id(&body);
        let reply = if (shared.forward)(Forwarded { id, body }) {
            rx.recv_timeout(RESPONSE_TIMEOUT).ok()
        } else {
            None
        };
        if reply.is_none() {
            if let Ok(mut pending) = shared.pending.lock() {
                pending.remove(&id);
            }
        }
        write_frame(
            &mut stream,
            &reply.unwrap_or_else(|| error_reply(&request, "internal")),
            MAX_MESSAGE,
        )?;
    }
    Ok(())
}
