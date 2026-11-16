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
//! * **Keep-alive is the caller's:** the hub closes a session after 120 s without a frame from this
//!   side. The caller decides how long the session lives (page visible, a hand-over running) and
//!   pings at least every 60 s for that time; after `Refused` on a PC item a ping also asks the PC
//!   to offer it again.
//! * **Files** (`open_with(FEATURE_FILES)`): one active offer of this device at a time – the next
//!   only after the PC's `Refuse`, `Result` or `Wait` (up to three may wait for the PC's user) or
//!   after `cancel`; `offer`, `chunk` and `end` refuse locally what the PC would not take. Every
//!   file frame of the PC is checked here before it becomes an event (chunks only for an accepted
//!   offer, contiguous, within its size; answers only for this device's own offers; at most three
//!   standing PC offers, also while a file streams); frames that crossed an end are dropped.
//! * **`on_event` must not block**: it runs on the only reader thread. Hand chunks to another
//!   thread for writing and never call a sender from inside it, or both sides stall until the
//!   write timeout. Ping during a long download too: the hub's idle timer counts only frames
//!   from this side.
//! * Only private IPv4 addresses are dialled. Nothing is logged or formatted.
//! * `UnknownDevice` (authenticated refusal of the handshake) means: not paired any more, **or**
//!   not on the home network, **or** a PC without device exchange. Never unpair because of it;
//!   whether the device is paired is what a sync session says. `NoAnswer`: the connection stood
//!   and the PC hung up without a word (a PC from before device exchange, or one shedding load).
//! * `Event::Closed(None)` covers an idle close, a lost connection and the PC closing without a
//!   reason (a newer exchange session of this device replaced it, the PC left the home network).
//!   Open again on the next trigger; the answer to that `open` is the real state.

use crate::client::{hello_name, ClientError, Conn, IO_TIMEOUT};
use crate::exchange::wire::{
    self, AckState, ChunkBytes, Code, Item, ItemError, Offer, RefuseCode, ResultCode, WaitReason,
};
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
    // ---- files, only on a session opened with `FEATURE_FILES` that the PC accepted ----
    /// The PC offers a file (its name is raw: clean it before any use). Answer `accept`, `wait`
    /// or `refuse`.
    Offer(Offer),
    /// An offer of the PC this side cannot take: answer `refuse` with this code.
    BadOffer([u8; 16], RefuseCode),
    /// The PC takes this device's file from the offset: send chunks from there.
    Accept([u8; 16], u64),
    /// The PC's user decides first; `Accept` or `Refuse` follows later.
    Wait([u8; 16], WaitReason),
    Refuse([u8; 16], RefuseCode),
    /// Bytes of the PC's file at an offset (contiguous; check that before writing).
    Chunk([u8; 16], u64, ChunkBytes),
    /// Every byte of the PC's file is out: check length and hash, answer `result`.
    End([u8; 16]),
    /// The PC's answer to this device's file.
    Result([u8; 16], ResultCode),
    /// The PC cancelled a transfer (either direction).
    Cancel([u8; 16]),
}

/// The reader runs until the session ends; this is only how long one wait may last.
const READ_WAIT: Duration = Duration::from_secs(24 * 60 * 60);

type OnEvent = Box<dyn FnMut(Event) + Send>;

