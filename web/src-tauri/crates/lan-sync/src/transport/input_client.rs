//! The device side of remote control: one input session with the hub (`crate::input`).
//!
//! * Own TCP connection and own Noise handshake (`Mode::Input`), apart from the sync session: input
//!   never waits for a sync request, and the two never share a frame.
//! * Duplex. The caller's thread writes (`send_events`, `send_text`); a reader thread delivers what
//!   the PC says unasked (its state, or why it closed). The Noise state is one object for both
//!   directions (the stateful `TransportState`), so it sits behind a mutex that is held only to
//!   seal or to open one frame – never across a read or a write on the socket. A second mutex keeps
//!   "seal, then write" of two senders in the order of their nonces.
//! * Only private IPv4 addresses are dialled. Nothing is logged or formatted: no address, no
//!   frame, no event.
//! * What an old hub does with this mode is drop it without a word, which looks like "not
//!   reachable" here (`InputError::Network`); the caller tells the two apart by trying a sync
//!   session. `UnknownDevice` is the hub's authenticated refusal: this device is not paired any
//!   more, or the hub accepts no input on the network the connection came in on.

use crate::client::{hello_name, ClientError, Conn, IO_TIMEOUT};
use crate::input::wire::{self, Code, Level, Opened, PcState, Record};
use crate::noise::frame::{INPUT_CAP, PRE_CONFIRM_CAP, TAG_HELLO};
use crate::noise::{self, Finished, Mode, PublicKey, StaticKey, Transport};
use crate::qr;
use std::net::SocketAddrV4;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

/// Why an input session could not be opened or used. Carries no bytes and no address.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputError {
    /// Not reachable, no answer, or the connection dropped.
    Network,
    /// The hub authenticated itself and refused the handshake.
    UnknownDevice,
    /// The hub answered `open` with a reason.
    Refused(Code),
    /// A frame that does not belong to the protocol, or text the protocol does not carry.
    Protocol,
}

/// What the PC says unasked. After `Closed` nothing follows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Event {
    State(PcState),
    /// The session is over: with the PC's reason, or `None` when the connection was lost.
    Closed(Option<Code>),
}

/// The reader runs until the session ends; this is only how long one wait may last.
const READ_WAIT: Duration = Duration::from_secs(24 * 60 * 60);

pub struct InputSession {
    writer: Mutex<Conn>,
    transport: Arc<Mutex<Transport>>,
    /// Set by `close`/`Drop`: the reader stops without reporting anything.
    stop: Arc<AtomicBool>,
    /// Set by the reader when the session is over.
    over: Arc<AtomicBool>,
    reader: Option<JoinHandle<()>>,
}

impl std::fmt::Debug for InputSession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("InputSession(..)")
    }
}

fn net(e: ClientError) -> InputError {
    match e {
        ClientError::Protocol => InputError::Protocol,
        _ => InputError::Network,
    }
}

impl InputSession {
    /// Connects, proves this device's key, checks the pinned hub key and asks for `level`. The
    /// answer says which level the session really has (never more than the PC granted).
    /// `on_event` is called on the reader thread.
    pub fn open(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        name: &str,
        level: Level,
        on_event: Box<dyn FnMut(Event) + Send>,
    ) -> Result<(InputSession, Opened), InputError> {
        if !qr::is_private_v4(addr.ip().octets()) {
            return Err(InputError::Network);
        }
        Self::open_at(addr, own, hub, name, level, on_event)
    }

    fn open_at(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        name: &str,
        level: Level,
        on_event: Box<dyn FnMut(Event) + Send>,
    ) -> Result<(InputSession, Opened), InputError> {
        let mut conn = Conn::connect(addr).map_err(net)?;
        let (init, m1) = noise::start_initiator(Mode::Input, own, hub, None)
            .map_err(|_| InputError::Protocol)?;
        conn.write(&m1).map_err(net)?;
        let m2 = conn
            .read(PRE_CONFIRM_CAP, IO_TIMEOUT, &|| false)
            .map_err(|_| InputError::Network)?;
        let mut transport = match init.finish(&m2) {
            Ok(Finished::Established(t, _)) => t,
            Ok(Finished::Refused(_)) => return Err(InputError::UnknownDevice),
            Err(_) => return Err(InputError::Network),
        };
        let hello = transport
            .seal(TAG_HELLO, hello_name(name).as_bytes())
            .map_err(|_| InputError::Protocol)?;
        conn.write(&hello).map_err(net)?;
        transport.raise_cap();
        let open = transport
            .seal(wire::TAG_OPEN, &wire::encode_open(level))
            .map_err(|_| InputError::Protocol)?;
        conn.write(&open).map_err(net)?;
        let answer = conn
            .read(INPUT_CAP, IO_TIMEOUT, &|| false)
            .map_err(|_| InputError::Network)?;
        let (tag, body) = transport.open(&answer).map_err(|_| InputError::Protocol)?;
        let opened = match tag {
            wire::TAG_OPENED => wire::decode_opened(&body).map_err(|_| InputError::Protocol)?,
            wire::TAG_REFUSED => {
                return Err(
                    wire::decode_code(&body).map_or(InputError::Protocol, InputError::Refused)
                )
            }
            _ => return Err(InputError::Protocol),
        };

        let read_half = conn.try_clone().map_err(net)?;
        let transport = Arc::new(Mutex::new(transport));
        let stop = Arc::new(AtomicBool::new(false));
        let over = Arc::new(AtomicBool::new(false));
        let reader = {
            let (transport, stop, over) = (transport.clone(), stop.clone(), over.clone());
            std::thread::Builder::new()
                .name("lan-input-read".into())
                .spawn(move || read_loop(read_half, &transport, &stop, &over, on_event))
                .map_err(|_| InputError::Network)?
        };
        Ok((
            InputSession {
                writer: Mutex::new(conn),
                transport,
                stop,
                over,
                reader: Some(reader),
            },
            opened,
        ))
    }

