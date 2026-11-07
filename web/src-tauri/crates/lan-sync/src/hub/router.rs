//! Per-connection routing and admission.
//!
//! * [`Admission`]: before a single byte is parsed as Noise: the peer must be a private address
//!   inside a bound subnet, the first message at most `PRE_HANDSHAKE_CAP` bytes, and the address
//!   under the handshake rate limit. Nothing is answered on a refusal.
//! * [`Router::accept`] turns a first message into a [`Connection`]; [`Connection::on_frame`] has
//!   **no attempt id parameter**: the pairing attempt of a connection is fixed when it is created
//!   and only that connection's frames ever reach it, so another connection cannot end or steer
//!   somebody else's pairing.

use super::netpolicy::{peer_allowed, Bind};
use super::{Hub, HubError, Response, TAG_REQUEST, TAG_RESPONSE};
use crate::endpoint::{Conn, Endpoint, FirstReply, Incoming, Session};
use crate::noise::frame::{FrameError, PRE_CONFIRM_CAP, PRE_HANDSHAKE_CAP};
use crate::pairing::PairingHost;
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// First messages per address and window.
pub const HANDSHAKES_PER_WINDOW: u32 = 20;
pub const RATE_WINDOW: Duration = Duration::from_secs(60);
/// Addresses tracked at once; a full table of live entries refuses new addresses (fail-closed).
pub const MAX_TRACKED_ADDRS: usize = 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Refusal {
    /// Not a private address, or outside every bound subnet.
    Address,
    /// First message longer than the pre-handshake cap.
    Oversize,
    RateLimited,
}

#[derive(Default)]
struct Window {
    started: Duration,
    count: u32,
}

#[derive(Default)]
pub struct Admission {
    binds: Vec<Bind>,
    seen: HashMap<IpAddr, Window>,
    /// Tests talk over the loopback interface; production never sets this (there is no such field).
    #[cfg(test)]
    loopback: bool,
}

impl Admission {
    pub fn new() -> Self {
        Self::default()
    }

    #[cfg(test)]
    pub(crate) fn allow_loopback_for_tests(&mut self) {
        self.loopback = true;
    }

    fn peer_ok(&self, peer: IpAddr) -> bool {
        #[cfg(test)]
        if self.loopback {
            if let IpAddr::V4(v4) = peer {
                return v4.is_loopback() && self.binds.iter().any(|b| b.contains(v4));
            }
        }
        peer_allowed(peer, &self.binds)
    }

    /// Replaces the bound subnets (after the network decision changed).
    pub fn set_binds(&mut self, binds: Vec<Bind>) {
        self.binds = binds;
    }

    /// `now` is monotonic time (only differences count). Counted: only first messages that passed
    /// the address and size checks, so strangers from outside never fill the table.
    pub fn admit(&mut self, peer: IpAddr, first_len: usize, now: Duration) -> Result<(), Refusal> {
        if !self.peer_ok(peer) {
            return Err(Refusal::Address);
        }
        if first_len > PRE_HANDSHAKE_CAP {
            return Err(Refusal::Oversize);
        }
        if self.seen.len() >= MAX_TRACKED_ADDRS && !self.seen.contains_key(&peer) {
            self.seen
                .retain(|_, w| now.saturating_sub(w.started) < RATE_WINDOW);
            if self.seen.len() >= MAX_TRACKED_ADDRS {
                return Err(Refusal::RateLimited);
            }
        }
        let w = self.seen.entry(peer).or_default();
        if w.count == 0 || now.saturating_sub(w.started) >= RATE_WINDOW {
            *w = Window {
                started: now,
                count: 0,
            };
        }
        if w.count >= HANDSHAKES_PER_WINDOW {
            return Err(Refusal::RateLimited);
        }
        w.count += 1;
        Ok(())
    }
}

pub struct Router {
    endpoint: Endpoint,
    pairing: Arc<PairingHost>,
    hub: Arc<Hub>,
    admission: Mutex<Admission>,
}

/// What the transport does with a first message.
pub enum Opened {
    /// Close silently, send nothing.
    Drop(Option<Refusal>),
    /// Send the bytes, then close (authenticated refusal for unknown/revoked devices).
    Refuse(Vec<u8>),
    Accept {
        m2: Vec<u8>,
        conn: Box<Connection>,
    },
}

impl Router {
    pub fn new(
        endpoint: Endpoint,
        pairing: Arc<PairingHost>,
        hub: Arc<Hub>,
        admission: Admission,
    ) -> Self {
        Router {
            endpoint,
            pairing,
            hub,
            admission: Mutex::new(admission),
        }
    }

    pub fn set_binds(&self, binds: Vec<Bind>) {
        if let Ok(mut a) = self.admission.lock() {
            a.set_binds(binds);
        }
    }