pub struct ExchangeSession {
    /// The PC accepted files on this session.
    files: bool,
    /// What the PC may send next about files (shared with the reader thread).
    guard: Arc<Mutex<Guard>>,
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
        Self::open_with(addr, own, hub, name, 0, on_event)
    }

    /// As [`open`](Self::open), asking for `features` (`wire::FEATURE_FILES`); whether the PC
    /// accepted them is [`files`](Self::files).
    pub fn open_with(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        name: &str,
        features: u8,
        on_event: OnEvent,
    ) -> Result<ExchangeSession, ExchangeError> {
        if !qr::is_private_v4(addr.ip().octets()) {
            return Err(ExchangeError::Network);
        }
        Self::open_at(addr, own, hub, name, features, on_event)
    }

    fn open_at(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        name: &str,
        features: u8,
        on_event: OnEvent,
    ) -> Result<ExchangeSession, ExchangeError> {
        let asked = features & wire::FEATURES;
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
            .seal(wire::TAG_OPEN, &wire::encode_open(asked))
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
        let files = match tag {
            wire::TAG_OPENED => {
                let accepted = wire::decode_opened(&body).map_err(|_| ExchangeError::Protocol)?;
                // an `opened` names only features that were asked for
                if accepted & !asked != 0 {
                    return Err(ExchangeError::Protocol);
                }
                accepted & wire::FEATURE_FILES != 0
            }
            wire::TAG_REFUSED => {
                return Err(wire::decode_code(&body)
                    .map_or(ExchangeError::Protocol, ExchangeError::Refused))
            }
            _ => return Err(ExchangeError::Protocol),
        };

        let read_half = conn.try_clone().map_err(net)?;
        let closer = conn.try_clone().map_err(net)?;
        let transport = Arc::new(Mutex::new(transport));
        let stop = Arc::new(AtomicBool::new(false));
        let over = Arc::new(AtomicBool::new(false));
        let guard = Arc::new(Mutex::new(Guard::default()));
        let reader = {
            let (transport, stop, over, guard) =
                (transport.clone(), stop.clone(), over.clone(), guard.clone());
            std::thread::Builder::new()
                .name("lan-exchange-read".into())
                .spawn(move || {
                    let files = files.then_some(&*guard);
                    read_loop(read_half, &transport, &stop, &over, files, on_event)
                })
                .map_err(|_| ExchangeError::Network)?
        };
        Ok(ExchangeSession {
            files,
            guard,
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

    /// Whether the PC accepted files on this session.
    pub fn files(&self) -> bool {
        self.files
    }

    /// Offers one of this device's files; the PC answers `Accept`, `Wait` or `Refuse`. One at a
    /// time (see the module's header): the next only after that answer ended it or it waits.
    pub fn offer(&self, offer: &Offer) -> Result<(), ExchangeError> {
        if !self.files {
            return Err(ExchangeError::Protocol);
        }
        if !self.with_guard(|g| g.offering(offer.id(), offer.size()))? {
            return Err(ExchangeError::Protocol);
        }
        self.file(wire::TAG_OFFER, &wire::encode_offer(offer))
    }

    /// Takes the PC's file from `from` (`> 0` resumes a part this device kept).
    pub fn accept(&self, id: &[u8; 16], from: u64) -> Result<(), ExchangeError> {
        // only an offer that stands, one at a time, from inside the file
        if !self.with_guard(|g| g.accepted(id, from))? {
            return Err(ExchangeError::Protocol);
        }
        self.file(wire::TAG_ACCEPT, &wire::encode_accept(id, from))
    }

    pub fn wait(&self, id: &[u8; 16], reason: WaitReason) -> Result<(), ExchangeError> {
        self.file(wire::TAG_WAIT, &wire::encode_wait(id, reason))
    }

    pub fn refuse(&self, id: &[u8; 16], code: RefuseCode) -> Result<(), ExchangeError> {
        self.with_guard(|g| g.dropped(id))?;
        self.file(wire::TAG_REFUSE, &wire::encode_refuse(id, code))
    }

    /// One chunk of this device's file (at most `wire::MAX_CHUNK` bytes, contiguous).
    pub fn chunk(&self, id: &[u8; 16], offset: u64, bytes: &[u8]) -> Result<(), ExchangeError> {
        let body = wire::encode_chunk(id, offset, bytes).ok_or(ExchangeError::Protocol)?;
        if !self.with_guard(|g| g.sending(id, false))? {
            return Err(ExchangeError::Protocol);
        }
        self.file(wire::TAG_CHUNK, &body)
    }

    pub fn end(&self, id: &[u8; 16]) -> Result<(), ExchangeError> {
        if !self.with_guard(|g| g.sending(id, true))? {
            return Err(ExchangeError::Protocol);
        }
        self.file(wire::TAG_END, id)
    }

    /// This device's answer to the PC's file (after `End`, or early when it cannot go on).
    pub fn result(&self, id: &[u8; 16], code: ResultCode) -> Result<(), ExchangeError> {
        self.with_guard(|g| g.dropped(id))?;
        self.file(wire::TAG_RESULT, &wire::encode_result(id, code))
    }

    /// Cancels a transfer in either direction (or withdraws an offer waiting for its user).
    pub fn cancel(&self, id: &[u8; 16]) -> Result<(), ExchangeError> {
        self.with_guard(|g| g.dropped(id))?;
        self.file(wire::TAG_CANCEL, id)
    }

    fn with_guard<T>(&self, f: impl FnOnce(&mut Guard) -> T) -> Result<T, ExchangeError> {
        let mut g = self.guard.lock().map_err(|_| ExchangeError::Network)?;
        Ok(f(&mut g))
    }

    fn file(&self, tag: u8, body: &[u8]) -> Result<(), ExchangeError> {
        if !self.files {
            return Err(ExchangeError::Protocol);
        }
        self.send(tag, body)
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
    files: Option<&Mutex<Guard>>,
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
        let event = match event_of(tag, &body, files.is_some()) {
            Ok(event) => event,
            Err(end) => break end,
        };
        let pass = match files.map(Mutex::lock) {
            None => Pass::Yes,
            Some(Ok(mut g)) => g.check(&event),
            Some(Err(_)) => Pass::Broken,
        };
        match pass {
            Pass::Yes => on_event(event),
            Pass::Drop => {}
            Pass::Broken => break None,
        }
    };
    over.store(true, Ordering::SeqCst);
    conn.shutdown();
    if !stopped() {
        on_event(Event::Closed(end));
    }
}

/// Offers of the PC that may wait for this device's user at once.
const PENDING_OFFERS: usize = 3;
/// Ended transfers remembered (late frames for them are dropped).
const ENDED_KEPT: usize = 64;

/// What the PC may send next about files, in both directions, so the caller never acts on a
/// frame that does not fit: the PC's offers that stand (up to three), the one PC file this device
/// accepted, this device's own offer and file, and the transfers that ended (frames that crossed
/// an end are dropped). A PC that sends chunks out of order, past the size or for nothing
/// accepted, answers an offer this device never made, or offers a fourth file ends the session.
#[derive(Default)]
struct Guard {
    /// The PC's offers that stand: id and size.
    offers: Vec<([u8; 16], u64)>,
    /// The PC's file this device accepted: id, size, where the next chunk starts.
    incoming: Option<([u8; 16], u64, u64)>,
    /// This device's offers and files: id, size, state.
    own: Vec<([u8; 16], u64, Own)>,
    ended: Vec<[u8; 16]>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Own {
    /// Offered; the PC answers.
    Offered,
    /// The PC's user decides.
    Waiting,
    /// The PC accepted: chunks go out.
    Streaming,
    /// `end` is out; the PC answers with `result`.
    Ended,
}

#[derive(Debug, PartialEq, Eq)]
enum Pass {
    Yes,
    /// It crossed an end on the wire: not passed on.
    Drop,
    Broken,
}

impl Guard {
    fn check(&mut self, event: &Event) -> Pass {
        match event {
            Event::Offer(o) => {
                let id = *o.id();
                // an offer may come while a file streams (it crossed an accept): bounded only
                if self.offers.len() >= PENDING_OFFERS || self.offers.iter().any(|(x, _)| *x == id)
                {
                    return Pass::Broken;
                }
                self.ended.retain(|e| *e != id);
                self.offers.push((id, o.size()));
                Pass::Yes
            }
            Event::Chunk(id, offset, bytes) => match &mut self.incoming {
                Some((at, size, next)) if at == id => {
                    let len = u64::try_from(bytes.0.len()).unwrap_or(u64::MAX);
                    if offset != next || next.saturating_add(len) > *size {
                        return Pass::Broken;
                    }
                    *next += len;
                    Pass::Yes
                }
                _ => self.late(id),
            },
            // the caller checks length and hash and answers `result`
            Event::End(id) => match self.incoming {
                Some((at, ..)) if at == *id => {
                    self.incoming = None;
                    self.remember(*id);
                    Pass::Yes
                }
                _ => self.late(id),
            },
            Event::Accept(id, from) => match self.own_state(id) {
                Some((size, Own::Offered | Own::Waiting)) if *from <= size => {
                    self.set_own(id, Own::Streaming);
                    Pass::Yes
                }
                Some(_) => Pass::Broken,
                None => self.late(id),
            },
            Event::Wait(id, _) => match self.own_state(id) {
                Some((_, Own::Offered | Own::Waiting)) => {
                    self.set_own(id, Own::Waiting);
                    Pass::Yes
                }
                Some(_) => Pass::Broken,
                None => self.late(id),
            },
            Event::Refuse(id, _) => match self.own_state(id) {
                Some((_, Own::Offered | Own::Waiting)) => {
                    self.end_own(id);
                    Pass::Yes
                }
                Some(_) => Pass::Broken,
                None => self.late(id),
            },
            // after `end`, or early while chunks go out (the PC is full or failed)
            Event::Result(id, code) => match self.own_state(id) {
                Some((_, Own::Ended)) => {
                    self.end_own(id);
                    Pass::Yes
                }
                Some((_, Own::Streaming)) if *code != ResultCode::Ok => {
                    self.end_own(id);
                    Pass::Yes
                }
                Some(_) => Pass::Broken,
                None => self.late(id),
            },
            Event::Cancel(id) => {
                let known = self.offers.iter().any(|(x, _)| x == id)
                    || self.incoming.is_some_and(|(at, ..)| at == *id)
                    || self.own_state(id).is_some();
                if !known {
                    return self.late(id);
                }
                self.offers.retain(|(x, _)| x != id);
                if self.incoming.is_some_and(|(at, ..)| at == *id) {
                    self.incoming = None;
                }
                self.own.retain(|(x, ..)| x != id);
                self.remember(*id);
                Pass::Yes
            }
            _ => Pass::Yes,
        }
    }

    /// The caller takes a PC offer that stands, from inside it, while nothing else comes in.
    fn accepted(&mut self, id: &[u8; 16], from: u64) -> bool {
        if self.incoming.is_some() {
            return false;
        }
        match self.offers.iter().position(|(x, s)| x == id && from <= *s) {
            Some(at) => {
                let (_, size) = self.offers.remove(at);
                self.incoming = Some((*id, size, from));
                true
            }
            None => false,
        }
    }

    /// The caller offers one of its files: only while none of its own is active (offered,
    /// streaming, ended) and fewer than three wait for the PC's user.
    fn offering(&mut self, id: &[u8; 16], size: u64) -> bool {
        let active = self.own.iter().any(|(_, _, s)| *s != Own::Waiting);
        let known = self.own.iter().any(|(x, ..)| x == id);
        if active || known || self.own.len() >= PENDING_OFFERS {
            return false;
        }
        self.ended.retain(|e| e != id);
        self.own.push((*id, size, Own::Offered));
        true
    }

    /// The caller sends a chunk or `end` of its own file: only while the PC takes it.
    fn sending(&mut self, id: &[u8; 16], end: bool) -> bool {
        match self.own_state(id) {
            Some((_, Own::Streaming)) => {
                if end {
                    self.set_own(id, Own::Ended);
                }
                true
            }
            _ => false,
        }
    }

    /// The caller refused, cancelled or answered a transfer: frames for it from now on crossed.
    fn dropped(&mut self, id: &[u8; 16]) {
        let had = self.offers.iter().any(|(x, _)| x == id)
            || self.incoming.is_some_and(|(at, ..)| at == *id)
            || self.own_state(id).is_some();
        self.offers.retain(|(x, _)| x != id);
        if self.incoming.is_some_and(|(at, ..)| at == *id) {
            self.incoming = None;
        }
        self.own.retain(|(x, ..)| x != id);
        if had {
            self.remember(*id);
        }
    }

    fn own_state(&self, id: &[u8; 16]) -> Option<(u64, Own)> {
        self.own
            .iter()
            .find(|(x, ..)| x == id)
            .map(|(_, size, s)| (*size, *s))
    }

    fn set_own(&mut self, id: &[u8; 16], state: Own) {
        if let Some(e) = self.own.iter_mut().find(|(x, ..)| x == id) {
            e.2 = state;
        }
    }

    fn end_own(&mut self, id: &[u8; 16]) {
        self.own.retain(|(x, ..)| x != id);
        self.remember(*id);
    }

    fn remember(&mut self, id: [u8; 16]) {
        if self.ended.len() >= ENDED_KEPT {
            self.ended.remove(0);
        }
        self.ended.push(id);
    }

    fn late(&self, id: &[u8; 16]) -> Pass {
        if self.ended.contains(id) {
            Pass::Drop
        } else {
            Pass::Broken
        }
    }
}

/// One frame of the PC as an event, or the end of the session (with the PC's reason if it said one).
/// File records end it unless files were agreed on.
fn event_of(tag: u8, body: &[u8], files: bool) -> Result<Event, Option<Code>> {
    if (wire::TAG_FILE_FIRST..=wire::TAG_FILE_LAST).contains(&tag) {
        return if files {
            file_event(tag, body)
        } else {
            Err(None)
        };
    }
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

fn file_event(tag: u8, body: &[u8]) -> Result<Event, Option<Code>> {
    let broken = |_| None;
    Ok(match tag {
        wire::TAG_OFFER => match wire::decode_offer(body) {
            Ok(o) => Event::Offer(o),
            Err(e) => match e.answer() {
                Some((id, code)) => Event::BadOffer(id, code),
                None => return Err(None),
            },
        },
        wire::TAG_ACCEPT => {
            let (id, from) = wire::decode_accept(body).map_err(broken)?;
            Event::Accept(id, from)
        }
        wire::TAG_WAIT => {
            let (id, r) = wire::decode_wait(body).map_err(broken)?;
            Event::Wait(id, r)
        }
        wire::TAG_REFUSE => {
            let (id, c) = wire::decode_refuse(body).map_err(broken)?;
            Event::Refuse(id, c)
        }
        wire::TAG_CHUNK => {
            let (id, offset, bytes) = wire::decode_chunk(body).map_err(broken)?;
            Event::Chunk(id, offset, ChunkBytes(bytes.to_vec()))
        }
        wire::TAG_END => Event::End(wire::decode_id(body).map_err(broken)?),
        wire::TAG_RESULT => {
            let (id, c) = wire::decode_result(body).map_err(broken)?;
            Event::Result(id, c)
        }
        wire::TAG_CANCEL => Event::Cancel(wire::decode_id(body).map_err(broken)?),
        _ => return Err(None),
    })
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
        ExchangeSession::open_at(addr, own, hub, "Phone", 0, on_event)
    }

    pub fn open_files_via(
        addr: SocketAddrV4,
        own: &StaticKey,
        hub: &PublicKey,
        on_event: OnEvent,
    ) -> Result<ExchangeSession, ExchangeError> {
        ExchangeSession::open_at(addr, own, hub, "Phone", wire::FEATURE_FILES, on_event)
    }
}

#[cfg(test)]
mod guard_tests {
    use super::*;

    fn offer(n: u8, size: u64) -> Event {
        Event::Offer(Offer::new([n; 16], size, [0; 32], "a.bin".into(), String::new()).unwrap())
    }

    fn chunk(n: u8, at: u64, len: usize) -> Event {
        Event::Chunk([n; 16], at, ChunkBytes(vec![0; len]))
    }

    #[test]
    fn a_pc_sends_chunks_only_for_what_this_device_accepted_in_order() {
        let mut g = Guard::default();
        assert_eq!(g.check(&chunk(1, 0, 5)), Pass::Broken, "nothing accepted");
        assert_eq!(g.check(&offer(1, 10)), Pass::Yes);
        assert_eq!(
            g.check(&chunk(1, 0, 5)),
            Pass::Broken,
            "offered is not accepted"
        );
        assert!(!g.accepted(&[1; 16], 11), "past the end");
        assert!(!g.accepted(&[2; 16], 0), "never offered");
        assert!(g.accepted(&[1; 16], 2));
        assert_eq!(
            g.check(&chunk(1, 0, 5)),
            Pass::Broken,
            "before the resume point"
        );
        let mut g = Guard::default();
        g.check(&offer(1, 10));
        g.accepted(&[1; 16], 2);
        assert_eq!(g.check(&chunk(1, 2, 5)), Pass::Yes);
        assert_eq!(g.check(&chunk(1, 7, 4)), Pass::Broken, "past the size");
        let mut g = Guard::default();
        g.check(&offer(1, 10));
        g.accepted(&[1; 16], 0);
        g.check(&chunk(1, 0, 10));
        assert_eq!(g.check(&Event::End([1; 16])), Pass::Yes);
        assert_eq!(g.check(&chunk(1, 10, 1)), Pass::Drop);
        assert_eq!(g.check(&Event::End([1; 16])), Pass::Drop);
        assert_eq!(g.check(&Event::End([9; 16])), Pass::Broken);
    }

    #[test]
    fn a_pc_offer_that_crossed_this_device_accept_is_fine() {
        let mut g = Guard::default();
        g.check(&offer(1, 10));
        assert!(g.accepted(&[1; 16], 0));
        // the PC offered the next file before this accept reached it
        assert_eq!(g.check(&offer(2, 5)), Pass::Yes);
        assert_eq!(g.check(&chunk(1, 0, 10)), Pass::Yes);
        assert!(!g.accepted(&[2; 16], 0), "one PC file at a time");
        assert_eq!(g.check(&Event::End([1; 16])), Pass::Yes);
        assert!(g.accepted(&[2; 16], 0));
    }

    #[test]
    fn offers_are_bounded_and_a_dropped_transfer_drops_its_late_chunks() {
        let mut g = Guard::default();
        for n in 1..=PENDING_OFFERS as u8 {
            assert_eq!(g.check(&offer(n, 5)), Pass::Yes);
        }
        assert_eq!(
            g.check(&offer(9, 5)),
            Pass::Broken,
            "a fourth while three stand"
        );
        assert_eq!(g.check(&offer(1, 5)), Pass::Broken, "the same again");
        assert!(g.accepted(&[1; 16], 0));
        g.dropped(&[1; 16]);
        assert_eq!(g.check(&chunk(1, 0, 5)), Pass::Drop);
        assert_eq!(g.check(&Event::Cancel([2; 16])), Pass::Yes);
        assert_eq!(g.check(&offer(2, 5)), Pass::Yes);
    }

    #[test]
    fn answers_of_the_pc_only_for_this_device_own_offers() {
        let mut g = Guard::default();
        for e in [
            Event::Accept([1; 16], 0),
            Event::Wait([1; 16], WaitReason::Large),
            Event::Refuse([1; 16], RefuseCode::Full),
            Event::Result([1; 16], ResultCode::Ok),
        ] {
            assert_eq!(g.check(&e), Pass::Broken, "{e:?}: never offered");
        }
        assert!(g.offering(&[1; 16], 10));
        assert!(!g.offering(&[2; 16], 10), "one active offer at a time");
        assert!(!g.sending(&[1; 16], false), "no chunk before accept");
        assert_eq!(
            g.check(&Event::Accept([1; 16], 11)),
            Pass::Broken,
            "past the end"
        );
        assert_eq!(
            g.check(&Event::Result([1; 16], ResultCode::Ok)),
            Pass::Broken
        );
        assert_eq!(g.check(&Event::Wait([1; 16], WaitReason::Large)), Pass::Yes);
        // waiting frees the way for the next offer
        assert!(g.offering(&[2; 16], 4));
        assert_eq!(g.check(&Event::Accept([2; 16], 0)), Pass::Yes);
        assert!(g.sending(&[2; 16], false) && g.sending(&[2; 16], true));
        assert!(!g.sending(&[2; 16], false), "after end");
        assert_eq!(g.check(&Event::Result([2; 16], ResultCode::Ok)), Pass::Yes);
        assert_eq!(g.check(&Event::Result([2; 16], ResultCode::Ok)), Pass::Drop);
        // the PC's user says yes to the waiting one later
        assert_eq!(g.check(&Event::Accept([1; 16], 3)), Pass::Yes);
        // an early result while it streams (the PC is full)
        assert_eq!(
            g.check(&Event::Result([1; 16], ResultCode::Full)),
            Pass::Yes
        );
    }
}
