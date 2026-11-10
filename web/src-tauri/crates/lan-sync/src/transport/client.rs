//! The device side of home-network sync (phone, second PC): pairing by the hub's QR and sessions
//! with the hub (CONCEPT §4). Compiled on every target; the hub's transport is desktop-only.
//!
//! * Blocking `std::net` with timeouts, no async runtime (like the hub). One TCP connection per
//!   session; frames are `u16` big-endian length + Noise message, as in `transport/mod.rs`.
//! * Only private IPv4 addresses are ever dialled (the QR's hint is checked by `qr::decode`, a
//!   remembered address again here), never a public one.
//! * Nothing is logged; addresses, keys and frames are never formatted.
//! * Pairing: `IKpsk1` with the QR's single-use secret, then `hello` with the device name, then the
//!   PC shows the 6-digit code and the user confirms there; only then the hub sends the data-key
//!   frame. A dropped connection during pairing is "pairing not possible" (window closed, stale or
//!   used secret: the hub answers nothing it cannot authenticate), never a reason given by the peer.
//! * Session: `IK`; a refusal counts only when it is authenticated by the hub (`unknown-device`);
//!   anything else (no answer, wrong key, reset) is a calm "network".

use crate::noise::frame::{self, MAX_FRAME, PRE_CONFIRM_CAP, TAG_DATA_KEY, TAG_HELLO, TAG_UNPAIR};
use crate::noise::{self, Finished, InitError, Mode, Psk, PublicKey, StaticKey, Transport};
use crate::qr;
use std::io::{ErrorKind, Read, Write};
use std::net::{Ipv4Addr, SocketAddrV4, TcpStream};
use std::time::{Duration, Instant};
use zeroize::Zeroizing;

/// Same values as `hub::TAG_REQUEST` / `hub::TAG_RESPONSE` (the hub module is desktop-only; a test
/// pins them).
pub const TAG_REQUEST: u8 = 0x10;
pub const TAG_RESPONSE: u8 = 0x11;

pub const CONNECT_TIMEOUT: Duration = Duration::from_secs(4);
pub const IO_TIMEOUT: Duration = Duration::from_secs(15);
/// The hub keeps a confirmation open at most this long (`pairing::CONFIRM_HARD_CAP`).
pub const CONFIRM_WAIT: Duration = Duration::from_secs(240);
pub(crate) const POLL: Duration = Duration::from_millis(500);

/// Why a client step failed. Carries no bytes and no address.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClientError {
    /// Not a Nemo pairing code, or one that is no longer valid.
    BadQr,
    /// The PC could not be reached or the connection dropped (calm, retried later).
    Network,
    /// The hub dropped the pairing attempt (window closed, secret used or stale, key refused).
    PairingNotPossible,
    /// The code was shown, then the hub closed: the user cancelled on the PC or the codes differed.
    PairingAborted,
    /// The hub authenticated itself and said it does not know this device (unpaired or revoked).
    UnknownDevice,
    /// The user cancelled on the device while waiting for the confirmation on the PC.
    Cancelled,
    /// A frame that does not belong to the protocol.
    Protocol,
}

/// The result of a confirmed pairing.
pub struct Paired {
    pub hub_key: PublicKey,
    pub addr: SocketAddrV4,
    pub data_key_version: u32,
    pub data_key: Zeroizing<[u8; 32]>,
}

impl std::fmt::Debug for Paired {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Paired(..)")
    }
}

/// A device name the hub accepts: trimmed, control characters removed, at most 64 bytes (cut at a
/// character boundary); empty names become "Gerät".
pub fn hello_name(name: &str) -> String {
    let clean: String = name.trim().chars().filter(|c| !c.is_control()).collect();
    let mut out = String::new();
    for c in clean.chars() {
        if out.len() + c.len_utf8() > frame::HELLO_NAME_MAX {
            break;
        }
        out.push(c);
    }
    let out = out.trim().to_owned();
    if out.is_empty() {
        "Gerät".to_owned()
    } else {
        out
    }
}

/// Pairs with the hub of `qr_text`. `on_code` receives the 6-digit code as soon as the handshake is
/// done (the device shows "Am PC bestätigen · Code …"); `cancelled` is polled while waiting for the
/// confirmation on the PC.
pub fn pair(
    qr_text: &str,
    own: &StaticKey,
    name: &str,
    on_code: &mut dyn FnMut(&str),
    cancelled: &dyn Fn() -> bool,
) -> Result<Paired, ClientError> {
    let payload = qr::decode(qr_text).map_err(|_| ClientError::BadQr)?;
    let addr = SocketAddrV4::new(Ipv4Addr::from(payload.ipv4), payload.port);
    pair_at(addr, payload, own, name, on_code, cancelled)
}

