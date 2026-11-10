//! The worker thread: commands in through a bounded channel, the state out through a cache.

use crate::system::{self, System};
use crate::{Command, State};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, SyncSender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Commands waiting for the worker; one more is dropped, never waited for.
const QUEUE: usize = 32;
/// A reading older than this is not handed out any more: the caller gets "unknown" and the
/// fresh reading with its next question.
pub const STALE: Duration = Duration::from_secs(2);
/// How long starting the worker waits to hear whether the system could be set up at all.
const READY_WAIT: Duration = Duration::from_secs(3);

enum Message {
    Do(Command),
    Refresh,
}

struct Reading {
    state: State,
    /// When it was read; `None` before the first reading.
    at: Option<Instant>,
}

struct Cache {
    reading: Mutex<Reading>,
    /// A refresh is already waiting in the queue: askers do not add another one, so reading the
    /// state – however often – takes at most one place and never crowds out a command.
    refresh_wanted: AtomicBool,
}

impl Cache {
    fn new() -> Arc<Cache> {
        Arc::new(Cache {
            reading: Mutex::new(Reading {
                state: State::UNKNOWN,
                at: None,
            }),
            refresh_wanted: AtomicBool::new(false),
        })
    }
}

/// The handle the shell keeps. Cheap to clone; the thread ends when the last handle is dropped.
#[derive(Clone)]
pub struct Worker {
    tx: Option<SyncSender<Message>>,
    cache: Arc<Cache>,
}

impl Worker {
    /// Starts the worker for this PC. Where the PC cannot be controlled, no thread is started.
    pub fn start() -> Worker {
        if !system::SUPPORTED {
            return Worker::without();
        }
        Worker::with(system::native)
    }

    /// A worker over a given system (tests). `make` runs on the worker thread; the worker is
    /// supported only if it returned a system (waited for briefly, once, here).
    pub fn with<F>(make: F) -> Worker
    where
        F: FnOnce() -> Option<Box<dyn System>> + Send + 'static,
    {
        let cache = Cache::new();
        let (tx, rx) = mpsc::sync_channel::<Message>(QUEUE);
        let (ready_tx, ready_rx) = mpsc::sync_channel::<bool>(1);
        let shared = cache.clone();
        let spawned = std::thread::Builder::new()
            .name("remote-input".into())
            .spawn(move || {
                let made = make();
                let _ = ready_tx.send(made.is_some());
                let Some(mut sys) = made else {
                    return;
                };
                let store = |sys: &mut dyn System| {
                    // cleared first: a question that comes while this reading is taken asks again
                    shared.refresh_wanted.store(false, Ordering::SeqCst);
                    let state = system::read(sys);
                    if let Ok(mut r) = shared.reading.lock() {
                        *r = Reading {
                            state,
                            at: Some(Instant::now()),
                        };
                    }
                };
                store(&mut *sys);
                loop {
                    // no polling: the thread sleeps until somebody wants something
                    match rx.recv_timeout(Duration::from_secs(3600)) {
                        Ok(Message::Do(command)) => {
                            system::apply(&mut *sys, command);
                            store(&mut *sys);
                        }
                        Ok(Message::Refresh) => store(&mut *sys),
                        Err(RecvTimeoutError::Timeout) => {}
                        Err(RecvTimeoutError::Disconnected) => return,
                    }
                }
            });
        // no thread, no system, or no word from it in time: not supported (dropping `tx` ends
        // a thread that comes up late)
        let ready = spawned.is_ok() && ready_rx.recv_timeout(READY_WAIT).unwrap_or(false);
        Worker {
            tx: ready.then_some(tx),
            cache,
        }
    }

    fn without() -> Worker {
        Worker {
            tx: None,
            cache: Cache::new(),
        }
    }

    /// Whether this PC can be controlled at all.
    pub fn supported(&self) -> bool {
        self.tx.is_some()
    }

    /// Hands the command to the worker and returns at once. `false` = not supported, or the
    /// queue is full and the command was dropped.
    pub fn send(&self, command: Command) -> bool {
        match &self.tx {
            Some(tx) => tx.try_send(Message::Do(command)).is_ok(),
            None => false,
        }
    }

    /// The last reading, at once. Asks the worker for a new one (at most one such request waits
    /// at a time), so readers that keep asking see a fresh state and nobody asking costs nothing.
    /// A reading older than [`STALE`] is not handed out: the caller gets "unknown" now and the
    /// fresh one with its next question.
    pub fn state(&self) -> State {
        let Some(tx) = &self.tx else {
            return State::UNKNOWN;
        };
        if !self.cache.refresh_wanted.swap(true, Ordering::SeqCst)
            && tx.try_send(Message::Refresh).is_err()
        {
            // a full queue: every command in it ends in a reading anyway; ask again next time
            self.cache.refresh_wanted.store(false, Ordering::SeqCst);
        }
        match self.cache.reading.lock() {
            Ok(r) if r.at.is_some_and(|at| at.elapsed() <= STALE) => r.state,
            _ => State::UNKNOWN,
        }
    }
}
