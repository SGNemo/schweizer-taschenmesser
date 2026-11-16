//! One exchange connection at the hub: `hello`, then `open` (refused unless exchange is on at this
//! PC, the device is granted and not paused, and under its rate limit), then items both ways.
//!
//! * Phone → PC: each item is checked and stored in the inbox **before** it is acked. An inbox
//!   that cannot take it answers `ack refused` (the phone keeps it); an item with a readable id
//!   but a body this side does not take answers `ack rejected` (it leaves the phone's queue
//!   instead of blocking it); only a frame without an id closes. Only stored items count against
//!   the rate limit; once it is reached the session ends with `limit` and the minutes left.
//! * PC → phone: one item of the outbox in flight at a time; the phone's answer goes to the outbox
//!   (`Stored`/`Rejected` take it out, `Refused` keeps it). After `Refused` nothing more goes out
//!   until the phone's next `ping` (it pings while the page is open), then the head is offered
//!   again.
//! * Every frame and every tick checks the switch and the grant again: switching off or pausing at
//!   the PC ends the session with the reason.
//! * Files (package 2b), only when both sides agreed on `FEATURE_FILES` and the shell wired them:
//!   one transfer per direction at a time. Device → PC: `offer` → the shell decides (`accept`
//!   from an offset, `wait` for its user, `refuse`); chunks must follow each other without a gap
//!   (anything else closes); `end` → the shell checks and answers `result`. PC → device: the head
//!   of the shell's file queue is offered, streamed after `accept` (a text item may go between
//!   two chunks), `end`, then the device's `result`. A transfer the session leaves unfinished is
//!   reported to the shell (the part stays for a resume; the outgoing file stays queued).
//!
//! The session reads the controls (`admit`, `limited`, `record`, the inbox and outbox and the
//! live count) and never changes a setting.

use super::control::{Exchange, Stored};
use super::files::{Decision, SendOutcome};
use super::wire::{self, AckState, Code, ItemError, RefuseCode, ResultCode};
use crate::noise::PublicKey;
use std::fmt;
use std::sync::Arc;
use std::time::Duration;

/// What the connection does next. `Reply`/`ReplyClose` carry a tag and a plaintext body; the
/// caller seals them. `Debug` shows the tag only, never a body.
#[derive(PartialEq, Eq)]
pub enum Step {
    Continue,
    Reply(u8, Vec<u8>),
    /// Send, then close.
    ReplyClose(u8, Vec<u8>),
    Close,
}

impl fmt::Debug for Step {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Step::Continue => f.write_str("Continue"),
            Step::Close => f.write_str("Close"),
            Step::Reply(tag, _) => write!(f, "Reply({tag:#04x}, ..)"),
            Step::ReplyClose(tag, _) => write!(f, "ReplyClose({tag:#04x}, ..)"),
        }
    }
}

enum Phase {
    AwaitHello,
    AwaitOpen,
    Live {
        /// The PC → phone item that waits for its ack.
        in_flight: Option<[u8; 16]>,
        /// The phone said it is full: nothing more goes out until its next ping.
        stalled: bool,
        /// The last item the phone answered for good: never offered again in this session, even
        /// if the outbox still hands it out.
        answered: Option<[u8; 16]>,
        /// Both sides agreed on files.
        files: bool,
        /// The device's file that comes in.
        incoming: Option<Incoming>,
        /// The PC's file that goes out.
        outgoing: Option<Outgoing>,
        /// Files of the queue this session is done with (answered, refused, cancelled or failed):
        /// not offered again until the next session.
        offered: Vec<[u8; 16]>,
    },
    Done,
}

struct Incoming {
    id: [u8; 16],
    size: u64,
    /// Where the next chunk starts.
    next: u64,
    /// Waits for the PC's user: no chunk may come yet.
    waiting: bool,
}

