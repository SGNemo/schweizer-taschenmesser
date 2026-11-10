//! Per-connection routing and admission.
//!
//! * [`Admission`]: before a single byte is parsed as Noise: the peer must be a private address
//!   inside a bound subnet, the first message at most `PRE_HANDSHAKE_CAP` bytes, and the address
//!   under the handshake rate limit. Nothing is answered on a refusal.
//! * [`Router::accept`] turns a first message into a [`Connection`]; [`Connection::on_frame`] has
//!   **no attempt id parameter**: the pairing attempt of a connection is fixed when it is created
//!   and only that connection's frames ever reach it, so another connection cannot end or steer
//!   somebody else's pairing.
//! * A session is a sync session or an input session (remote control), by its handshake mode. The
//!   two never mix: a sync session closes on any tag but `request`, an input session hands its
//!   frames to `input::session` only (which knows no sync tag) and never reaches the [`Hub`]. An
//!   input session starts only on a connection that came in on a bind of the stored home network.

use super::netpolicy::{peer_allowed, Bind};
use super::{Hub, HubError, Response, TAG_REQUEST, TAG_RESPONSE};
use crate::endpoint::{Conn, Endpoint, FirstReply, Incoming, Session};
use crate::input::session::{InputConn, Step};
use crate::input::{InputSink, Remote};
use crate::noise::frame::{FrameError, PRE_CONFIRM_CAP, PRE_HANDSHAKE_CAP};
use crate::noise::Mode;
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

    /// Whether a connection is on the stored home network: it came in on the address of a home
    /// bind **and** its peer sits in that bind's subnet. The second half matters while a pairing
    /// window has the hub on another network too: a peer over there that dials the home address
    /// is still not on the home network.
    fn is_home(&self, local: IpAddr, peer: IpAddr) -> bool {
        let IpAddr::V4(peer) = peer else {
            return false;
        };
        self.binds
            .iter()
            .any(|b| IpAddr::V4(b.ip()) == local && b.is_home() && b.contains(peer))
    }

    /// The addresses that count as the home network right now.
    fn home_addrs(&self) -> Vec<std::net::Ipv4Addr> {
        self.binds
            .iter()
            .filter(|b| b.is_home())
            .map(Bind::ip)
            .collect()
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
    /// Remote control, if the shell wired it. Without it every input session is refused.
    input: Option<(Arc<Remote>, Arc<dyn InputSink>)>,
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
            input: None,
        }
    }

    /// Wires remote control: the PC's switch and grants, and the sink that acts on the PC.
    pub fn with_input(mut self, remote: Arc<Remote>, sink: Arc<dyn InputSink>) -> Self {
        self.input = Some((remote, sink));
        self
    }

    /// Replaces the binds. If an address stops being the home network (the home network was
    /// replaced, or the hub stopped listening there), every input session is closed: input is
    /// accepted on the stored home network only, not just at its handshake.
    pub fn set_binds(&self, binds: Vec<Bind>) {
        let lost_home = match self.admission.lock() {
            Ok(mut a) => {
                let before = a.home_addrs();
                a.set_binds(binds);
                let after = a.home_addrs();
                before.iter().any(|ip| !after.contains(ip))
            }
            Err(_) => true,
        };
        if lost_home {
            if let Some((remote, _)) = &self.input {
                remote.home_lost();
            }
            self.endpoint.close_input_sessions();
        }
    }

    /// Whether `peer` may connect at all (private address inside a bound subnet); the transport asks
    /// before it takes a connection slot.
    pub fn peer_allowed(&self, peer: IpAddr) -> bool {
        self.admission.lock().is_ok_and(|a| a.peer_ok(peer))
    }

    /// First message of a new connection from `peer` whose local address is not known: sync and
    /// pairing as usual, never an input session.
    pub fn accept(&self, peer: IpAddr, wire: &[u8], now: Duration) -> Opened {
        self.accept_from(None, peer, wire, now)
    }

    /// First message of a new connection from `peer` that came in on the address `local`.
    pub fn accept_on(&self, local: IpAddr, peer: IpAddr, wire: &[u8], now: Duration) -> Opened {
        self.accept_from(Some(local), peer, wire, now)
    }

    fn accept_from(
        &self,
        local: Option<IpAddr>,
        peer: IpAddr,
        wire: &[u8],
        now: Duration,
    ) -> Opened {
        // (admitted, came in on the stored home network); a poisoned lock is neither
        let (admitted, home) = match self.admission.lock() {
            Ok(mut a) => (
                a.admit(peer, wire.len(), now),
                local.is_some_and(|l| a.is_home(l, peer)),
            ),
            Err(_) => (Err(Refusal::Address), false),
        };
        if let Err(r) = admitted {
            return Opened::Drop(Some(r));
        }
        let input_ok = home && self.input.is_some();
        match self.endpoint.handle_first_on(wire, input_ok) {
            FirstReply::Drop => Opened::Drop(None),
            FirstReply::Refused { m2 } => Opened::Refuse(m2),
            FirstReply::Accept { m2, conn } => {
                let kind = match conn {
                    Conn::Pairing { attempt } => Kind::Pairing {
                        attempt,
                        helloed: false,
                    },
                    Conn::Session(s) => match (s.mode(), &self.input) {
                        (Mode::Input, Some((remote, sink))) => {
                            let conn =
                                InputConn::new(remote.clone(), sink.clone(), s.peer(), s.handle());
                            Kind::Input(s, Box::new(conn))
                        }
                        // the endpoint accepts an input session only with `input_ok`
                        (Mode::Input, None) => return Opened::Drop(None),
                        _ => Kind::Session(s),
                    },
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
    Pairing {
        attempt: u64,
        helloed: bool,
    },
    /// Sync session.
    Session(Box<Session>),
    /// Input session (remote control): its frames go to the `InputConn` and nowhere else.
    Input(Box<Session>, Box<InputConn>),
}

/// What to do after a frame.
#[derive(Debug, PartialEq, Eq)]
pub enum Outcome {
    /// Nothing to send, keep the connection.
    Continue,
    Reply(Vec<u8>),
    /// Send the bytes, then close the connection.
    ReplyClose(Vec<u8>),
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
            Kind::Session(_) | Kind::Input(..) => None,
        }
    }

    /// Largest frame the connection accepts right now (small until the peer proved itself). The
    /// transport refuses longer frames before it buffers them.
    pub fn frame_cap(&self) -> usize {
        match &self.kind {
            Kind::Pairing { .. } => PRE_CONFIRM_CAP,
            Kind::Session(s) | Kind::Input(s, _) => s.cap(),
        }
    }

    pub fn is_closed(&self) -> bool {
        self.done
            || match &self.kind {
                Kind::Session(s) | Kind::Input(s, _) => s.is_closed(),
                Kind::Pairing { .. } => false,
            }
    }

    /// One complete frame from the peer. `now_unix` (s) stamps `lastSeenAt`, `now_ms` is the hub
    /// clock for the HLC drift check, `mono` is monotonic time for the input session's rate limits
    /// (a wall clock may jump).
    pub fn on_frame(&mut self, wire: &[u8], now_unix: u64, now_ms: u64, mono: Duration) -> Outcome {
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
            Kind::Input(s, input) => {
                let step = match s.receive(wire, now_unix) {
                    Ok(Incoming::Hello(_)) => input.on_hello(),
                    Ok(Incoming::App { tag, body }) => input.on_frame(tag, &body, mono),
                    Ok(Incoming::Unpair) | Err(_) => Step::Close,
                };
                seal_step(s, step)
            }
        };
        self.finish(out)
    }

    /// Called on every tick of the connection, also without a frame: what an input session has to
    /// send unasked (a changed state, or the reason the PC ended it). Sync and pairing connections
    /// never send unasked. The transport does not count this as activity.
    pub fn poll_outbound(&mut self, mono: Duration) -> Outcome {
        if self.done {
            return Outcome::Close;
        }
        let out = match &mut self.kind {
            Kind::Input(s, input) => {
                let step = input.poll(mono);
                seal_step(s, step)
            }
            Kind::Pairing { .. } | Kind::Session(_) => Outcome::Continue,
        };
        self.finish(out)
    }

    fn finish(&mut self, out: Outcome) -> Outcome {
        if matches!(out, Outcome::Close | Outcome::ReplyClose(_)) {
            self.done = true;
        }
        out
    }
}

/// Seals what an input session wants to send. A frame that cannot be sealed closes the connection.
fn seal_step(s: &mut Session, step: Step) -> Outcome {
    match step {
        Step::Continue => Outcome::Continue,
        Step::Close => Outcome::Close,
        Step::Reply(tag, body) => s.send(tag, &body).map_or(Outcome::Close, Outcome::Reply),
        Step::ReplyClose(tag, body) => s
            .send(tag, &body)
            .map_or(Outcome::Close, Outcome::ReplyClose),
    }
}

impl Drop for Connection {
    fn drop(&mut self) {
        if let Kind::Pairing { attempt, .. } = &self.kind {
            self.pairing.abandon(*attempt);
        }
    }
}
