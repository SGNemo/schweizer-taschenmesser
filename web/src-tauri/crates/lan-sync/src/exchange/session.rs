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
//!   the PC ends the session with the reason. While a file streams, the switch, the grant and the
//!   outbox are asked at most every `transfer::CHECK_EVERY` (not once per 64 KB chunk).
//! * Files (package 2b), only when both sides agreed on `FEATURE_FILES` and the shell wired them:
//!   the rules are in `transfer.rs`; a text item goes before the next chunk.
//!
//! The session reads the controls (`admit`, `limited`, `record`, the inbox, outbox and files and
//! the live count) and never changes a setting.

use super::control::{Exchange, Stored};
use super::transfer::{Ctx, Transfers, CHECK_EVERY};
use super::wire::{self, AckState, Code, ItemError};
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
        /// Files, when both sides agreed on them.
        files: Option<Transfers>,
        /// When the controls were last asked while a file streamed.
        checked: Option<Duration>,
    },
    Done,
}

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
                            files: (accepted & wire::FEATURE_FILES != 0).then(Transfers::default),
                            checked: None,
                        };
                        self.exchange.session_opened(&self.peer);
                        self.counted = true;
                        self.opened = true;
                        Step::Reply(wire::TAG_OPENED, wire::encode_opened(accepted).to_vec())
                    }
                },
            },
            Phase::Live { .. } => match self.controls(now) {
                Err(code) => refused(code),
                Ok(_) => self.live(tag, body, now),
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

    /// The switch and the grant: on every frame and tick, but while a file streams at most every
    /// [`CHECK_EVERY`]. `Ok(true)`: they were asked now (the outbox may be asked too).
    fn controls(&mut self, now: Duration) -> Result<bool, Code> {
        if let Phase::Live {
            files: Some(files),
            checked,
            ..
        } = &mut self.phase
        {
            if files.streaming() && checked.is_some_and(|t| now.saturating_sub(t) < CHECK_EVERY) {
                return Ok(false);
            }
            *checked = Some(now);
        }
        self.exchange.admit(&self.peer).map(|()| true)
    }

    fn live(&mut self, tag: u8, body: &[u8], now: Duration) -> Step {
        let Phase::Live {
            in_flight,
            stalled,
            answered,
            files,
            ..
        } = &mut self.phase
        else {
            return Step::Close;
        };
        let (exchange, peer) = (&self.exchange, &self.peer);
        if (wire::TAG_FILE_FIRST..=wire::TAG_FILE_LAST).contains(&tag) {
            // only when agreed on and wired
            let (Some(files), Some(store)) = (files.as_mut(), exchange.files()) else {
                return Step::Close;
            };
            let cx = Ctx {
                exchange,
                files: store,
                peer,
            };
            return files.on_frame(&cx, tag, body, now);
        }
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

    /// Called on every turn of the connection (several per tick while a file streams): the next
    /// queued item or file record for this device, or the reason the PC ended the session. Never
    /// resets the connection's idle timer.
    pub fn poll(&mut self, now: Duration) -> Step {
        let step = match &self.phase {
            Phase::Live { .. } => match self.controls(now) {
                Err(code) => refused(code),
                Ok(asked) => self.poll_live(now, asked),
            },
            Phase::Done => Step::Close,
            _ => Step::Continue,
        };
        self.finish(step)
    }

    /// `asked`: the controls were asked on this turn (the outbox is asked with them).
    fn poll_live(&mut self, now: Duration, asked: bool) -> Step {
        let Phase::Live {
            in_flight,
            stalled,
            answered,
            files,
            ..
        } = &mut self.phase
        else {
            return Step::Continue;
        };
        // while a file streams, the outbox is asked only when the controls were
        let ask = asked;
        if ask && in_flight.is_none() && !*stalled {
            if let Some(item) = self.exchange.outbox().next(&self.peer) {
                if *answered != Some(*item.id()) {
                    // a text item goes before the next file record
                    *in_flight = Some(*item.id());
                    return Step::Reply(wire::TAG_ITEM, wire::encode_item(&item));
                }
            }
        }
        let (Some(files), Some(store)) = (files.as_mut(), self.exchange.files()) else {
            return Step::Continue;
        };
        let cx = Ctx {
            exchange: &self.exchange,
            files: store,
            peer: &self.peer,
        };
        files.poll(&cx, now)
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

    /// The session ends with transfers unfinished: the shell hears about each of them.
    fn leave_files(&mut self) {
        let Phase::Live {
            files: Some(files), ..
        } = &mut self.phase
        else {
            return;
        };
        if let Some(store) = self.exchange.files() {
            let cx = Ctx {
                exchange: &self.exchange,
                files: store,
                peer: &self.peer,
            };
            files.leave(&cx);
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
