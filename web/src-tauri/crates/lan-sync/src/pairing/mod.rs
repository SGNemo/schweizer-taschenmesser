//! Pairing window (hub side): a state machine behind one mutex.
//!
//! ```text
//! Closed --open()--> Open{gen, secret, deadline = now + 120 s}
//! Open --m1 proves the CURRENT psk, key neither trusted nor revoked, CAS(state == Open && gen == ticket.gen)-->
//!      AwaitHello{attempt}
//! AwaitHello --hello ok--> AwaitConfirm{attempt, name, code}
//! AwaitHello --no hello in 10 s / bad hello--> Open{gen + 1, new secret}
//! AwaitConfirm --confirm(attempt, code) ok--> Paired --> Closed
//! AwaitConfirm --wrong code / wrong attempt id / timeout--> Open{gen + 1, new secret}, no retry
//! any --cancel()--> Closed
//! ```
//!
//! Rules that hold for every entry point:
//! * Time is evaluated lazily at the start of every call (`now >= deadline` means expired). `tick`
//!   only emits events and renews a lapsed window early. The clock is monotonic (`Instant`) and a
//!   clock that runs backwards is clamped.
//! * An expired open window keeps no secret: `begin_attempt` gives `None` and any ticket fails until
//!   the dialog renews the QR (`qr`/`tick`).
//! * `gen` only grows (never reused); overflow refuses to open.
//! * Confirm deadline = `min(burn + 120 s, window_open + 240 s)`; `window_open` is when the user
//!   opened the window or the attempt ended and a fresh one began, not a silent renewal.
//! * While an attempt runs there is no renewal and no new attempt.
//! * `confirm` re-checks the key, adds it to the trust list, reads the data key and seals it with the
//!   attempt's own transport; a failure at any step removes the entry again. It holds the state lock
//!   throughout (the only place with store I/O), so nothing else can interleave.
//! * Nothing here logs; secrets are `Zeroizing`.

pub mod qr;

use crate::noise::frame::{self, FrameError, TAG_DATA_KEY, TAG_HELLO};
use crate::noise::{Psk, PublicKey, Responder1, Sas, Transport};
use crate::trust::{Device, TrustError, TrustStore};
use std::fmt;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};
use subtle::ConstantTimeEq;
use zeroize::Zeroizing;

pub const WINDOW: Duration = Duration::from_secs(120);
pub const HELLO_WAIT: Duration = Duration::from_secs(10);
pub const CONFIRM_WAIT: Duration = Duration::from_secs(120);
pub const CONFIRM_HARD_CAP: Duration = Duration::from_secs(240);

/// Monotonic time source. Only differences matter.
pub trait Clock: Send + Sync {
    fn now(&self) -> Duration;
}

/// Production clock on `Instant`.
pub struct SystemClock {
    start: Instant,
}

impl SystemClock {
    pub fn new() -> Self {
        SystemClock {
            start: Instant::now(),
        }
    }
}

impl Default for SystemClock {
    fn default() -> Self {
        Self::new()
    }
}

impl Clock for SystemClock {
    fn now(&self) -> Duration {
        self.start.elapsed()
    }
}

/// Test clock moved by hand.
#[cfg(test)]
pub struct ManualClock(Mutex<Duration>);

#[cfg(test)]
impl ManualClock {
    pub fn new() -> Self {
        ManualClock(Mutex::new(Duration::from_secs(1000)))
    }
    pub fn advance(&self, d: Duration) {
        *self.0.lock().unwrap() += d;
    }
    pub fn set(&self, d: Duration) {
        *self.0.lock().unwrap() = d;
    }
}

#[cfg(test)]
impl Clock for ManualClock {
    fn now(&self) -> Duration {
        *self.0.lock().unwrap()
    }
}