fn pair_at(
    addr: SocketAddrV4,
    payload: qr::QrPayload,
    own: &StaticKey,
    name: &str,
    on_code: &mut dyn FnMut(&str),
    cancelled: &dyn Fn() -> bool,
) -> Result<Paired, ClientError> {
    let psk = Psk::from_secret(&payload.secret);
    let mut conn = Conn::connect(addr)?;
    let (init, m1) = noise::start_initiator(Mode::Pair, own, &payload.hub_key, Some(&psk))
        .map_err(|_| ClientError::Protocol)?;
    conn.write(&m1)?;
    let m2 = conn
        .read(PRE_CONFIRM_CAP, IO_TIMEOUT, cancelled)
        .map_err(|e| match e {
            ClientError::Cancelled => e,
            _ => ClientError::PairingNotPossible,
        })?;
    let (mut transport, sas) = match init.finish(&m2) {
        Ok(Finished::Established(t, sas)) => (t, sas),
        Ok(Finished::Refused(_)) | Err(_) => return Err(ClientError::PairingNotPossible),
    };
    let hello = transport
        .seal(TAG_HELLO, hello_name(name).as_bytes())
        .map_err(|_| ClientError::Protocol)?;
    conn.write(&hello)?;
    on_code(&sas.digits());
    let wire = conn
        .read(PRE_CONFIRM_CAP, CONFIRM_WAIT, cancelled)
        .map_err(|e| match e {
            ClientError::Network => ClientError::PairingAborted,
            other => other,
        })?;
    let (tag, body) = transport.open(&wire).map_err(|_| ClientError::Protocol)?;
    if tag != TAG_DATA_KEY || body.len() != 36 {
        return Err(ClientError::Protocol);
    }
    let data_key_version = u32::from_be_bytes([body[0], body[1], body[2], body[3]]);
    let mut data_key = Zeroizing::new([0u8; 32]);
    data_key.copy_from_slice(&body[4..36]);
    Ok(Paired {
        hub_key: payload.hub_key,
        addr,
        data_key_version,
        data_key,
    })
}

/// An open, authenticated session with the hub: JSON requests in, JSON answers out (one frame each).
pub struct Session {
    conn: Conn,
    transport: Transport,
}

impl std::fmt::Debug for Session {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Session(..)")
    }
}

impl Session {
    /// Connects, proves this device's key and checks the pinned hub key. `UnknownDevice` only for
    /// the hub's authenticated refusal.
    pub fn open(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        name: &str,
    ) -> Result<Session, ClientError> {
        if !qr::is_private_v4(addr.ip().octets()) {
            return Err(ClientError::Network);
        }
        Session::open_at(addr, own, hub, name)
    }

    fn open_at(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        name: &str,
    ) -> Result<Session, ClientError> {
        let mut conn = Conn::connect(addr)?;
        let (init, m1) = noise::start_initiator(Mode::Session, own, hub, None)
            .map_err(|_| ClientError::Protocol)?;
        conn.write(&m1)?;
        let m2 = conn.read(PRE_CONFIRM_CAP, IO_TIMEOUT, &|| false)?;
        let mut transport = match init.finish(&m2) {
            Ok(Finished::Established(t, _)) => t,
            Ok(Finished::Refused(_)) => return Err(ClientError::UnknownDevice),
            // not the hub (a reinstalled PC or somebody else on that address): calm, no claim
            Err(InitError::HubNotAuthentic) | Err(_) => return Err(ClientError::Network),
        };
        // the first frame stays under the hub's pre-confirm cap; the hub raises its cap after it
        let hello = transport
            .seal(TAG_HELLO, hello_name(name).as_bytes())
            .map_err(|_| ClientError::Protocol)?;
        conn.write(&hello)?;
        transport.raise_cap();
        Ok(Session { conn, transport })
    }

    /// One request (JSON, see `hub/handler.rs`) and its answer.
    pub fn request(&mut self, body: &[u8]) -> Result<Zeroizing<Vec<u8>>, ClientError> {
        let wire = self
            .transport
            .seal(TAG_REQUEST, body)
            .map_err(|_| ClientError::Protocol)?;
        self.conn.write(&wire)?;
        let answer = self.conn.read(MAX_FRAME, IO_TIMEOUT, &|| false)?;
        // an answer that does not decrypt is not the hub's: never retried as a network hiccup
        let (tag, body) = self
            .transport
            .open(&answer)
            .map_err(|_| ClientError::Protocol)?;
        if tag != TAG_RESPONSE {
            return Err(ClientError::Protocol);
        }
        Ok(body)
    }

    /// Tells the hub this device unpairs itself; the hub revokes its key and closes.
    pub fn unpair(mut self) -> Result<(), ClientError> {
        let wire = self
            .transport
            .seal(TAG_UNPAIR, &[])
            .map_err(|_| ClientError::Protocol)?;
        self.conn.write(&wire)
    }
}

