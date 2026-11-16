//! The file side of one exchange session (package 2b): which transfer runs in which direction,
//! which offers wait for a user, what this session is done with. The session (`session.rs`) owns
//! one [`Transfers`] when both sides agreed on files; the shell's files are behind
//! [`ExchangeFiles`].
//!
//! Rules (both directions alike):
//! * One **active** transfer per direction: offered (answer pending), streaming, or ended (result
//!   pending). Up to [`PENDING`] more offers may wait for the receiver's user; a waiting offer does
//!   not hold the active slot, so small files are not stuck behind one large file. The next offer
//!   comes only when no transfer is active and fewer than [`PENDING`] wait.
//! * Chunks are contiguous and never past the offered size; anything else closes the session.
//! * Frames cross on the wire: chunks, `end`, `result`, `accept`, `wait`, `refuse` and `cancel`
//!   for a transfer this side already ended are dropped, never a reason to close.
//! * Bounds: at most [`OFFERS_IN`] incoming offers per session; at most [`FAILURES`] outgoing
//!   files may fail or be refused per session (delivered ones do not count).
//! * The shell is asked for decisions, the queue and withdrawn offers at most every
//!   [`CHECK_EVERY`]; while a transfer streams, chunks go out without asking more.

use super::control::Exchange;
use super::files::{Decision, ExchangeFiles, SendOutcome, Stopped};
use super::session::Step;
use super::wire::{self, Code, RefuseCode, ResultCode};
use crate::noise::PublicKey;
use std::time::Duration;

/// Offers that may wait for the receiver's user at once, per direction.
pub const PENDING: usize = 3;
/// Incoming offers one session takes at most (a device cannot make the PC decide forever).
pub const OFFERS_IN: usize = 64;
/// Outgoing files one session gives up on at most (a queue of failing files cannot spin).
pub const FAILURES: usize = 64;
/// How often the shell is asked for decisions, its queue and withdrawn offers.
pub const CHECK_EVERY: Duration = Duration::from_millis(50);

struct Incoming {
    id: [u8; 16],
    size: u64,
    /// Where the next chunk starts.
    next: u64,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Out {
    /// The offer is out; the device answers.
    Offered,
    /// Chunks go out from this offset.
    Streaming(u64),
    /// `end` is out; the device answers with `result`.
    Ended,
}

struct Outgoing {
    id: [u8; 16],
    size: u64,
    state: Out,
}

/// An outgoing offer the device's user decides on; `from` once they accepted (it starts when the
/// active slot is free).
struct WaitingOut {
    id: [u8; 16],
    size: u64,
    from: Option<u64>,
}

#[derive(Default)]
pub(crate) struct Transfers {
    active_in: Option<Incoming>,
    /// Incoming offers waiting for the PC's user: id and size.
    waiting_in: Vec<([u8; 16], u64)>,
    /// Incoming transfers this session ended: late frames for them are dropped.
    ended_in: Vec<[u8; 16]>,
    offers_in: usize,
    active_out: Option<Outgoing>,
    waiting_out: Vec<WaitingOut>,
    /// Outgoing files this session is done with (delivered, refused, cancelled, failed).
    done_out: Vec<[u8; 16]>,
    failures: usize,
    checked: Option<Duration>,
}

/// What a transfer needs from its session.
pub(crate) struct Ctx<'a> {
    pub exchange: &'a Exchange,
    pub files: &'a dyn ExchangeFiles,
    pub peer: &'a PublicKey,
}

impl Transfers {
    /// Whether a transfer streams in either direction (the session then asks the controls at most
    /// every [`CHECK_EVERY`]).
    pub fn streaming(&self) -> bool {
        self.active_in.is_some()
            || self
                .active_out
                .as_ref()
                .is_some_and(|o| matches!(o.state, Out::Streaming(_)))
    }

    /// A file record from the device.
    pub fn on_frame(&mut self, cx: &Ctx<'_>, tag: u8, body: &[u8], now: Duration) -> Step {
        match tag {
            wire::TAG_OFFER => self.on_offer(cx, body, now),
            wire::TAG_CHUNK => self.on_chunk(cx, body),
            wire::TAG_END => self.on_end(cx, body, now),
            wire::TAG_CANCEL => self.on_cancel(cx, body),
            wire::TAG_ACCEPT => self.on_accept(body),
            wire::TAG_WAIT => self.on_wait(cx, body),
            wire::TAG_REFUSE => self.on_refuse(cx, body),
            wire::TAG_RESULT => self.on_result(cx, body),
            _ => Step::Close,
        }
    }