/// The key every device of the hub shares for the E2E values (2b wires the real one).
pub struct DataKey {
    pub version: u32,
    pub key: Zeroizing<[u8; 32]>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DataKeyError;

pub trait DataKeyProvider: Send + Sync {
    fn current(&self) -> Result<DataKey, DataKeyError>;
}

/// Why an attempt ended without pairing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CancelReason {
    HelloTimeout,
    BadHello,
    ConfirmTimeout,
    WrongCode,
    WrongAttempt,
    Rejected,
}

#[derive(Clone, PartialEq, Eq)]
pub enum PairingEvent {
    Opened,
    Renewed,
    /// The open window lapsed without an attempt.
    Expired,
    Burned {
        attempt: u64,
    },
    /// Show `code` next to the device `name`; the user compares it with the phone.
    HelloReceived {
        attempt: u64,
        name: String,
        code: String,
    },
    Paired {
        name: String,
    },
    Cancelled(CancelReason),
    Closed,
}

impl fmt::Debug for PairingEvent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PairingEvent::HelloReceived { attempt, .. } => write!(f, "HelloReceived({attempt})"),
            PairingEvent::Paired { .. } => f.write_str("Paired"),
            PairingEvent::Burned { attempt } => write!(f, "Burned({attempt})"),
            PairingEvent::Cancelled(r) => write!(f, "Cancelled({r:?})"),
            PairingEvent::Opened => f.write_str("Opened"),
            PairingEvent::Renewed => f.write_str("Renewed"),
            PairingEvent::Expired => f.write_str("Expired"),
            PairingEvent::Closed => f.write_str("Closed"),
        }
    }
}

/// Handle for one window generation; proves nothing by itself, `consume` checks it atomically.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Ticket {
    gen: u64,
}

/// What the endpoint needs to test an incoming first message against the current secret.
pub struct Attempt {
    pub ticket: Ticket,
    pub psk: Psk,
}

impl fmt::Debug for Attempt {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Attempt(..)")
    }
}

