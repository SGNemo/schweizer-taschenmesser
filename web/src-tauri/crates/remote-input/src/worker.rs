//! The worker thread: commands in through a bounded channel, the state out through a cache.

use crate::system::{self, System};
use crate::{Command, State};
use std::sync::mpsc::{self, RecvTimeoutError, SyncSender, TrySendError};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

/// Commands waiting for the worker; one more is dropped, never waited for.
const QUEUE: usize = 32;
/// A reading older than this is refreshed before it is handed out.
pub const STALE: Duration = Duration::from_secs(2);
/// The longest a caller waits for that refresh; then it gets what is there.
pub const FRESH_WAIT: Duration = Duration::from_millis(150);

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
    refreshed: Condvar,
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

    /// A worker over a given system (tests). `make` runs on the worker thread.
    pub fn with<F>(make: F) -> Worker
    where
        F: FnOnce() -> Option<Box<dyn System>> + Send + 'static,
    {
        let cache = Arc::new(Cache {
            reading: Mutex::new(Reading {
                state: State::UNKNOWN,
                at: None,
            }),
            refreshed: Condvar::new(),
        });
        let (tx, rx) = mpsc::sync_channel::<Message>(QUEUE);
        let shared = cache.clone();
        let spawned = std::thread::Builder::new()
            .name("remote-input".into())
            .spawn(move || {
                let Some(mut sys) = make() else {
                    return;
                };
                let store = |sys: &mut dyn System| {
                    let state = system::read(sys);
                    if let Ok(mut r) = shared.reading.lock() {
                        *r = Reading {
                            state,
                            at: Some(Instant::now()),
                        };
                    }
                    shared.refreshed.notify_all();
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
        Worker {
            tx: spawned.is_ok().then_some(tx),
            cache,
        }
    }

    fn without() -> Worker {
        Worker {
            tx: None,
            cache: Arc::new(Cache {
                reading: Mutex::new(Reading {
                    state: State::UNKNOWN,
                    at: None,
                }),
                refreshed: Condvar::new(),
            }),
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

    /// The last reading. Asks the worker for a new one each time (so readers that keep asking see
    /// a fresh state, and nobody asking costs nothing); waits for it – at most [`FRESH_WAIT`] –
    /// only when what is there is older than [`STALE`].
    pub fn state(&self) -> State {
        let Some(tx) = &self.tx else {
            return State::UNKNOWN;
        };
        let asked = match tx.try_send(Message::Refresh) {
            Ok(()) | Err(TrySendError::Full(_)) => true,
            Err(TrySendError::Disconnected(_)) => false,
        };
        let Ok(reading) = self.cache.reading.lock() else {
            return State::UNKNOWN;
        };
        let stale = |r: &Reading| r.at.map_or(true, |at| at.elapsed() > STALE);
        if !asked || !stale(&reading) {
            return reading.state;
        }
        match self
            .cache
            .refreshed
            .wait_timeout_while(reading, FRESH_WAIT, |r| stale(r))
        {
            // still stale after the wait: what cannot be told right now is treated as unknown
            Ok((r, _)) if stale(&r) => State::UNKNOWN,
            Ok((r, _)) => r.state,
            Err(_) => State::UNKNOWN,
        }
    }
}
