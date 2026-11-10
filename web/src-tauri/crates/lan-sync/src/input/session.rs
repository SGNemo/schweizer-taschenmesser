//! One input connection on the hub: `hello`, then `open`, then events.
//!
//! The level of a session is fixed when it opens (the smaller of what the phone asked and what the
//! PC granted) and never changes. Before **every** frame of events the gate looks again: was the
//! session ended at the PC, is the master switch on, does the device still hold this level. Then
//! per record: does the session's level cover it (a pointer, key or text record on a media session
//! is a violation and closes it, whatever the grant says), is the PC locked (then only media
//! commands act; the phone learns it from the `locked` bit of the state), is it within the limits.
//! Only what passed reaches the sink. The release of a button always passes: nothing may stay
//! held because a limit or the lock got in the way.
//!
//! Nothing here touches the sync store, sets a grant or records anything.

use super::limits::{Limits, Verdict};
use super::remote::{Claimed, Ended, Flag, Remote};
use super::sink::{Action, InputSink};
use super::wire::{self, Code, Level, Opened, PcState, Record};
use crate::noise::PublicKey;
use crate::trust::SessionHandle;
use std::sync::Arc;
use std::time::Duration;

/// The PC tells the phone a changed state at most this often.
pub const STATE_INTERVAL: Duration = Duration::from_millis(200);

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
    Live(Box<Live>),
    Done,
}

struct Live {
    level: Level,
    flag: Arc<Flag>,
    limits: Limits,
    told: PcState,
    told_at: Duration,
}

pub struct InputConn {
    remote: Arc<Remote>,
    sink: Arc<dyn InputSink>,
    peer: PublicKey,
    handle: SessionHandle,
    phase: Phase,
}

fn closed(code: Code) -> Step {
    Step::ReplyClose(wire::TAG_CLOSED, wire::encode_code(code).to_vec())
}

fn refused(code: Code) -> Step {
    Step::ReplyClose(wire::TAG_REFUSED, wire::encode_code(code).to_vec())
}

impl InputConn {
    pub fn new(
        remote: Arc<Remote>,
        sink: Arc<dyn InputSink>,
        peer: PublicKey,
        handle: SessionHandle,
    ) -> Self {
        InputConn {
            remote,
            sink,
            peer,
            handle,
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
            Phase::AwaitOpen if tag == wire::TAG_OPEN => return self.open(body, now),
            Phase::Live(live) => {
                Self::events(&self.remote, &*self.sink, &self.peer, live, tag, body, now)
            }
            _ => Step::Close,
        };
        self.finish(step)
    }

    /// Called on every tick of the connection: what the PC has to say unasked (a changed state, or
    /// that the session was ended at the PC). Never resets the connection's idle timer.
    pub fn poll(&mut self, now: Duration) -> Step {
        let step = match &mut self.phase {
            Phase::Live(live) => match Self::still_allowed(&self.remote, &self.peer, live) {
                Err(step) => step,
                Ok(()) => {
                    let state = self.sink.state();
                    if state != live.told && now.saturating_sub(live.told_at) >= STATE_INTERVAL {
                        live.told = state;
                        live.told_at = now;
                        Step::Reply(wire::TAG_STATE, wire::encode_state(state).to_vec())
                    } else {
                        Step::Continue
                    }
                }
            },
            // before `open` the PC has nothing to say (a switch that is off is the answer to `open`)
            _ => Step::Continue,
        };
        self.finish(step)
    }

    fn open(&mut self, body: &[u8], now: Duration) -> Step {
        let step = self.try_open(body, now);
        self.finish(step)
    }

