//! Thin hub glue between the Noise functions, the pairing window and the trust list.
//!
//! No sockets here (`std::net` and `tokio` are banned outside tests, see `tests/rules.rs`): the
//! transport of package 2b hands complete messages in and sends back what is returned. A dropped
//! message gets **no reply at all**, so nobody can probe whether a window is open.
//!
//! Check order for a pairing message 1 (each step ends in a silent drop):
//! 1. a window is open and not lapsed, then the message proves the CURRENT secret (no trust-list
//!    call before that, so strangers cost the list nothing),
//! 2. the sender's key is neither trusted nor revoked (a revoked key never pairs again, an active
//!    key does not re-pair; no burn),
//! 3. the window is consumed atomically (`PairingHost::consume`).
//!
//! A session message 1 from an unknown or revoked key gets the same authenticated refusal.

use crate::noise::frame::{
    self, FrameError, MODE_PAIR, TAG_APP_MIN, TAG_DATA_KEY, TAG_HELLO, TAG_UNKNOWN_DEVICE,
    TAG_UNPAIR,
};
use crate::noise::{self, PublicKey, StaticKey, Transport};
use crate::pairing::PairingHost;
use crate::trust::{KeyStoreError, SessionHandle, SessionRegistry, StaticKeyStore, TrustStore};
use std::fmt;
use std::sync::Arc;
use zeroize::Zeroizing;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EndpointError {
    /// The key store failed: the hub does not start (no fallback key).
    Key(KeyStoreError),
    /// The pairing host was built for another hub key.
    HubKeyMismatch,
}

pub struct Endpoint {
    key: StaticKey,
    trust: Arc<dyn TrustStore>,
    pairing: Arc<PairingHost>,
    sessions: Arc<SessionRegistry>,
}

/// What the transport does with a first message.
pub enum FirstReply {
    /// Close silently, send nothing.
    Drop,
    /// Send `m2`, then route the connection's frames to `conn`.
    Accept { m2: Vec<u8>, conn: Conn },
    /// Send `m2` (an authenticated `unknown-device`) and close.
    Refused { m2: Vec<u8> },
}

pub enum Conn {
    /// Pairing connection: frames go to `PairingHost::on_hello` / `confirm`.
    Pairing {
        attempt: u64,
    },
    Session(Box<Session>),
}

impl fmt::Debug for FirstReply {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            FirstReply::Drop => "Drop",
            FirstReply::Accept { .. } => "Accept",
            FirstReply::Refused { .. } => "Refused",
        })
    }
}

impl Endpoint {
    /// Loads (or, only on a positively empty store, creates) the hub key. Any key store error means
    /// no endpoint.
    pub fn start(
        keys: &dyn StaticKeyStore,
        trust: Arc<dyn TrustStore>,
        pairing: Arc<PairingHost>,
        sessions: Arc<SessionRegistry>,
    ) -> Result<Self, EndpointError> {
        let key = keys.load_or_create().map_err(EndpointError::Key)?;
        if pairing.hub_key() != key.public() {
            return Err(EndpointError::HubKeyMismatch);
        }
        Ok(Endpoint {
            key,
            trust,
            pairing,
            sessions,
        })
    }

    pub fn public_key(&self) -> PublicKey {
        self.key.public()
    }

    /// Handles the first message of a connection.
    pub fn handle_first(&self, wire: &[u8]) -> FirstReply {
        if wire.first() == Some(&MODE_PAIR) {
            self.pair_first(wire)
        } else {
            self.session_first(wire)
        }
    }

    fn pair_first(&self, wire: &[u8]) -> FirstReply {
        let Some(attempt) = self.pairing.begin_attempt() else {
            return FirstReply::Drop;
        };
        let Ok(first) = noise::read_first(&self.key, wire, Some(&attempt.psk)) else {
            return FirstReply::Drop;
        };
        if self.trust.find_by_key(&first.peer()).is_some() {
            return FirstReply::Drop;
        }
        match self.pairing.consume(&attempt.ticket, first) {
            Ok(c) => FirstReply::Accept {
                m2: c.m2,
                conn: Conn::Pairing { attempt: c.attempt },
            },
            Err(_) => FirstReply::Drop,
        }
    }