struct Outgoing {
    id: [u8; 16],
    size: u64,
    state: Out,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Out {
    /// The offer is out; the device answers.
    Offered,
    /// The device waits for its user; it sends `accept` or `refuse` later.
    Waiting,
    /// Chunks go out from this offset.
    Streaming(u64),
    /// `end` is out; the device answers with `result`.
    Ended,
}

/// Files of the queue one session tries at most (a queue of failing files cannot spin forever).
const OFFERS_PER_SESSION: usize = 64;

pub struct ExchangeConn {
    exchange: Arc<Exchange>,
    peer: PublicKey,
    phase: Phase,
    /// Counted in the exchange's live sessions (from an accepted `open` until the drop).
    counted: bool,
    /// An `open` was just accepted (read once by the router: it then replaces older sessions).
    opened: bool,
}

fn refused(code: Code) -> Step {
    Step::ReplyClose(wire::TAG_REFUSED, wire::encode_code(code))
}

impl ExchangeConn {
    pub fn new(exchange: Arc<Exchange>, peer: PublicKey) -> Self {
        ExchangeConn {
            exchange,
            peer,
            phase: Phase::AwaitHello,
            counted: false,
            opened: false,
        }
    }

    /// The device's `hello` (its name is not used here). Exactly one, and first.
    pub fn on_hello(&mut self) -> Step {
        match self.phase {
            Phase::AwaitHello => {
                self.phase = Phase::AwaitOpen;
                Step::Continue
            }
            _ => self.finish(Step::Close),
        }
    }

    /// One application frame. `now` is monotonic time (only differences count).
    pub fn on_frame(&mut self, tag: u8, body: &[u8], now: Duration) -> Step {
        let step = match &mut self.phase {
            Phase::AwaitOpen if tag == wire::TAG_OPEN => match wire::decode_open(body) {
                Err(_) => Step::Close,
                Ok(asked) => match self.allowed(now) {
                    Err(code) => refused(code),
                    Ok(()) => {
                        let mine = if self.exchange.files().is_some() {
                            wire::FEATURES
                        } else {
                            wire::FEATURES & !wire::FEATURE_FILES
                        };
                        let accepted = asked & mine;
                        self.phase = Phase::Live {
                            in_flight: None,
                            stalled: false,
                            answered: None,
                            files: accepted & wire::FEATURE_FILES != 0,
                            incoming: None,
                            outgoing: None,
                            offered: Vec::new(),
                        };
                        self.exchange.session_opened(&self.peer);
                        self.counted = true;
                        self.opened = true;
                        Step::Reply(wire::TAG_OPENED, wire::encode_opened(accepted).to_vec())
                    }
                },
            },
            Phase::Live { .. } => match self.exchange.admit(&self.peer) {
                Err(code) => refused(code),
                Ok(()) => self.live(tag, body, now),
            },
            _ => Step::Close,
        };
        self.finish(step)
    }

    fn allowed(&self, now: Duration) -> Result<(), Code> {
        self.exchange.admit(&self.peer)?;
        match self.exchange.limited(&self.peer, now) {
            Some(minutes) => Err(Code::Limit(minutes)),
            None => Ok(()),
        }
    }

    fn live(&mut self, tag: u8, body: &[u8], now: Duration) -> Step {
        if (wire::TAG_FILE_FIRST..=wire::TAG_FILE_LAST).contains(&tag) {
            return self.file_frame(tag, body, now);
        }
        let Phase::Live {
            in_flight,
            stalled,
            answered,
            ..
        } = &mut self.phase
        else {
            return Step::Close;
        };
        let (exchange, peer) = (&self.exchange, &self.peer);
        match tag {
            wire::TAG_ITEM => {
                let item = match wire::decode_item(body) {
                    Ok(item) => item,
                    Err(ItemError::Unusable(id)) => {
                        let ack = wire::encode_ack(&id, AckState::Rejected);
                        return Step::Reply(wire::TAG_ACK, ack.to_vec());
                    }
                    Err(ItemError::Broken) => return Step::Close,
                };
                if let Some(minutes) = exchange.limited(peer, now) {
                    return refused(Code::Limit(minutes));
                }
                let state = match exchange.inbox().store(peer, &item) {
                    Ok(stored) => {
                        // a resend after a lost ack is acked again but not counted again
                        if stored == Stored::New {
                            exchange.record(peer, now);
                        }
                        AckState::Stored
                    }
                    Err(_) => AckState::Refused,
                };
                Step::Reply(wire::TAG_ACK, wire::encode_ack(item.id(), state).to_vec())
            }
            wire::TAG_ACK => match wire::decode_ack(body) {
                // an ack must answer the item in flight; anything else is a broken peer
                Ok((id, state)) if *in_flight == Some(id) => {
                    *in_flight = None;
                    *stalled = state == AckState::Refused;
                    if state != AckState::Refused {
                        *answered = Some(id);
                    }
                    exchange.outbox().answered(peer, &id, state);
                    Step::Continue
                }
                _ => Step::Close,
            },
            wire::TAG_PING if body.is_empty() => {
                // the phone may have room again: offer the head once more
                *stalled = false;
                Step::Continue
            }
            // sync and input tags, anything unknown
            _ => Step::Close,
        }
    }

