//! One exchange connection at the hub: `hello`, then `open` (refused unless exchange is on at this
//! PC and the device is granted and not paused), then items both ways.
//!
//! * Phone → PC: each item is checked, counted against the rate limit and stored in the inbox
//!   **before** it is acked; an inbox that cannot take it answers `ack refused` (the phone keeps it).
//! * PC → phone: one item of the outbox in flight at a time, removed only on the phone's
//!   `ack stored`; `ack refused` (the phone is full) stops sending for this session.
//! * Every frame and every tick checks the switch and the grant again: switching off or pausing at
//!   the PC ends the session with the reason.
//!
//! The session reads the controls (`enabled`, `admit`, `count`) and never changes them.

use super::control::Exchange;
use super::wire::{self, AckState, Code};
use crate::noise::PublicKey;
use std::sync::Arc;
use std::time::Duration;

/// What the connection does next. `Reply`/`ReplyClose` carry a tag and a plaintext body; the
/// caller seals them.
#[derive(Debug, PartialEq, Eq)]
pub enum Step {
    Continue,
    Reply(u8, Vec<u8>),
    /// Send, then close.
    ReplyClose(u8, Vec<u8>),
    Close,
}

enum Phase {
    AwaitHello,
    AwaitOpen,
    Live {
        /// The PC → phone item that waits for its ack.
        in_flight: Option<[u8; 16]>,
        /// The phone said it is full: nothing more goes out in this session.
        stalled: bool,
    },
    Done,
}

pub struct ExchangeConn {
    exchange: Arc<Exchange>,
    peer: PublicKey,
    phase: Phase,
}

fn refused(code: Code) -> Step {
    Step::ReplyClose(wire::TAG_REFUSED, wire::encode_code(code).to_vec())
}

impl ExchangeConn {
    pub fn new(exchange: Arc<Exchange>, peer: PublicKey) -> Self {
        ExchangeConn {
            exchange,
            peer,
            phase: Phase::AwaitHello,
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
                Ok(asked) => match self.exchange.admit(&self.peer) {
                    Err(code) => refused(code),
                    Ok(()) => {
                        self.phase = Phase::Live {
                            in_flight: None,
                            stalled: false,
                        };
                        let accepted = asked & wire::FEATURES;
                        Step::Reply(wire::TAG_OPENED, wire::encode_opened(accepted).to_vec())
                    }
                },
            },
            Phase::Live { in_flight, stalled } => match self.exchange.admit(&self.peer) {
                Err(code) => refused(code),
                Ok(()) => Self::live(
                    &self.exchange,
                    &self.peer,
                    in_flight,
                    stalled,
                    tag,
                    body,
                    now,
                ),
            },
            _ => Step::Close,
        };
        self.finish(step)
    }

    fn live(
        exchange: &Exchange,
        peer: &PublicKey,
        in_flight: &mut Option<[u8; 16]>,
        stalled: &mut bool,
        tag: u8,
        body: &[u8],
        now: Duration,
    ) -> Step {
        match tag {
            wire::TAG_ITEM => {
                let Ok(item) = wire::decode_item(body) else {
                    return Step::Close;
                };
                if !exchange.count(peer, now) {
                    return refused(Code::Limit);
                }
                let state = match exchange.inbox().store(peer, &item) {
                    Ok(()) => AckState::Stored,
                    Err(_) => AckState::Refused,
                };
                Step::Reply(wire::TAG_ACK, wire::encode_ack(&item.id, state).to_vec())
            }
            wire::TAG_ACK => match wire::decode_ack(body) {
                // an ack must answer the item in flight; anything else is a broken peer
                Ok((id, state)) if *in_flight == Some(id) => {
                    *in_flight = None;
                    match state {
                        AckState::Stored => exchange.outbox().delivered(peer, &id),
                        AckState::Refused => *stalled = true,
                    }
                    Step::Continue
                }
                _ => Step::Close,
            },
            wire::TAG_PING => {
                if body.is_empty() {
                    Step::Continue
                } else {
                    Step::Close
                }
            }
            // file tags (package 2), sync and input tags, anything unknown
            _ => Step::Close,
        }
    }

    /// Called on every tick of the connection: the next queued item for this device, or the
    /// reason the PC ended the session. Never resets the connection's idle timer.
    pub fn poll(&mut self, _now: Duration) -> Step {
        let step = match &mut self.phase {
            Phase::Live { in_flight, stalled } => match self.exchange.admit(&self.peer) {
                Err(code) => refused(code),
                Ok(()) if in_flight.is_none() && !*stalled => {
                    match self.exchange.outbox().next(&self.peer) {
                        Some(item) => {
                            *in_flight = Some(item.id);
                            Step::Reply(wire::TAG_ITEM, wire::encode_item(&item))
                        }
                        None => Step::Continue,
                    }
                }
                Ok(()) => Step::Continue,
            },
            Phase::Done => Step::Close,
            _ => Step::Continue,
        };
        self.finish(step)
    }

    fn finish(&mut self, step: Step) -> Step {
        if matches!(step, Step::Close | Step::ReplyClose(..)) {
            self.phase = Phase::Done;
        }
        step
    }
}