    fn try_open(&mut self, body: &[u8], now: Duration) -> Step {
        let Ok(asked) = wire::decode_open(body) else {
            return Step::Close;
        };
        // what the machine can do at all comes first: on a PC that cannot be controlled, "allow it
        // at the PC" would send the user on a pointless errand
        if !self.sink.supported() {
            return refused(Code::Unsupported);
        }
        let level = match self.remote.level_for(&self.peer, asked) {
            Ok((level, _)) => level,
            Err(code) => return refused(code),
        };
        let state = self.sink.state();
        if state.locked && level == Level::Full {
            return refused(Code::Locked);
        }
        match self.remote.claim(self.peer, asked, self.handle.clone()) {
            Err(code) => refused(code),
            Ok(Claimed {
                level,
                grant,
                flag,
                replaced,
            }) => {
                if replaced {
                    // whatever the older session of this device still held is let go now, before
                    // this one acts (its own teardown will not do it later, see `teardown`)
                    self.sink.release_all();
                }
                self.phase = Phase::Live(Box::new(Live {
                    level,
                    flag,
                    limits: Limits::new(now),
                    told: state,
                    told_at: now,
                }));
                let opened = Opened {
                    level,
                    grant: grant.level,
                    unlock_required: grant.unlock && grant.level == Level::Full,
                    state,
                };
                Step::Reply(wire::TAG_OPENED, wire::encode_opened(opened).to_vec())
            }
        }
    }

    /// The part of the gate that does not depend on the event: ended at the PC, switch, grant.
    fn still_allowed(remote: &Remote, peer: &PublicKey, live: &Live) -> Result<(), Step> {
        match live.flag.ended() {
            Some(Ended::With(code)) => return Err(closed(code)),
            Some(Ended::Silently) => return Err(Step::Close),
            None => {}
        }
        if !remote.enabled() {
            return Err(closed(Code::RemoteOff));
        }
        let grant = remote.grant_of(peer);
        match grant.effective() {
            l if l >= live.level => Ok(()),
            Level::Off if grant.paused => Err(closed(Code::Paused)),
            Level::Off => Err(closed(Code::NotGranted)),
            // something is left (media): no reason, the phone opens again and learns its grant
            _ => Err(Step::Close),
        }
    }

    fn events(
        remote: &Remote,
        sink: &dyn InputSink,
        peer: &PublicKey,
        live: &mut Live,
        tag: u8,
        body: &[u8],
        now: Duration,
    ) -> Step {
        if let Err(step) = Self::still_allowed(remote, peer, live) {
            return step;
        }
        match tag {
            wire::TAG_EVENTS => {
                let Ok(records) = wire::decode_events(body) else {
                    return Step::Close;
                };
                // the whole frame is judged before anything of it acts
                if live.level != Level::Full && records.iter().any(|r| r.needs_full()) {
                    return Step::Close;
                }
                for r in records {
                    let release = matches!(r, Record::Button { down: false, .. });
                    // the lock state is looked at for every record
                    let verdict = if !release && r.needs_full() && sink.state().locked {
                        live.limits.dropped(now)
                    } else {
                        live.limits.record(&r, now)
                    };
                    match verdict {
                        Verdict::Pass => sink.apply(Action::from(r)),
                        Verdict::Drop => {}
                        Verdict::Flood => return closed(Code::Limit),
                    }
                }
                Step::Continue
            }
            wire::TAG_TEXT => {
                if live.level != Level::Full {
                    return Step::Close;
                }
                let Ok(text) = wire::check_text(body) else {
                    return Step::Close;
                };
                let verdict = if sink.state().locked {
                    live.limits.dropped(now)
                } else {
                    live.limits.text(text.len(), now)
                };
                match verdict {
                    Verdict::Pass => sink.apply(Action::Text(text.to_owned())),
                    Verdict::Drop => {}
                    Verdict::Flood => return closed(Code::Limit),
                }
                Step::Continue
            }
            // a sync tag, a PC → phone tag, a second `open`, anything unknown
            _ => Step::Close,
        }
    }

    /// A closing step ends the session for good: buttons are let go and the slot is freed.
    fn finish(&mut self, step: Step) -> Step {
        if matches!(step, Step::Close | Step::ReplyClose(..)) {
            self.teardown();
        }
        step
    }

    fn teardown(&mut self) {
        if let Phase::Live(live) = std::mem::replace(&mut self.phase, Phase::Done) {
            // a session that was replaced by a newer one of the same device lets go of nothing
            // here: the newer one did that when it opened, and may be holding a button by now
            if !(live.flag.ended_silently() && self.remote.status().controller.is_some()) {
                self.sink.release_all();
            }
            self.remote.release(&live.flag);
        }
    }
}

impl Drop for InputConn {
    /// A dropped connection (socket gone, idle, hub stopped) ends like a closed one.
    fn drop(&mut self) {
        self.teardown();
    }
}