    /// A file record from the device. Without the feature (or a shell that wired files) it closes.
    fn file_frame(&mut self, tag: u8, body: &[u8], now: Duration) -> Step {
        let Phase::Live {
            files: true,
            incoming,
            outgoing,
            offered,
            ..
        } = &mut self.phase
        else {
            return Step::Close;
        };
        let (exchange, peer) = (&self.exchange, &self.peer);
        let Some(store) = exchange.files() else {
            return Step::Close;
        };
        match tag {
            wire::TAG_OFFER => {
                // one incoming transfer at a time: a second offer is a broken peer
                if incoming.is_some() {
                    return Step::Close;
                }
                let offer = match wire::decode_offer(body) {
                    Ok(o) => o,
                    Err(e) => {
                        return match e.answer() {
                            Some((id, code)) => refuse(&id, code),
                            None => Step::Close,
                        }
                    }
                };
                if let Some(minutes) = exchange.limited(peer, now) {
                    return refused(Code::Limit(minutes));
                }
                let id = *offer.id();
                match store.offered(peer, &offer) {
                    Decision::Accept { from } if from <= offer.size() => {
                        *incoming = Some(Incoming {
                            id,
                            size: offer.size(),
                            next: from,
                            waiting: false,
                        });
                        Step::Reply(wire::TAG_ACCEPT, wire::encode_accept(&id, from).to_vec())
                    }
                    // a resume point past the end: the shell's part is broken, nothing is taken
                    Decision::Accept { .. } => refuse(&id, RefuseCode::Rejected),
                    Decision::Wait(reason) => {
                        *incoming = Some(Incoming {
                            id,
                            size: offer.size(),
                            next: 0,
                            waiting: true,
                        });
                        Step::Reply(wire::TAG_WAIT, wire::encode_wait(&id, reason).to_vec())
                    }
                    Decision::Refuse(code) => refuse(&id, code),
                }
            }
            wire::TAG_CHUNK => {
                let Ok((id, offset, bytes)) = wire::decode_chunk(body) else {
                    return Step::Close;
                };
                let Some(inc) = incoming.as_mut().filter(|i| i.id == id && !i.waiting) else {
                    return Step::Close;
                };
                let len = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
                // contiguous, and never past the offered size
                if offset != inc.next || inc.next.saturating_add(len) > inc.size {
                    return Step::Close;
                }
                match store.write(peer, &id, offset, bytes) {
                    Ok(()) => {
                        inc.next += len;
                        Step::Continue
                    }
                    Err(code) => {
                        *incoming = None;
                        result(&id, code)
                    }
                }
            }
            wire::TAG_END => {
                let Ok(id) = wire::decode_id(body) else {
                    return Step::Close;
                };
                if !incoming.as_ref().is_some_and(|i| i.id == id && !i.waiting) {
                    return Step::Close;
                }
                *incoming = None;
                let code = store.finish(peer, &id);
                if code == ResultCode::Ok {
                    exchange.record(peer, now);
                }
                result(&id, code)
            }
            wire::TAG_CANCEL => {
                let Ok(id) = wire::decode_id(body) else {
                    return Step::Close;
                };
                if let Some(inc) = incoming.take_if(|i| i.id == id) {
                    if !inc.waiting {
                        store.interrupted(peer, &id);
                    }
                } else if outgoing.take_if(|o| o.id == id).is_some() {
                    offered.push(id);
                    store.sent(peer, &id, SendOutcome::Cancelled);
                }
                // a cancel of a transfer that is already over is no error (the frames crossed)
                Step::Continue
            }
            wire::TAG_ACCEPT => {
                let Ok((id, from)) = wire::decode_accept(body) else {
                    return Step::Close;
                };
                match outgoing.as_mut() {
                    Some(o)
                        if o.id == id
                            && matches!(o.state, Out::Offered | Out::Waiting)
                            && from <= o.size =>
                    {
                        o.state = Out::Streaming(from);
                        Step::Continue
                    }
                    _ => Step::Close,
                }
            }
            wire::TAG_WAIT => {
                let Ok((id, reason)) = wire::decode_wait(body) else {
                    return Step::Close;
                };
                match outgoing.as_mut() {
                    Some(o) if o.id == id && o.state == Out::Offered => {
                        o.state = Out::Waiting;
                        store.sent(peer, &id, SendOutcome::Waiting(reason));
                        Step::Continue
                    }
                    _ => Step::Close,
                }
            }
            wire::TAG_REFUSE => {
                let Ok((id, code)) = wire::decode_refuse(body) else {
                    return Step::Close;
                };
                match outgoing.as_ref() {
                    Some(o) if o.id == id && matches!(o.state, Out::Offered | Out::Waiting) => {
                        *outgoing = None;
                        offered.push(id);
                        store.sent(peer, &id, SendOutcome::Refused(code));
                        Step::Continue
                    }
                    _ => Step::Close,
                }
            }
            wire::TAG_RESULT => {
                let Ok((id, code)) = wire::decode_result(body) else {
                    return Step::Close;
                };
                // the device may give up early (full, failed) while chunks still go out
                match outgoing.as_ref() {
                    Some(o)
                        if o.id == id
                            && (o.state == Out::Ended
                                || (matches!(o.state, Out::Streaming(_))
                                    && code != ResultCode::Ok)) =>
                    {
                        *outgoing = None;
                        offered.push(id);
                        store.sent(peer, &id, SendOutcome::Done(code));
                        Step::Continue
                    }
                    _ => Step::Close,
                }
            }
            _ => Step::Close,
        }
    }