    /// First message of a new connection from `peer`.
    pub fn accept(&self, peer: IpAddr, wire: &[u8], now: Duration) -> Opened {
        let admitted = match self.admission.lock() {
            Ok(mut a) => a.admit(peer, wire.len(), now),
            Err(_) => Err(Refusal::Address),
        };
        if let Err(r) = admitted {
            return Opened::Drop(Some(r));
        }
        match self.endpoint.handle_first(wire) {
            FirstReply::Drop => Opened::Drop(None),
            FirstReply::Refused { m2 } => Opened::Refuse(m2),
            FirstReply::Accept { m2, conn } => {
                let kind = match conn {
                    Conn::Pairing { attempt } => Kind::Pairing {
                        attempt,
                        helloed: false,
                    },
                    Conn::Session(s) => Kind::Session(s),
                };
                Opened::Accept {
                    m2,
                    conn: Box::new(Connection {
                        kind,
                        pairing: self.pairing.clone(),
                        hub: self.hub.clone(),
                        done: false,
                    }),
                }
            }
        }
    }
}

enum Kind {
    Pairing { attempt: u64, helloed: bool },
    Session(Box<Session>),
}

/// What to do after a frame.
#[derive(Debug, PartialEq, Eq)]
pub enum Outcome {
    /// Nothing to send, keep the connection.
    Continue,
    Reply(Vec<u8>),
    /// Close the connection (no reply).
    Close,
}

/// One accepted connection. Dropping it ends its own pairing attempt (if any) and closes its
/// session (the `Session` does that itself).
pub struct Connection {
    kind: Kind,
    pairing: Arc<PairingHost>,
    hub: Arc<Hub>,
    done: bool,
}

impl Connection {
    /// The pairing attempt this connection carries. The transport uses it to deliver the sealed
    /// data-key frame that `PairingHost::confirm(attempt, code)` returns to **this** connection.
    pub fn pairing_attempt(&self) -> Option<u64> {
        match self.kind {
            Kind::Pairing { attempt, .. } => Some(attempt),
            Kind::Session(_) => None,
        }
    }

    /// Largest frame the connection accepts right now (small until the peer proved itself). The
    /// transport refuses longer frames before it buffers them.
    pub fn frame_cap(&self) -> usize {
        match &self.kind {
            Kind::Pairing { .. } => PRE_CONFIRM_CAP,
            Kind::Session(s) => s.cap(),
        }
    }

    pub fn is_closed(&self) -> bool {
        self.done
            || match &self.kind {
                Kind::Session(s) => s.is_closed(),
                Kind::Pairing { .. } => false,
            }
    }

    /// One complete frame from the peer. `now_unix` (s) stamps `lastSeenAt`, `now_ms` is the hub
    /// clock for the HLC drift check.
    pub fn on_frame(&mut self, wire: &[u8], now_unix: u64, now_ms: u64) -> Outcome {
        if self.done {
            return Outcome::Close;
        }
        let out = match &mut self.kind {
            Kind::Pairing { attempt, helloed } => {
                // exactly one frame (`hello`) is expected from the device; the key frame goes the
                // other way. A second frame is a protocol violation.
                if *helloed {
                    self.pairing.abandon(*attempt);
                    Outcome::Close
                } else {
                    *helloed = true;
                    match self.pairing.on_hello(*attempt, wire) {
                        Ok(()) => Outcome::Continue,
                        Err(_) => Outcome::Close,
                    }
                }
            }
            Kind::Session(s) => match s.receive(wire, now_unix) {
                Ok(Incoming::Hello(_)) => Outcome::Continue,
                Ok(Incoming::Unpair) => Outcome::Close,
                Ok(Incoming::App {
                    tag: TAG_REQUEST,
                    body,
                }) => {
                    let answer = self.hub.handle_json(&body, now_ms);
                    match s.send(TAG_RESPONSE, &answer) {
                        Ok(w) => Outcome::Reply(w),
                        Err(crate::endpoint::SessionError::Frame(FrameError::TooLarge)) => {
                            let small = Response::Error(HubError::ResponseTooLarge).to_json();
                            match s.send(TAG_RESPONSE, &small) {
                                Ok(w) => Outcome::Reply(w),
                                Err(_) => Outcome::Close,
                            }
                        }
                        Err(_) => Outcome::Close,
                    }
                }
                Ok(Incoming::App { .. }) | Err(_) => Outcome::Close,
            },
        };
        if out == Outcome::Close {
            self.done = true;
        }
        out
    }
}

impl Drop for Connection {
    fn drop(&mut self) {
        if let Kind::Pairing { attempt, .. } = self.kind {
            self.pairing.abandon(attempt);
        }
    }
}