    fn session_first(&self, wire: &[u8]) -> FirstReply {
        let Ok(first) = noise::read_first(&self.key, wire, None) else {
            return FirstReply::Drop;
        };
        let peer = first.peer();
        match self.trust.find_by_key(&peer) {
            Some(d) if !d.revoked => match first.accept() {
                Ok((m2, transport, _)) => {
                    // registered before the first frame: a revoke between message 2 and `hello` counts
                    let handle = self.sessions.register(peer);
                    FirstReply::Accept {
                        m2,
                        conn: Conn::Session(Box::new(Session {
                            transport,
                            handle,
                            peer,
                            trust: self.trust.clone(),
                            sessions: self.sessions.clone(),
                            authenticated: false,
                        })),
                    }
                }
                Err(_) => FirstReply::Drop,
            },
            _ => match first.refuse_unknown() {
                Ok(m2) => FirstReply::Refused { m2 },
                Err(_) => FirstReply::Drop,
            },
        }
    }
}

/// A frame the session accepted.
pub enum Incoming {
    Hello(String),
    /// The device unpaired itself. No id: it only ever acts on the session's own peer.
    Unpair,
    App {
        tag: u8,
        body: Zeroizing<Vec<u8>>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionError {
    /// Closed (revoked, unpaired, earlier failure). Sticky.
    Closed,
    Frame(FrameError),
}

/// One authenticated connection of a trusted device.
pub struct Session {
    transport: Transport,
    handle: SessionHandle,
    peer: PublicKey,
    trust: Arc<dyn TrustStore>,
    sessions: Arc<SessionRegistry>,
    authenticated: bool,
}

impl fmt::Debug for Session {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Session(..)")
    }
}

impl Session {
    pub fn peer(&self) -> PublicKey {
        self.peer
    }

    pub fn is_closed(&self) -> bool {
        self.handle.is_closed()
    }

    pub fn cap(&self) -> usize {
        self.transport.cap()
    }

    /// Checks (in this order) closed flag, trust list, then decrypts. The cap is raised and the
    /// device's activity recorded only after the first frame decrypted; any failure closes for good.
    pub fn receive(&mut self, wire: &[u8], now_unix: u64) -> Result<Incoming, SessionError> {
        self.check_open()?;
        let (tag, body) = self.transport.open(wire).map_err(|e| self.fail(e))?;
        if !self.authenticated {
            self.authenticated = true;
            self.transport.raise_cap();
            self.trust.touch(&self.peer, now_unix);
        }
        match tag {
            TAG_HELLO => match frame::parse_hello(&body) {
                Ok(name) => Ok(Incoming::Hello(name)),
                Err(e) => Err(self.fail(e)),
            },
            TAG_UNPAIR => {
                let _ = self.sessions.revoke(&*self.trust, &self.peer);
                self.handle.close();
                Ok(Incoming::Unpair)
            }
            TAG_DATA_KEY | TAG_UNKNOWN_DEVICE => Err(self.fail(FrameError::UnknownTag)),
            t if t >= TAG_APP_MIN => Ok(Incoming::App { tag: t, body }),
            _ => Err(self.fail(FrameError::UnknownTag)),
        }
    }

    pub fn send(&mut self, tag: u8, body: &[u8]) -> Result<Vec<u8>, SessionError> {
        self.check_open()?;
        self.transport.seal(tag, body).map_err(SessionError::Frame)
    }

    fn check_open(&mut self) -> Result<(), SessionError> {
        if self.handle.is_closed() {
            return Err(SessionError::Closed);
        }
        match self.trust.find_by_key(&self.peer) {
            Some(d) if !d.revoked => Ok(()),
            _ => {
                self.handle.close();
                Err(SessionError::Closed)
            }
        }
    }

    fn fail(&mut self, e: FrameError) -> SessionError {
        self.handle.close();
        SessionError::Frame(e)
    }
}

#[cfg(test)]
mod tests;
