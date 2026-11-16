//! The device side of device exchange: one exchange session with the hub (`crate::exchange`).
//!
//! * Own TCP connection and own Noise handshake (`Mode::Exchange`), apart from sync and input.
//! * Duplex. The caller's thread writes (`send_item`, `ack`, `ping`); a reader thread delivers what
//!   the PC sends (items it queued for this device, acks of this device's items, or why it closed).
//!   The Noise state sits behind a mutex held only to seal or open one frame, never across socket
//!   I/O; a second mutex keeps "seal, then write" of two senders in nonce order (as the input
//!   client).
//! * **Acks:** an `Event::Item` must be stored by the caller first, then answered with
//!   `ack(id, Stored)` (or `Refused` when it cannot keep it); the PC sends its next item only after
//!   that answer. An item of this device counts as delivered only on `Event::Ack(id, Stored)`;
//!   `Rejected` means the PC cannot take it (show „Kam nicht an“, do not send it again), `Refused`
//!   that the PC is full (keep it, send it again later).
//! * **At least once:** after a lost ack the same id may come (and must be sent) again; both sides
//!   store an id once.
//! * **Keep-alive is the caller's:** it decides how long the session lives (page visible, a
//!   hand-over running) and pings at least every 60 s for that time; after `Refused` on a PC item
//!   a ping also asks the PC to offer it again.
//! * **Keep it open:** the hub closes a session after 120 s without a frame from this side. The
//!   caller sends `ping` at least every 60 s for as long as it wants the session (the page is
//!   visible, or a hand-over runs).
//! * Only private IPv4 addresses are dialled. Nothing is logged or formatted.
//! * `UnknownDevice` (authenticated refusal of the handshake) means: not paired any more, **or**
//!   not on the home network, **or** a PC without device exchange. Never unpair because of it;
//!   whether the device is paired is what a sync session says. `NoAnswer`: the connection stood
//!   and the PC hung up without a word (a PC from before device exchange, or one shedding load).
//! * `Event::Closed(None)` covers an idle close, a lost connection and the PC closing without a
//!   reason (a newer exchange session of this device replaced it, the PC left the home network).
//!   Open again on the next trigger; the answer to that `open` is the real state.

use crate::client::{hello_name, ClientError, Conn, IO_TIMEOUT};
use crate::exchange::wire::{self, AckState, Code, Item, ItemError};
use crate::noise::frame::{MAX_FRAME, PRE_CONFIRM_CAP, TAG_HELLO};
use crate::noise::{self, Finished, Mode, PublicKey, StaticKey, Transport};
use crate::qr;
use std::net::SocketAddrV4;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

/// Why an exchange session could not be opened or used. Carries no bytes and no address.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExchangeError {
    /// Not reachable, a timeout, or the connection dropped.
    Network,
    /// The connection stood and the first message was sent, then the hub closed without answering.
    NoAnswer,
    /// The hub authenticated itself and refused the handshake (see the module's header).
    UnknownDevice,
    /// The hub answered `open` with a reason.
    Refused(Code),
    /// A frame that does not belong to the protocol, or an item the protocol does not carry.
    Protocol,
    /// A send on a session that is over.
    Closed,
}

/// What the PC sends. After `Closed` nothing follows.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Event {
    /// An item the PC queued for this device: store it, then `ack` it. Delivery is at least once:
    /// an id this device already stored is acked `Stored` again without a second card.
    Item(Item),
    /// An item with a readable id that this version cannot take: answer `ack(id, Rejected)`, so
    /// it leaves the PC's queue instead of blocking it.
    Unusable([u8; 16]),
    /// The PC's answer to an item of this device.
    Ack([u8; 16], AckState),
    /// The session is over: with the PC's reason, or `None` when the connection was lost.
    Closed(Option<Code>),
}

/// The reader runs until the session ends; this is only how long one wait may last.
const READ_WAIT: Duration = Duration::from_secs(24 * 60 * 60);

type OnEvent = Box<dyn FnMut(Event) + Send>;

pub struct ExchangeSession {
    writer: Mutex<Conn>,
    closer: Conn,
    transport: Arc<Mutex<Transport>>,
    stop: Arc<AtomicBool>,
    over: Arc<AtomicBool>,
    reader: Option<JoinHandle<()>>,
}

impl std::fmt::Debug for ExchangeSession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("ExchangeSession(..)")
    }
}

fn net(e: ClientError) -> ExchangeError {
    match e {
        ClientError::Protocol => ExchangeError::Protocol,
        _ => ExchangeError::Network,
    }
}

impl ExchangeSession {
    /// Connects, proves this device's key, checks the pinned hub key and opens the session.
    /// `on_event` is called on the reader thread.
    pub fn open(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        name: &str,
        on_event: OnEvent,
    ) -> Result<ExchangeSession, ExchangeError> {
        if !qr::is_private_v4(addr.ip().octets()) {
            return Err(ExchangeError::Network);
        }
        Self::open_at(addr, own, hub, name, on_event)
    }