    /// Whether the session ended (the PC closed it or the connection was lost).
    pub fn is_over(&self) -> bool {
        self.over.load(Ordering::SeqCst)
    }

    /// Sends the records in order, at most 32 per frame. No answer comes back.
    pub fn send_events(&self, records: &[Record]) -> Result<(), InputError> {
        for chunk in records.chunks(wire::MAX_RECORDS) {
            let body = wire::encode_events(chunk).ok_or(InputError::Protocol)?;
            self.send(wire::TAG_EVENTS, &body)?;
        }
        Ok(())
    }

    /// Sends one piece of text (at most 256 bytes, no control characters; a line break is the key
    /// `Enter`).
    pub fn send_text(&self, text: &str) -> Result<(), InputError> {
        wire::check_text(text.as_bytes()).map_err(|_| InputError::Protocol)?;
        self.send(wire::TAG_TEXT, text.as_bytes())
    }

    fn send(&self, tag: u8, body: &[u8]) -> Result<(), InputError> {
        if self.is_over() {
            return Err(InputError::Network);
        }
        // the writer lock spans "seal, then write", so frames leave in the order of their nonces
        let mut writer = self.writer.lock().map_err(|_| InputError::Network)?;
        let sealed = {
            let mut t = self.transport.lock().map_err(|_| InputError::Network)?;
            t.seal(tag, body).map_err(|_| InputError::Protocol)?
        };
        writer.write(&sealed).map_err(net)
    }

    /// Ends the session and waits for the reader thread. `on_event` is not called for this.
    pub fn close(mut self) {
        self.shut();
        if let Some(h) = self.reader.take() {
            let _ = h.join();
        }
    }

    fn shut(&self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Ok(w) = self.writer.lock() {
            w.shutdown();
        }
    }
}

impl Drop for InputSession {
    /// Dropping ends the session too; the reader thread notices on its own and is not waited for
    /// (a drop may happen inside `on_event`).
    fn drop(&mut self) {
        self.shut();
    }
}

fn read_loop(
    mut conn: Conn,
    transport: &Mutex<Transport>,
    stop: &AtomicBool,
    over: &AtomicBool,
    mut on_event: Box<dyn FnMut(Event) + Send>,
) {
    let stopped = || stop.load(Ordering::SeqCst);
    let end = loop {
        // blocks on the socket without holding any lock
        let wire = match conn.read(INPUT_CAP, READ_WAIT, &stopped) {
            Ok(w) => w,
            Err(_) => break None,
        };
        let frame = match transport.lock() {
            Ok(mut t) => t.open(&wire),
            Err(_) => break None,
        };
        let Ok((tag, body)) = frame else {
            break None;
        };
        match tag {
            wire::TAG_STATE => match wire::decode_state(&body) {
                Ok(state) => on_event(Event::State(state)),
                Err(_) => break None,
            },
            wire::TAG_CLOSED => break wire::decode_code(&body).ok(),
            _ => break None,
        }
    };
    over.store(true, Ordering::SeqCst);
    conn.shutdown();
    if !stopped() {
        on_event(Event::Closed(end));
    }
}

/// Tests reach the hub on loopback (production code only ever dials private addresses).
#[cfg(all(test, feature = "store"))]
pub(crate) mod testing {
    use super::*;

    pub fn open_via(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        level: Level,
        on_event: Box<dyn FnMut(Event) + Send>,
    ) -> Result<(InputSession, Opened), InputError> {
        InputSession::open_at(addr, own, hub, "Phone", level, on_event)
    }
}