    fn on_offer(&mut self, cx: &Ctx<'_>, body: &[u8], now: Duration) -> Step {
        self.offers_in += 1;
        if self.offers_in > OFFERS_IN {
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
        let id = *offer.id();
        // the device offers only while nothing of it is active, and never one that already waits
        if self.active_in.is_some()
            || self.waiting_in.len() >= PENDING
            || self.waiting_in.iter().any(|(w, _)| *w == id)
        {
            return Step::Close;
        }
        if let Some(minutes) = cx.exchange.limited(cx.peer, now) {
            return Step::ReplyClose(wire::TAG_REFUSED, wire::encode_code(Code::Limit(minutes)));
        }
        // offered again after an end in this session (a resume after a failure)
        self.ended_in.retain(|e| *e != id);
        match cx.files.offered(cx.peer, &offer) {
            Decision::Accept { from } if from <= offer.size() => {
                self.active_in = Some(Incoming {
                    id,
                    size: offer.size(),
                    next: from,
                });
                Step::Reply(wire::TAG_ACCEPT, wire::encode_accept(&id, from).to_vec())
            }
            // a resume point past the end: the shell's part is broken, nothing is taken
            Decision::Accept { .. } => refuse(&id, RefuseCode::Rejected),
            Decision::Wait(reason) => {
                self.waiting_in.push((id, offer.size()));
                Step::Reply(wire::TAG_WAIT, wire::encode_wait(&id, reason).to_vec())
            }
            Decision::Refuse(code) => refuse(&id, code),
        }
    }

    fn on_chunk(&mut self, cx: &Ctx<'_>, body: &[u8]) -> Step {
        let Ok((id, offset, bytes)) = wire::decode_chunk(body) else {
            return Step::Close;
        };
        let Some(inc) = self.active_in.as_mut().filter(|i| i.id == id) else {
            return self.late_in(&id);
        };
        let len = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
        // contiguous, and never past the offered size
        if offset != inc.next || inc.next.saturating_add(len) > inc.size {
            return Step::Close;
        }
        match cx.files.write(cx.peer, &id, offset, bytes) {
            Ok(()) => {
                inc.next += len;
                Step::Continue
            }
            Err(code) => {
                self.end_in(id);
                result(&id, code)
            }
        }
    }

    fn on_end(&mut self, cx: &Ctx<'_>, body: &[u8], now: Duration) -> Step {
        let Ok(id) = wire::decode_id(body) else {
            return Step::Close;
        };
        let Some(inc) = self.active_in.take_if(|i| i.id == id) else {
            return self.late_in(&id);
        };
        self.ended_in.push(id);
        // the session knows the length: a short file never reaches `finish`
        if inc.next != inc.size {
            cx.files.stopped(cx.peer, &id, Stopped::Lost);
            return result(&id, ResultCode::Mismatch);
        }
        let code = cx.files.finish(cx.peer, &id);
        if code == ResultCode::Ok {
            cx.exchange.record(cx.peer, now);
        }
        result(&id, code)
    }

    fn on_cancel(&mut self, cx: &Ctx<'_>, body: &[u8]) -> Step {
        let Ok(id) = wire::decode_id(body) else {
            return Step::Close;
        };
        if self.active_in.as_ref().is_some_and(|i| i.id == id) {
            self.end_in(id);
            cx.files.stopped(cx.peer, &id, Stopped::Cancelled);
        } else if let Some(at) = self.waiting_in.iter().position(|(w, _)| *w == id) {
            self.waiting_in.remove(at);
            self.ended_in.push(id);
            cx.files.stopped(cx.peer, &id, Stopped::Withdrawn);
        } else if self.active_out.as_ref().is_some_and(|o| o.id == id) {
            self.active_out = None;
            self.done_out(cx, id, SendOutcome::Cancelled, false);
        } else if let Some(at) = self.waiting_out.iter().position(|w| w.id == id) {
            self.waiting_out.remove(at);
            self.done_out(cx, id, SendOutcome::Cancelled, false);
        }
        // anything else crossed an end on the wire
        Step::Continue
    }

    fn on_accept(&mut self, body: &[u8]) -> Step {
        let Ok((id, from)) = wire::decode_accept(body) else {
            return Step::Close;
        };
        if let Some(o) = self.active_out.as_mut().filter(|o| o.id == id) {
            if o.state != Out::Offered || from > o.size {
                return Step::Close;
            }
            o.state = Out::Streaming(from);
            return Step::Continue;
        }
        if let Some(w) = self.waiting_out.iter_mut().find(|w| w.id == id) {
            if w.from.is_some() || from > w.size {
                return Step::Close;
            }
            // it starts as soon as the active slot is free (`poll`)
            w.from = Some(from);
            return Step::Continue;
        }
        self.late_out(&id)
    }

    fn on_wait(&mut self, cx: &Ctx<'_>, body: &[u8]) -> Step {
        let Ok((id, reason)) = wire::decode_wait(body) else {
            return Step::Close;
        };
        match self
            .active_out
            .take_if(|o| o.id == id && o.state == Out::Offered)
        {
            Some(o) => {
                // waiting for the device's user frees the slot for the next file
                self.waiting_out.push(WaitingOut {
                    id,
                    size: o.size,
                    from: None,
                });
                cx.files.sent(cx.peer, &id, SendOutcome::Waiting(reason));
                Step::Continue
            }
            None => self.late_out(&id),
        }
    }

    fn on_refuse(&mut self, cx: &Ctx<'_>, body: &[u8]) -> Step {
        let Ok((id, code)) = wire::decode_refuse(body) else {
            return Step::Close;
        };
        if self
            .active_out
            .take_if(|o| o.id == id && o.state == Out::Offered)
            .is_some()
        {
            self.done_out(cx, id, SendOutcome::Refused(code), true);
            return Step::Continue;
        }
        if let Some(at) = self.waiting_out.iter().position(|w| w.id == id) {
            self.waiting_out.remove(at);
            self.done_out(cx, id, SendOutcome::Refused(code), true);
            return Step::Continue;
        }
        self.late_out(&id)
    }

    fn on_result(&mut self, cx: &Ctx<'_>, body: &[u8]) -> Step {
        let Ok((id, code)) = wire::decode_result(body) else {
            return Step::Close;
        };
        // after `end`, or early while chunks still go out (the device is full or failed)
        let over = |o: &Outgoing| {
            o.id == id
                && (o.state == Out::Ended
                    || (matches!(o.state, Out::Streaming(_)) && code != ResultCode::Ok))
        };
        if self.active_out.take_if(|o| over(o)).is_some() {
            self.done_out(cx, id, SendOutcome::Done(code), code != ResultCode::Ok);
            return Step::Continue;
        }
        self.late_out(&id)
    }

    /// The next file record of this side: a late decision of the PC's user, a withdrawn offer,
    /// the next chunk, `end`, or a new offer.
    pub fn poll(&mut self, cx: &Ctx<'_>, now: Duration) -> Step {
        let check = self
            .checked
            .is_none_or(|t| now.saturating_sub(t) >= CHECK_EVERY);
        if check {
            self.checked = Some(now);
            if let Some(step) = self.checks(cx) {
                return step;
            }
        }
        match self.active_out.as_mut() {
            Some(o) => match o.state {
                Out::Streaming(next) if next >= o.size => {
                    o.state = Out::Ended;
                    Step::Reply(wire::TAG_END, o.id.to_vec())
                }
                Out::Streaming(next) => {
                    let (id, size) = (o.id, o.size);
                    self.chunk(cx, id, size, next)
                }
                Out::Offered | Out::Ended => Step::Continue,
            },
            None => self.start_next(cx, check),
        }
    }

    /// What the shell is asked at most every [`CHECK_EVERY`]: the PC's user answered a waiting
    /// offer of the device (only while nothing comes in), or took back a file that is offered.
    fn checks(&mut self, cx: &Ctx<'_>) -> Option<Step> {
        if self.active_in.is_none() {
            for at in 0..self.waiting_in.len() {
                let (id, size) = self.waiting_in[at];
                match cx.files.decided(cx.peer, &id) {
                    Some(Decision::Accept { from }) if from <= size => {
                        self.waiting_in.remove(at);
                        self.active_in = Some(Incoming {
                            id,
                            size,
                            next: from,
                        });
                        let accept = wire::encode_accept(&id, from);
                        return Some(Step::Reply(wire::TAG_ACCEPT, accept.to_vec()));
                    }
                    Some(Decision::Accept { .. }) => {
                        self.waiting_in.remove(at);
                        self.ended_in.push(id);
                        return Some(refuse(&id, RefuseCode::Rejected));
                    }
                    Some(Decision::Refuse(code)) => {
                        self.waiting_in.remove(at);
                        self.ended_in.push(id);
                        return Some(refuse(&id, code));
                    }
                    Some(Decision::Wait(_)) | None => {}
                }
            }
        }
        // a file the PC took out of its queue while the device was still asked about it
        let gone = |id: &[u8; 16]| !cx.files.queued(cx.peer, id);
        if let Some(o) = self
            .active_out
            .take_if(|o| o.state == Out::Offered && gone(&o.id))
        {
            self.done_out(cx, o.id, SendOutcome::Interrupted, false);
            return Some(Step::Reply(wire::TAG_CANCEL, o.id.to_vec()));
        }
        if let Some(at) = self.waiting_out.iter().position(|w| gone(&w.id)) {
            let id = self.waiting_out.remove(at).id;
            self.done_out(cx, id, SendOutcome::Interrupted, false);
            return Some(Step::Reply(wire::TAG_CANCEL, id.to_vec()));
        }
        None
    }

    fn chunk(&mut self, cx: &Ctx<'_>, id: [u8; 16], size: u64, next: u64) -> Step {
        let left = usize::try_from(size - next).unwrap_or(usize::MAX);
        let want = left.min(wire::MAX_CHUNK);
        let mut body = vec![0u8; 24 + want];
        body[..24].copy_from_slice(&wire::chunk_header(&id, next));
        match cx.files.read(cx.peer, &id, next, &mut body[24..]) {
            Ok(n) if n > 0 && n <= want => {
                body.truncate(24 + n);
                if let Some(o) = self.active_out.as_mut() {
                    o.state = Out::Streaming(next + u64::try_from(n).unwrap_or(0));
                }
                Step::Reply(wire::TAG_CHUNK, body)
            }
            // shorter than offered, changed or gone: cancel; the shell decides whether it stays
            // queued
            _ => {
                self.active_out = None;
                self.done_out(cx, id, SendOutcome::Interrupted, true);
                Step::Reply(wire::TAG_CANCEL, id.to_vec())
            }
        }
    }

    /// The active slot is free: a file the device's user accepted meanwhile, else a new offer.
    fn start_next(&mut self, cx: &Ctx<'_>, check: bool) -> Step {
        if let Some(at) = self.waiting_out.iter().position(|w| w.from.is_some()) {
            let w = self.waiting_out.remove(at);
            self.active_out = Some(Outgoing {
                id: w.id,
                size: w.size,
                state: Out::Streaming(w.from.unwrap_or(0)),
            });
            return Step::Continue;
        }
        if !check || self.failures >= FAILURES || self.waiting_out.len() >= PENDING {
            return Step::Continue;
        }
        let mut skip = self.done_out.clone();
        skip.extend(self.waiting_out.iter().map(|w| w.id));
        match cx.files.next_offer(cx.peer, &skip) {
            // the shell skips them; this checks it once more
            Some(offer) if !skip.contains(offer.id()) => {
                self.active_out = Some(Outgoing {
                    id: *offer.id(),
                    size: offer.size(),
                    state: Out::Offered,
                });
                Step::Reply(wire::TAG_OFFER, wire::encode_offer(&offer))
            }
            Some(_) | None => Step::Continue,
        }
    }

    /// The session ends: whatever is unfinished goes to the shell (parts stay for a resume,
    /// outgoing files stay queued, waiting prompts go).
    pub fn leave(&mut self, cx: &Ctx<'_>) {
        if let Some(inc) = self.active_in.take() {
            cx.files.stopped(cx.peer, &inc.id, Stopped::Lost);
        }
        for (id, _) in self.waiting_in.drain(..) {
            cx.files.stopped(cx.peer, &id, Stopped::Withdrawn);
        }
        if let Some(out) = self.active_out.take() {
            cx.files.sent(cx.peer, &out.id, SendOutcome::Interrupted);
        }
        for w in self.waiting_out.drain(..) {
            cx.files.sent(cx.peer, &w.id, SendOutcome::Interrupted);
        }
    }

    fn end_in(&mut self, id: [u8; 16]) {
        self.active_in = None;
        self.ended_in.push(id);
    }

    fn done_out(&mut self, cx: &Ctx<'_>, id: [u8; 16], outcome: SendOutcome, failure: bool) {
        self.done_out.push(id);
        if failure {
            self.failures += 1;
        }
        cx.files.sent(cx.peer, &id, outcome);
    }

    /// A record for an incoming transfer this side does not run: dropped if this session ended it
    /// (the frames crossed), else a broken peer.
    fn late_in(&self, id: &[u8; 16]) -> Step {
        if self.ended_in.contains(id) {
            Step::Continue
        } else {
            Step::Close
        }
    }

    fn late_out(&self, id: &[u8; 16]) -> Step {
        if self.done_out.contains(id) {
            Step::Continue
        } else {
            Step::Close
        }
    }
}

fn refuse(id: &[u8; 16], code: RefuseCode) -> Step {
    Step::Reply(wire::TAG_REFUSE, wire::encode_refuse(id, code).to_vec())
}

fn result(id: &[u8; 16], code: ResultCode) -> Step {
    Step::Reply(wire::TAG_RESULT, wire::encode_result(id, code).to_vec())
}