    fn open_at(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        name: &str,
        on_event: OnEvent,
    ) -> Result<ExchangeSession, ExchangeError> {
        let mut conn = Conn::connect(addr).map_err(net)?;
        let (init, m1) = noise::start_initiator(Mode::Exchange, own, hub, None)
            .map_err(|_| ExchangeError::Protocol)?;
        conn.write(&m1).map_err(net)?;
        let m2 = match conn.read(PRE_CONFIRM_CAP, IO_TIMEOUT, &|| false) {
            Ok(m2) => m2,
            Err(_) if conn.peer_closed() => return Err(ExchangeError::NoAnswer),
            Err(_) => return Err(ExchangeError::Network),
        };
        let mut transport = match init.finish(&m2) {
            Ok(Finished::Established(t, _)) => t,
            Ok(Finished::Refused(_)) => return Err(ExchangeError::UnknownDevice),
            Err(_) => return Err(ExchangeError::Network),
        };
        let hello = transport
            .seal(TAG_HELLO, hello_name(name).as_bytes())
            .map_err(|_| ExchangeError::Protocol)?;
        conn.write(&hello).map_err(net)?;
        transport.raise_cap();
        let open = transport
            .seal(wire::TAG_OPEN, &wire::encode_open(wire::FEATURES))
            .map_err(|_| ExchangeError::Protocol)?;
        conn.write(&open).map_err(net)?;
        let answer = match conn.read(MAX_FRAME, IO_TIMEOUT, &|| false) {
            Ok(a) => a,
            Err(_) if conn.peer_closed() => return Err(ExchangeError::NoAnswer),
            Err(_) => return Err(ExchangeError::Network),
        };
        let (tag, body) = transport
            .open(&answer)
            .map_err(|_| ExchangeError::Protocol)?;
        match tag {
            wire::TAG_OPENED => {
                let accepted = wire::decode_opened(&body).map_err(|_| ExchangeError::Protocol)?;
                // an `opened` names only features that were asked for
                if accepted & !wire::FEATURES != 0 {
                    return Err(ExchangeError::Protocol);
                }
            }
            wire::TAG_REFUSED => {
                return Err(wire::decode_code(&body)
                    .map_or(ExchangeError::Protocol, ExchangeError::Refused))
            }
            _ => return Err(ExchangeError::Protocol),
        }

        let read_half = conn.try_clone().map_err(net)?;
        let closer = conn.try_clone().map_err(net)?;
        let transport = Arc::new(Mutex::new(transport));
        let stop = Arc::new(AtomicBool::new(false));
        let over = Arc::new(AtomicBool::new(false));
        let reader = {
            let (transport, stop, over) = (transport.clone(), stop.clone(), over.clone());
            std::thread::Builder::new()
                .name("lan-exchange-read".into())
                .spawn(move || read_loop(read_half, &transport, &stop, &over, on_event))
                .map_err(|_| ExchangeError::Network)?
        };
        Ok(ExchangeSession {
            writer: Mutex::new(conn),
            closer,
            transport,
            stop,
            over,
            reader: Some(reader),
        })
    }

    /// Whether the session ended (the PC closed it or the connection was lost).
    pub fn is_over(&self) -> bool {
        self.over.load(Ordering::SeqCst)
    }

    /// Sends one item; its answer comes as `Event::Ack`.
    pub fn send_item(&self, item: &Item) -> Result<(), ExchangeError> {
        self.send(wire::TAG_ITEM, &wire::encode_item(item))
    }

    /// Answers an item of the PC – `Stored` only once it is kept on this device.
    pub fn ack(&self, id: &[u8; 16], state: AckState) -> Result<(), ExchangeError> {
        self.send(wire::TAG_ACK, &wire::encode_ack(id, state))
    }

    /// Keeps the session against the hub's idle close; at least every 60 s while it is wanted.
    pub fn ping(&self) -> Result<(), ExchangeError> {
        self.send(wire::TAG_PING, &[])
    }

    fn send(&self, tag: u8, body: &[u8]) -> Result<(), ExchangeError> {
        if self.is_over() {
            return Err(ExchangeError::Closed);
        }
        // the writer lock spans "seal, then write", so frames leave in the order of their nonces
        let mut writer = self.writer.lock().map_err(|_| ExchangeError::Network)?;
        let sealed = {
            let mut t = self.transport.lock().map_err(|_| ExchangeError::Network)?;
            t.seal(tag, body).map_err(|_| ExchangeError::Protocol)?
        };
        writer.write(&sealed).map_err(|e| {
            if self.is_over() {
                ExchangeError::Closed
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

impl Drop for ExchangeSession {
    /// Dropping ends the session too; the reader thread notices on its own and is not waited for.
    fn drop(&mut self) {
        self.shut();
    }
}

fn read_loop(
    mut conn: Conn,
    transport: &Mutex<Transport>,
    stop: &AtomicBool,
    over: &AtomicBool,
    mut on_event: OnEvent,
) {
    let stopped = || stop.load(Ordering::SeqCst);
    let end = loop {
        // blocks on the socket without holding any lock
        let wire = match conn.read(MAX_FRAME, READ_WAIT, &stopped) {
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
        match event_of(tag, &body) {
            Ok(event) => on_event(event),
            Err(end) => break end,
        }
    };
    over.store(true, Ordering::SeqCst);
    conn.shutdown();
    if !stopped() {
        on_event(Event::Closed(end));
    }
}

/// One frame of the PC as an event, or the end of the session (with the PC's reason if it said one).
fn event_of(tag: u8, body: &[u8]) -> Result<Event, Option<Code>> {
    match tag {
        wire::TAG_ITEM => match wire::decode_item(body) {
            Ok(item) => Ok(Event::Item(item)),
            Err(ItemError::Unusable(id)) => Ok(Event::Unusable(id)),
            Err(ItemError::Broken) => Err(None),
        },
        wire::TAG_ACK => wire::decode_ack(body)
            .map(|(id, s)| Event::Ack(id, s))
            .map_err(|_| None),
        wire::TAG_REFUSED => Err(wire::decode_code(body).ok()),
        _ => Err(None),
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
        on_event: OnEvent,
    ) -> Result<ExchangeSession, ExchangeError> {
        ExchangeSession::open_at(addr, own, hub, "Phone", on_event)
    }
}
