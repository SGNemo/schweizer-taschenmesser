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
//! * `InputError::NoAnswer`: the connection stood and the hub hung up on the first message
//!   without a word. That is what a hub from before remote control does with this mode – and also
//!   what any hub does when it is not the pinned one, or when it sheds load (too many first
//!   messages from one address). So: try again once; if it stays `NoAnswer` while a sync session
//!   opens, the PC's Nemo is too old. A connection that never stood, or a timeout, is `Network`
//!   and says nothing about the hub's age.
//! * `UnknownDevice` is the hub's authenticated refusal of the handshake. It means one of two
//!   things the hub does not tell apart on purpose: this device is not paired any more, or the hub
//!   takes no input where this connection came in (not the home network, or nothing wired). **The
//!   caller must never unpair or forget the hub because of it**; whether the device is still
//!   paired is what a sync session says.
//! * `Event::Closed(None)` covers an idle close, a lost connection and the hub closing without a
//!   reason (this device opened a newer session, its grant changed, the PC left the home network).
//!   The right reaction is the same every time: show the unconnected state and open again on the
//!   next touch – the answer to that `open` is the real state. A `Closed` from a session the
//!   caller has already replaced or closed is to be ignored.
//! * There is no heartbeat, but an answer: after frames came in, the hub sends its state within
//!   about half a second even if nothing changed. A PC that vanishes without closing (sleep,
//!   Wi-Fi gone) is therefore noticed by the caller as "sent something, heard nothing for a few
//!   seconds".
//! * `Protocol` from `open` also covers a refusal code this version does not know (a newer PC):
//!   show the unconnected state and offer to try again.
//! * Features: `open` asks for the features this side knows ([`wire::FEATURES`]); the `opened`
//!   names those the PC accepted (`Opened::ext`). A PC from before features closes on that `open`
//!   without a word – then the session is opened once more the old way (`ext: None`), so an
//!   updated phone keeps everything an older PC can do. Nothing of a feature is sent to a PC that
//!   did not accept it (`send_power` refuses with `Protocol`).
//! * A send error is never a state to show: `Closed` means this session is over (see its
//!   `Event::Closed`, or just open again), `Network` that the write failed.

use crate::client::{hello_name, ClientError, Conn, IO_TIMEOUT};
use crate::input::wire::{self, Code, Level, Opened, PcState, Power, PowerAnswer, Record};
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
    /// Not reachable, a timeout, or the connection dropped.
    Network,
    /// The connection stood and the first message was sent, then the hub closed without answering
    /// (an old hub, not the pinned hub, or a hub shedding load – see the module's header).
    NoAnswer,
    /// The hub authenticated itself and refused the handshake.
    UnknownDevice,
    /// The hub answered `open` with a reason.
    Refused(Code),
    /// A frame that does not belong to the protocol, or text the protocol does not carry.
    Protocol,
    /// A send on a session that is over. Not a state of its own: what happened is in the
    /// `Event::Closed` of that session, or in the answer to the next `open`.
    Closed,
}

/// What the PC says unasked. After `Closed` nothing follows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Event {
    State(PcState),
    /// About power: the answer to a `send_power`, or news of a countdown (it ran out, or it was
    /// stopped at the PC).
    Power(PowerAnswer),
    /// The session is over: with the PC's reason, or `None` when the connection was lost.
    Closed(Option<Code>),
}

/// The reader runs until the session ends; this is only how long one wait may last.
const READ_WAIT: Duration = Duration::from_secs(24 * 60 * 60);

pub struct InputSession {
    writer: Mutex<Conn>,
    /// A handle of its own for closing, so `close`/`Drop` never wait behind a blocked write.
    closer: Conn,
    transport: Arc<Mutex<Transport>>,
    /// Set by `close`/`Drop`: the reader stops without reporting anything.
    stop: Arc<AtomicBool>,
    /// Set by the reader when the session is over.
    over: Arc<AtomicBool>,
    reader: Option<JoinHandle<()>>,
    /// The features the PC accepted.
    features: u8,
}

/// Type of the event callback.
type OnEvent = Box<dyn FnMut(Event) + Send>;

/// Why one attempt failed, and whether the PC hung up on the `open` itself without a word.
struct Attempt {
    error: InputError,
    silent_after_open: bool,
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
    /// `features`: ask for the features this side knows; `false` for a PC known to be older.
    pub fn open(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        name: &str,
        level: Level,
        features: bool,
        on_event: Box<dyn FnMut(Event) + Send>,
    ) -> Result<(InputSession, Opened), InputError> {
        if !qr::is_private_v4(addr.ip().octets()) {
            return Err(InputError::Network);
        }
        Self::open_at(addr, own, hub, name, level, features, on_event)
    }

    /// With features first; a PC that hangs up on that `open` without a word is asked once more
    /// the old way.
    fn open_at(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        name: &str,
        level: Level,
        features: bool,
        on_event: OnEvent,
    ) -> Result<(InputSession, Opened), InputError> {
        let mut on_event = Some(on_event);
        // a PC known to be older is asked the old way at once (one handshake, not two)
        if !features {
            return Self::attempt(addr, own, hub, name, level, None, &mut on_event)
                .map_err(|a| a.error);
        }
        match Self::attempt(
            addr,
            own,
            hub,
            name,
            level,
            Some(wire::FEATURES),
            &mut on_event,
        ) {
            Err(Attempt {
                silent_after_open: true,
                ..
            }) => {
                Self::attempt(addr, own, hub, name, level, None, &mut on_event).map_err(|a| a.error)
            }
            other => other.map_err(|a| a.error),
        }
    }