    /// Called on every tick of the connection: the next queued item for this device, or the
    /// reason the PC ended the session. Never resets the connection's idle timer.
    pub fn poll(&mut self, _now: Duration) -> Step {
        let step = match &mut self.phase {
            Phase::Live {
                in_flight,
                stalled,
                answered,
                ..
            } => match self.exchange.admit(&self.peer) {
                Err(code) => refused(code),
                Ok(()) => {
                    let item = if in_flight.is_none() && !*stalled {
                        match self.exchange.outbox().next(&self.peer) {
                            Some(item) if *answered != Some(*item.id()) => {
                                *in_flight = Some(*item.id());
                                Some(Step::Reply(wire::TAG_ITEM, wire::encode_item(&item)))
                            }
                            Some(_) | None => None,
                        }
                    } else {
                        None
                    };
                    // a text item goes first; a file record otherwise
                    match item {
                        Some(step) => step,
                        None => self.poll_files(),
                    }
                }
            },
            Phase::Done => Step::Close,
            _ => Step::Continue,
        };
        self.finish(step)
    }

    /// The file side of a tick: the user's late answer to a waiting offer, the next chunk, the
    /// `end`, or a new offer from the queue.
    fn poll_files(&mut self) -> Step {
        let Phase::Live {
            files: true,
            incoming,
            outgoing,
            offered,
            ..
        } = &mut self.phase
        else {
            return Step::Continue;
        };
        let (peer, Some(store)) = (&self.peer, self.exchange.files()) else {
            return Step::Continue;
        };
        // the PC's user answered a waiting offer of the device
        if let Some(inc) = incoming.as_mut().filter(|i| i.waiting) {
            match store.decided(peer, &inc.id) {
                Some(Decision::Accept { from }) if from <= inc.size => {
                    inc.waiting = false;
                    inc.next = from;
                    return Step::Reply(
                        wire::TAG_ACCEPT,
                        wire::encode_accept(&inc.id, from).to_vec(),
                    );
                }
                Some(Decision::Accept { .. }) => {
                    let id = inc.id;
                    *incoming = None;
                    return refuse(&id, RefuseCode::Rejected);
                }
                Some(Decision::Refuse(code)) => {
                    let id = inc.id;
                    *incoming = None;
                    return refuse(&id, code);
                }
                Some(Decision::Wait(_)) | None => {}
            }
        }
        match outgoing.as_mut() {
            Some(o) => match o.state {
                Out::Streaming(next) if next >= o.size => {
                    o.state = Out::Ended;
                    Step::Reply(wire::TAG_END, o.id.to_vec())
                }
                Out::Streaming(next) => {
                    let left = usize::try_from(o.size - next).unwrap_or(usize::MAX);
                    let want = left.min(wire::MAX_CHUNK);
                    let mut body = vec![0u8; 24 + want];
                    body[..24].copy_from_slice(&wire::chunk_header(&o.id, next));
                    match store.read(peer, &o.id, next, &mut body[24..]) {
                        Ok(n) if n > 0 && n <= want => {
                            body.truncate(24 + n);
                            o.state = Out::Streaming(next + u64::try_from(n).unwrap_or(0));
                            Step::Reply(wire::TAG_CHUNK, body)
                        }
                        // shorter than offered, changed or gone: cancel; the shell decides
                        // whether it stays queued
                        _ => {
                            let id = o.id;
                            *outgoing = None;
                            offered.push(id);
                            store.sent(peer, &id, SendOutcome::Interrupted);
                            Step::Reply(wire::TAG_CANCEL, id.to_vec())
                        }
                    }
                }
                Out::Offered | Out::Waiting | Out::Ended => Step::Continue,
            },
            None if offered.len() < OFFERS_PER_SESSION => match store.next_offer(peer, offered) {
                // the shell skips what this session is done with; this checks it once more
                Some(offer) if !offered.contains(offer.id()) => {
                    *outgoing = Some(Outgoing {
                        id: *offer.id(),
                        size: offer.size(),
                        state: Out::Offered,
                    });
                    Step::Reply(wire::TAG_OFFER, wire::encode_offer(&offer))
                }
                Some(_) | None => Step::Continue,
            },
            None => Step::Continue,
        }
    }