/// Result of a successful burn.
pub struct Consumed {
    pub attempt: u64,
    /// Message 2 for the device.
    pub m2: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConsumeError {
    /// Not open, secret lapsed, another attempt running, wrong mode or the ticket is from an older generation.
    Stale,
    Handshake,
    Exhausted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PairError {
    /// A window cannot be (re)opened while an attempt runs.
    Busy,
    /// No such step is pending (never started, other attempt id on hello, already over).
    NotAwaiting,
    /// The step's deadline passed; the attempt ended.
    Expired,
    Frame(FrameError),
    BadHello,
    WrongCode,
    WrongAttempt,
    KeyAlreadyTrusted,
    KeyRevoked,
    Trust(TrustError),
    DataKey,
    Seal(FrameError),
    Exhausted,
    Rng,
    Qr(qr::QrError),
}

struct Waiting {
    attempt: u64,
    transport: Transport,
    sas: Sas,
    peer: PublicKey,
    burned_at: Duration,
    deadline: Duration,
}

enum State {
    Closed,
    Open {
        /// `None` once the window lapsed: nothing to test a psk against.
        secret: Option<Zeroizing<[u8; 16]>>,
        deadline: Duration,
    },
    AwaitHello(Waiting),
    AwaitConfirm(Waiting, String),
}

struct Inner {
    state: State,
    gen: u64,
    opened_at: Duration,
    last_now: Duration,
    events: Vec<PairingEvent>,
}

pub struct PairingHost {
    inner: Mutex<Inner>,
    clock: Arc<dyn Clock>,
    trust: Arc<dyn TrustStore>,
    keys: Arc<dyn DataKeyProvider>,
    hub_key: PublicKey,
}

fn new_secret() -> Result<Zeroizing<[u8; 16]>, PairError> {
    let mut s = Zeroizing::new([0u8; 16]);
    getrandom::fill(&mut *s).map_err(|_| PairError::Rng)?;
    Ok(s)
}

impl Inner {
    fn bump(&mut self) -> Result<u64, PairError> {
        self.gen = self.gen.checked_add(1).ok_or(PairError::Exhausted)?;
        Ok(self.gen)
    }

    /// A fresh open window. On any failure the host closes (never keeps a half-made window).
    fn fresh_window(
        &mut self,
        now: Duration,
        restart: bool,
        event: PairingEvent,
    ) -> Result<(), PairError> {
        let made = self.bump().and_then(|_| new_secret());
        match made {
            Ok(secret) => {
                self.state = State::Open {
                    secret: Some(secret),
                    deadline: now.saturating_add(WINDOW),
                };
                if restart {
                    self.opened_at = now;
                }
                self.events.push(event);
                Ok(())
            }
            Err(e) => {
                self.state = State::Closed;
                self.events.push(PairingEvent::Closed);
                Err(e)
            }
        }
    }

    fn end_attempt(&mut self, now: Duration, reason: CancelReason) {
        self.events.push(PairingEvent::Cancelled(reason));
        let _ = self.fresh_window(now, true, PairingEvent::Renewed);
    }

    /// Lazy deadlines; call first in every entry point.
    fn advance(&mut self, real_now: Duration) -> Duration {
        let now = real_now.max(self.last_now);
        self.last_now = now;
        match &mut self.state {
            State::Open { secret, deadline } if secret.is_some() && now >= *deadline => {
                *secret = None;
                self.events.push(PairingEvent::Expired);
            }
            State::AwaitHello(w) if now >= w.deadline => {
                self.end_attempt(now, CancelReason::HelloTimeout)
            }
            State::AwaitConfirm(w, _) if now >= w.deadline => {
                self.end_attempt(now, CancelReason::ConfirmTimeout)
            }
            _ => {}
        }
        now
    }

    /// A lapsed open window gets a new secret (dialog still open).
    fn renew_if_lapsed(&mut self, now: Duration) -> Result<(), PairError> {
        if matches!(self.state, State::Open { secret: None, .. }) {
            self.fresh_window(now, false, PairingEvent::Renewed)?;
        }
        Ok(())
    }
}

impl PairingHost {
    pub fn new(
        hub_key: PublicKey,
        clock: Arc<dyn Clock>,
        trust: Arc<dyn TrustStore>,
        keys: Arc<dyn DataKeyProvider>,
    ) -> Self {
        PairingHost {
            inner: Mutex::new(Inner {
                state: State::Closed,
                gen: 0,
                opened_at: Duration::ZERO,
                last_now: Duration::ZERO,
                events: Vec::new(),
            }),
            clock,
            trust,
            keys,
            hub_key,
        }
    }

    /// The hub key this host puts into QR codes.
    pub fn hub_key(&self) -> PublicKey {
        self.hub_key
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        // A poisoned lock only means another thread panicked; the state is still consistent
        // (every transition assigns it whole), and refusing forever would lock the user out.
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Opens (or restarts) the window. Refused while an attempt is running.
    pub fn open(&self) -> Result<(), PairError> {
        let mut g = self.lock();
        let now = g.advance(self.clock.now());
        if matches!(g.state, State::AwaitHello(_) | State::AwaitConfirm(..)) {
            return Err(PairError::Busy);
        }
        g.fresh_window(now, true, PairingEvent::Opened)
    }

    /// The QR text for the dialog, or `None` unless a window is open (also none while an attempt
    /// runs). Renews a lapsed window first.
    pub fn qr(&self, port: u16, ipv4: [u8; 4]) -> Result<Option<String>, PairError> {
        let mut g = self.lock();
        let now = g.advance(self.clock.now());
        g.renew_if_lapsed(now)?;
        let State::Open {
            secret: Some(secret),
            deadline,
        } = &g.state
        else {
            return Ok(None);
        };
        let left = deadline
            .saturating_sub(now)
            .as_secs()
            .clamp(1, u64::from(qr::MAX_EXPIRY_SECS)) as u32;
        let payload = qr::QrPayload {
            hub_key: self.hub_key,
            secret: secret.clone(),
            expiry_secs: left,
            port,
            ipv4,
        };
        qr::encode(&payload).map(Some).map_err(PairError::Qr)
    }

    /// Emits events and renews a lapsed window early. Nothing depends on it being called.
    pub fn tick(&self) {
        let mut g = self.lock();
        let now = g.advance(self.clock.now());
        let _ = g.renew_if_lapsed(now);
    }

    /// Current secret as a PSK, only while a window is open (not lapsed, no attempt running).
    pub fn begin_attempt(&self) -> Option<Attempt> {
        let mut g = self.lock();
        g.advance(self.clock.now());
        let gen = g.gen;
        match &g.state {
            State::Open {
                secret: Some(s), ..
            } => Some(Attempt {
                ticket: Ticket { gen },
                psk: Psk::from_secret(s),
            }),
            _ => None,
        }
    }

    /// Burns the window for a first message that already proved the current secret: atomically
    /// (`state == Open && gen == ticket.gen`, one lock, no store I/O) moves to `AwaitHello` and
    /// answers with message 2. Any other state or generation: dropped, nothing changes.
    pub fn consume(&self, ticket: &Ticket, first: Responder1) -> Result<Consumed, ConsumeError> {
        let mut g = self.lock();
        let now = g.advance(self.clock.now());
        let open = matches!(
            g.state,
            State::Open {
                secret: Some(_),
                ..
            }
        );
        // past the hard cap no confirm can succeed: refuse without burning the QR
        let capped = now >= g.opened_at.saturating_add(CONFIRM_HARD_CAP);
        if !open || capped || g.gen != ticket.gen || first.mode() != crate::noise::Mode::Pair {
            return Err(ConsumeError::Stale);
        }
        let peer = first.peer();
        let (m2, transport, sas) = first.accept().map_err(|_| ConsumeError::Handshake)?;
        let attempt = g.bump().map_err(|_| ConsumeError::Exhausted)?;
        g.state = State::AwaitHello(Waiting {
            attempt,
            transport,
            sas,
            peer,
            burned_at: now,
            deadline: now.saturating_add(HELLO_WAIT),
        });
        g.events.push(PairingEvent::Burned { attempt });
        Ok(Consumed { attempt, m2 })
    }

    /// The device's first transport frame. Anything but a valid `hello` ends the attempt.
    pub fn on_hello(&self, attempt: u64, wire: &[u8]) -> Result<(), PairError> {
        let mut g = self.lock();
        let was_waiting = matches!(g.state, State::AwaitHello(_));
        let now = g.advance(self.clock.now());
        let w = match std::mem::replace(&mut g.state, State::Closed) {
            State::AwaitHello(w) if w.attempt == attempt => w,
            other => {
                g.state = other;
                return Err(if was_waiting && !matches!(g.state, State::AwaitHello(_)) {
                    PairError::Expired
                } else {
                    PairError::NotAwaiting
                });
            }
        };
        let mut w = w;
        let parsed = match w.transport.open(wire) {
            Ok((TAG_HELLO, body)) => frame::parse_hello(&body).map_err(|_| PairError::BadHello),
            Ok(_) => Err(PairError::BadHello),
            Err(e) => Err(PairError::Frame(e)),
        };
        match parsed {
            Ok(name) => {
                let deadline = w
                    .burned_at
                    .saturating_add(CONFIRM_WAIT)
                    .min(g.opened_at.saturating_add(CONFIRM_HARD_CAP));
                if now >= deadline {
                    g.end_attempt(now, CancelReason::ConfirmTimeout);
                    return Err(PairError::Expired);
                }
                w.deadline = deadline;
                let code = w.sas.digits();
                g.events.push(PairingEvent::HelloReceived {
                    attempt,
                    name: name.clone(),
                    code,
                });
                g.state = State::AwaitConfirm(w, name);
                Ok(())
            }
            Err(e) => {
                g.end_attempt(now, CancelReason::BadHello);
                Err(e)
            }
        }
    }

    /// The user's confirmation: `code` as typed/shown (spaces ignored). Returns only the sealed
    /// data-key frame for the device. Any failure ends the attempt and leaves no trust entry.
    pub fn confirm(&self, attempt: u64, code: &str) -> Result<Vec<u8>, PairError> {
        let mut g = self.lock();
        let was_waiting = matches!(g.state, State::AwaitConfirm(..));
        let now = g.advance(self.clock.now());
        let (mut w, name) = match std::mem::replace(&mut g.state, State::Closed) {
            State::AwaitConfirm(w, name) => (w, name),
            other => {
                g.state = other;
                return Err(if was_waiting {
                    PairError::Expired
                } else {
                    PairError::NotAwaiting
                });
            }
        };
        if w.attempt != attempt {
            g.end_attempt(now, CancelReason::WrongAttempt);
            return Err(PairError::WrongAttempt);
        }
        let typed: Vec<u8> = code.bytes().filter(|b| !b.is_ascii_whitespace()).collect();
        let shown = w.sas.digits();
        if typed.len() != shown.len() || !bool::from(typed.ct_eq(shown.as_bytes())) {
            g.end_attempt(now, CancelReason::WrongCode);
            return Err(PairError::WrongCode);
        }
        match self.finish(&mut w, name.clone()) {
            Ok(sealed) => {
                g.state = State::Closed;
                g.events.push(PairingEvent::Paired { name });
                g.events.push(PairingEvent::Closed);
                Ok(sealed)
            }
            Err(e) => {
                g.end_attempt(now, CancelReason::Rejected);
                Err(e)
            }
        }
    }

    /// Re-check, trust, key, seal; rolls the trust entry back on any later failure.
    fn finish(&self, w: &mut Waiting, name: String) -> Result<Vec<u8>, PairError> {
        match self.trust.find_by_key(&w.peer) {
            Some(d) if d.revoked => return Err(PairError::KeyRevoked),
            Some(_) => return Err(PairError::KeyAlreadyTrusted),
            None => {}
        }
        self.trust
            .add(Device {
                key: w.peer,
                name,
                last_seen: None,
                revoked: false,
            })
            .map_err(|e| match e {
                TrustError::Revoked => PairError::KeyRevoked,
                TrustError::AlreadyTrusted => PairError::KeyAlreadyTrusted,
                other => PairError::Trust(other),
            })?;
        let sealed = self.seal_key(&mut w.transport);
        if sealed.is_err() {
            let _ = self.trust.remove(&w.peer);
        }
        sealed
    }

    fn seal_key(&self, transport: &mut Transport) -> Result<Vec<u8>, PairError> {
        let dk = self.keys.current().map_err(|_| PairError::DataKey)?;
        let mut body = Zeroizing::new(Vec::with_capacity(36));
        body.extend_from_slice(&dk.version.to_be_bytes());
        body.extend_from_slice(&*dk.key);
        transport.seal(TAG_DATA_KEY, &body).map_err(PairError::Seal)
    }

    /// Closes the window and drops any attempt.
    pub fn cancel(&self) {
        let mut g = self.lock();
        g.advance(self.clock.now());
        if !matches!(g.state, State::Closed) {
            g.state = State::Closed;
            g.events.push(PairingEvent::Closed);
        }
    }

    pub fn is_open(&self) -> bool {
        let mut g = self.lock();
        g.advance(self.clock.now());
        !matches!(g.state, State::Closed)
    }

    /// Events since the last call, oldest first.
    pub fn take_events(&self) -> Vec<PairingEvent> {
        std::mem::take(&mut self.lock().events)
    }
}

#[cfg(test)]
mod tests;