    fn attempt(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        name: &str,
        level: Level,
        features: Option<u8>,
        on_event: &mut Option<OnEvent>,
    ) -> Result<(InputSession, Opened), Attempt> {
        let plain = |error| Attempt {
            error,
            silent_after_open: false,
        };
        let mut conn = Conn::connect(addr).map_err(net).map_err(plain)?;
        let (init, m1) = noise::start_initiator(Mode::Input, own, hub, None)
            .map_err(|_| plain(InputError::Protocol))?;
        conn.write(&m1).map_err(net).map_err(plain)?;
        let m2 = match conn.read(PRE_CONFIRM_CAP, IO_TIMEOUT, &|| false) {
            Ok(m2) => m2,
            Err(_) if conn.peer_closed() => return Err(plain(InputError::NoAnswer)),
            Err(_) => return Err(plain(InputError::Network)),
        };
        let mut transport = match init.finish(&m2) {
            Ok(Finished::Established(t, _)) => t,
            Ok(Finished::Refused(_)) => return Err(plain(InputError::UnknownDevice)),
            Err(_) => return Err(plain(InputError::Network)),
        };
        let hello = transport
            .seal(TAG_HELLO, hello_name(name).as_bytes())
            .map_err(|_| plain(InputError::Protocol))?;
        conn.write(&hello).map_err(net).map_err(plain)?;
        transport.raise_cap();
        let open = transport
            .seal(wire::TAG_OPEN, &wire::encode_open(level, features))
            .map_err(|_| plain(InputError::Protocol))?;
        conn.write(&open).map_err(net).map_err(plain)?;
        let answer = match conn.read(INPUT_CAP, IO_TIMEOUT, &|| false) {
            Ok(a) => a,
            // a PC from before features closes on the longer `open` without a word
            Err(_) if conn.peer_closed() && features.is_some() => {
                return Err(Attempt {
                    error: InputError::Network,
                    silent_after_open: true,
                })
            }
            Err(_) => return Err(plain(InputError::Network)),
        };
        let (tag, body) = transport
            .open(&answer)
            .map_err(|_| plain(InputError::Protocol))?;
        let opened = match tag {
            wire::TAG_OPENED => {
                wire::decode_opened(&body).map_err(|_| plain(InputError::Protocol))?
            }
            wire::TAG_REFUSED => {
                return Err(plain(
                    wire::decode_code(&body).map_or(InputError::Protocol, InputError::Refused),
                ))
            }
            _ => return Err(plain(InputError::Protocol)),
        };
        // an `opened` must answer what was asked: features only to a features `open`, and only
        // those that were asked for
        let accepted = match (features, opened.ext) {
            (None, None) => 0,
            (Some(asked), Some(ext)) if ext.features & !asked == 0 => ext.features,
            _ => return Err(plain(InputError::Protocol)),
        };
        let Some(on_event) = on_event.take() else {
            return Err(plain(InputError::Protocol));
        };

        let read_half = conn.try_clone().map_err(net).map_err(plain)?;
        let closer = conn.try_clone().map_err(net).map_err(plain)?;
        let transport = Arc::new(Mutex::new(transport));
        let stop = Arc::new(AtomicBool::new(false));
        let over = Arc::new(AtomicBool::new(false));
        let reader = {
            let (transport, stop, over) = (transport.clone(), stop.clone(), over.clone());
            std::thread::Builder::new()
                .name("lan-input-read".into())
                .spawn(move || read_loop(read_half, &transport, &stop, &over, on_event))
                .map_err(|_| plain(InputError::Network))?
        };
        Ok((
            InputSession {
                writer: Mutex::new(conn),
                closer,
                transport,
                stop,
                over,
                reader: Some(reader),
                features: accepted,
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
        // monitor off only to a PC that accepted power (an older one would close the session)
        if !self.has_power() && records.contains(&Record::Media(wire::Media::MonitorOff)) {
            return Err(InputError::Protocol);
        }
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

    /// Whether the PC accepted power (power frames, monitor off, the power answer).
    pub fn has_power(&self) -> bool {
        self.features & wire::FEATURE_POWER != 0
    }

    /// Sends one power action. Its answer comes as `Event::Power`. `Protocol` on a PC that did
    /// not accept power.
    pub fn send_power(&self, power: Power, despite: bool) -> Result<(), InputError> {
        if !self.has_power() {
            return Err(InputError::Protocol);
        }
        if despite && power == Power::Cancel {
            return Err(InputError::Protocol);
        }
        self.send(wire::TAG_POWER, &wire::encode_power(power, despite))
    }

    fn send(&self, tag: u8, body: &[u8]) -> Result<(), InputError> {
        if self.is_over() {
            return Err(InputError::Closed);
        }
        // the writer lock spans "seal, then write", so frames leave in the order of their nonces
        let mut writer = self.writer.lock().map_err(|_| InputError::Network)?;
        let sealed = {
            let mut t = self.transport.lock().map_err(|_| InputError::Network)?;
            t.seal(tag, body).map_err(|_| InputError::Protocol)?
        };
        writer.write(&sealed).map_err(|e| {
            if self.is_over() {
                InputError::Closed
            } else {
                net(e)
            }
        })
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
        self.closer.shutdown();
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
            wire::TAG_POWER_ANSWER => match wire::decode_power_answer(&body) {
                Ok(answer) => on_event(Event::Power(answer)),
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
        InputSession::open_at(addr, own, hub, "Phone", level, true, on_event)
    }

    /// The old way (no features byte), as a phone does with a PC it knows to be older.
    pub fn open_plain(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        level: Level,
        on_event: Box<dyn FnMut(Event) + Send>,
    ) -> Result<(InputSession, Opened), InputError> {
        InputSession::open_at(addr, own, hub, "Phone", level, false, on_event)
    }
}