    /// Whether an `open` was accepted since the last call (the router replaces the device's older
    /// exchange sessions then).
    pub fn take_opened(&mut self) -> bool {
        std::mem::take(&mut self.opened)
    }

    fn finish(&mut self, step: Step) -> Step {
        if matches!(step, Step::Close | Step::ReplyClose(..)) {
            self.leave_files();
            self.phase = Phase::Done;
            self.uncount();
        }
        step
    }

    /// The session ends with a transfer unfinished: the shell keeps the incoming part for a resume
    /// and the outgoing file in its queue.
    fn leave_files(&mut self) {
        let Phase::Live {
            incoming, outgoing, ..
        } = &mut self.phase
        else {
            return;
        };
        let (peer, Some(store)) = (&self.peer, self.exchange.files()) else {
            return;
        };
        if let Some(inc) = incoming.take().filter(|i| !i.waiting) {
            store.interrupted(peer, &inc.id);
        }
        if let Some(out) = outgoing.take().filter(|o| o.state != Out::Waiting) {
            store.sent(peer, &out.id, SendOutcome::Interrupted);
        }
    }

    fn uncount(&mut self) {
        if self.counted {
            self.counted = false;
            self.exchange.session_ended(&self.peer);
        }
    }
}

impl Drop for ExchangeConn {
    fn drop(&mut self) {
        self.leave_files();
        self.uncount();
    }
}

fn refuse(id: &[u8; 16], code: RefuseCode) -> Step {
    Step::Reply(wire::TAG_REFUSE, wire::encode_refuse(id, code).to_vec())
}

fn result(id: &[u8; 16], code: ResultCode) -> Step {
    Step::Reply(wire::TAG_RESULT, wire::encode_result(id, code).to_vec())
}