/// One kept session and the "open again once" rule: a session the hub closed meanwhile (idle
/// timeout, restart) is replaced by a fresh one and the request sent again; any other failure is
/// handed back and the session dropped. Replaying a request is harmless: pushes are last-write-wins
/// and pulls read.
#[derive(Debug, Default)]
pub struct Link {
    session: Option<Session>,
}

impl Link {
    pub fn new() -> Self {
        Link { session: None }
    }

    pub fn request(
        &mut self,
        body: &[u8],
        open: &mut dyn FnMut() -> Result<Session, ClientError>,
    ) -> Result<Zeroizing<Vec<u8>>, ClientError> {
        for attempt in 0..2 {
            if self.session.is_none() {
                self.session = Some(open()?);
            }
            let Some(session) = self.session.as_mut() else {
                return Err(ClientError::Protocol);
            };
            match session.request(body) {
                Ok(answer) => return Ok(answer),
                Err(ClientError::Network) if attempt == 0 => self.session = None,
                Err(e) => {
                    self.session = None;
                    return Err(e);
                }
            }
        }
        Err(ClientError::Network)
    }

    /// Drops the kept session (before unpairing or pairing anew).
    pub fn close(&mut self) {
        self.session = None;
    }
}

pub(crate) struct Conn(TcpStream);

impl Conn {
    pub(crate) fn connect(addr: SocketAddrV4) -> Result<Conn, ClientError> {
        let s = TcpStream::connect_timeout(&addr.into(), CONNECT_TIMEOUT)
            .map_err(|_| ClientError::Network)?;
        s.set_nodelay(true).map_err(|_| ClientError::Network)?;
        s.set_write_timeout(Some(IO_TIMEOUT))
            .map_err(|_| ClientError::Network)?;
        s.set_read_timeout(Some(POLL))
            .map_err(|_| ClientError::Network)?;
        Ok(Conn(s))
    }

    /// A second handle on the same socket (the input client reads on its own thread).
    pub(crate) fn try_clone(&self) -> Result<Conn, ClientError> {
        self.0
            .try_clone()
            .map(Conn)
            .map_err(|_| ClientError::Network)
    }

    /// Ends the connection for both handles; a blocked read returns.
    pub(crate) fn shutdown(&self) {
        let _ = self.0.shutdown(std::net::Shutdown::Both);
    }

    pub(crate) fn write(&mut self, wire: &[u8]) -> Result<(), ClientError> {
        let len = u16::try_from(wire.len()).map_err(|_| ClientError::Protocol)?;
        let mut out = Vec::with_capacity(2 + wire.len());
        out.extend_from_slice(&len.to_be_bytes());
        out.extend_from_slice(wire);
        self.0.write_all(&out).map_err(|_| ClientError::Network)
    }

    /// One whole frame of at most `cap` bytes within `wait`; `cancelled` is polled between reads.
    pub(crate) fn read(
        &mut self,
        cap: usize,
        wait: Duration,
        cancelled: &dyn Fn() -> bool,
    ) -> Result<Vec<u8>, ClientError> {
        let began = Instant::now();
        let mut buf: Vec<u8> = Vec::new();
        loop {
            let want = match buf.len() {
                0 | 1 => 2 - buf.len(),
                n => {
                    let len = usize::from(u16::from_be_bytes([buf[0], buf[1]]));
                    if len == 0 || len > cap {
                        return Err(ClientError::Protocol);
                    }
                    (2 + len) - n
                }
            };
            if want == 0 {
                return Ok(buf.split_off(2));
            }
            if cancelled() {
                return Err(ClientError::Cancelled);
            }
            if began.elapsed() > wait {
                return Err(ClientError::Network);
            }
            let mut chunk = [0u8; 4096];
            let take = want.min(chunk.len());
            match self.0.read(&mut chunk[..take]) {
                Ok(0) => return Err(ClientError::Network),
                Ok(n) => buf.extend_from_slice(&chunk[..n]),
                Err(e) if matches!(e.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) => {}
                Err(e) if e.kind() == ErrorKind::Interrupted => {}
                Err(_) => return Err(ClientError::Network),
            }
        }
    }
}

/// Tests reach the hub on loopback (production code only ever dials private addresses).
#[cfg(all(test, feature = "store"))]
pub(crate) mod testing {
    use super::*;

    pub fn pair_via(
        addr: SocketAddrV4,
        qr_text: &str,
        own: &StaticKey,
        name: &str,
        on_code: &mut dyn FnMut(&str),
        cancelled: &dyn Fn() -> bool,
    ) -> Result<Paired, ClientError> {
        let payload = qr::decode(qr_text).map_err(|_| ClientError::BadQr)?;
        pair_at(addr, payload, own, name, on_code, cancelled)
    }

    pub fn open_via(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        name: &str,
    ) -> Result<Session, ClientError> {
        Session::open_at(addr, own, hub, name)
    }
}
