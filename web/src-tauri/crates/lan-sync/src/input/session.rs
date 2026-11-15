//! One input connection on the hub: `hello`, then `open`, then events.
//!
//! The level of a session is fixed when it opens (the smaller of what the phone asked and what the
//! PC granted) and never changes. Before **every** frame of events the gate looks again: was the
//! session ended at the PC, is the master switch on, does the device still hold this level. Then
//! per record: does the session's level cover it (a pointer, key or text record on a media session
//! is a violation and closes it, whatever the grant says), is the PC locked (then only media
//! commands act; the phone learns it from the `locked` bit of the state), is it within the limits.
//! Only what passed reaches the sink.
//!
//! A session knows which mouse buttons it pressed. Letting go of one of those always passes (no
//! limit, no lock: nothing may stay held because something got in the way), and when the session
//! ends it lets go of exactly those – never of a button it did not press itself, so never of one
//! another device holds. (When the same device opens anew and presses the same button before its
//! older session has finished, the older one's end lets that button go: the drag ends early,
//! nothing stays held.) A release of a button this session does not hold is an ordinary event:
//! limited, and not applied on a locked PC.
//!
//! Power (a phone that asked for [`wire::FEATURE_POWER`] in its `open`): one action per frame,
//! one answer per frame. The gate here asks the session, the device's power permission and the
//! lock state; `Cancel` always passes. The countdown itself, and how often one may start, are the
//! sink's (they outlive a session). Monitor off is a media record, accepted only from a phone that
//! asked for the feature.
//!
//! Presentation (a phone that asked for [`wire::FEATURE_PRESENT`]): the keys F5 and B are taken
//! only on such a session, and like every key only on the mouse/keyboard level. From any other
//! session they close it, as an unknown id did before.
//!
//! Programs (a phone that asked for [`wire::FEATURE_PROGRAMS`]): when the device may start
//! programs, the PC tells the names of its list with the list's epoch right after `opened` (and
//! again when the list changes, or when the permission comes back within the session). A start
//! names a slot and the epoch of the list the phone was told – in this session or an earlier one;
//! it needs the mouse/keyboard session (else the session closes, like a key on a media session),
//! the device's permission, an unlocked PC and the limits (one per 5 s in the session; the sink
//! keeps one per 5 s per device across sessions). One answer per frame; every refusal counts as
//! a drop. The sink compares the epoch with its list's under the list's lock: an empty slot or a
//! list that changed since is `failed` – never a reason to close.
//!
//! Nothing here touches the sync store, sets a grant or records anything.

use super::limits::{Limits, Verdict};
use super::remote::{Claimed, Ended, Flag, Remote};
use super::sink::{Action, InputSink};
use super::wire::{
    self, Button, Code, Level, Media, Opened, OpenedExt, PcState, Power, PowerAnswer, PowerInfo,
    ProgramAnswer, Record,
};
use crate::noise::PublicKey;
use crate::trust::SessionHandle;
use std::sync::Arc;
use std::time::Duration;

/// The PC tells the phone its state at most this often: when it changed, and once after frames
/// came in (as the sign that they arrived).
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
    /// The mouse buttons this session pressed and has not let go of (left, right).
    held: [bool; 2],
    /// A frame came in since the state was last told: the next tick tells it again even if
    /// nothing changed, so the phone hears that its frames arrive (a volume step at 100 % changes
    /// nothing, and silence would look like a dead connection).
    answer_due: bool,
    told: PcState,
    told_at: Duration,
    /// The phone asked for power (and this PC accepted it).
    power: bool,
    /// The phone asked for the presentation keys (and this PC accepted them).
    present: bool,
    /// The newest countdown news the phone has heard of (or that came before it opened).
    news_seen: u64,
    /// The phone asked for the program list (and this PC accepted it).
    programs: bool,
    /// The epoch of the list this session told the phone (only to see when to tell it again; a
    /// start is checked against the PC's list, never against this). `None`: not told, or the
    /// permission is not in effect (it is told again when it comes back).
    programs_told: Option<u32>,
}

pub struct InputConn {
    remote: Arc<Remote>,
    sink: Arc<dyn InputSink>,
    peer: PublicKey,
    handle: SessionHandle,
    phase: Phase,
}

fn slot_of(button: Button) -> usize {
    match button {
        Button::Left => 0,
        Button::Right => 1,
    }
}

/// Frees the controller slot when dropped, whatever happens while the buttons are let go.
struct Releasing<'a>(&'a Remote, &'a Arc<Flag>);

impl Drop for Releasing<'_> {
    fn drop(&mut self) {
        self.0.release(self.1);
    }
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
                Ok(()) => match Self::program_list(&self.remote, &*self.sink, &self.peer, live)
                    .or_else(|| Self::news(&*self.sink, &self.peer, live))
                {
                    Some(step) => step,
                    None => {
                        let state = self.sink.state();
                        if (state != live.told || live.answer_due)
                            && now.saturating_sub(live.told_at) >= STATE_INTERVAL
                        {
                            live.told = state;
                            live.told_at = now;
                            live.answer_due = false;
                            Step::Reply(wire::TAG_STATE, wire::encode_state(state).to_vec())
                        } else {
                            Step::Continue
                        }
                    }
                },
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
        let Ok((asked, features)) = wire::decode_open(body) else {
            return Step::Close;
        };
        let power = features.is_some_and(|f| f & wire::FEATURE_POWER != 0);
        let present = features.is_some_and(|f| f & wire::FEATURE_PRESENT != 0);
        let programs = features.is_some_and(|f| f & wire::FEATURE_PROGRAMS != 0);
        // what the machine can do at all comes first: on a PC that cannot be controlled, "allow it
        // at the PC" would send the user on a pointless errand
        if !self.sink.supported() {
            return refused(Code::Unsupported);
        }
        let state = self.sink.state();
        // judged before the slot is touched, so that a refused open leaves this device's running
        // session alone (its media session, when the Touchpad is tapped on a locked PC). What
        // really keeps input off a locked PC is the check per event; this one is for the answer.
        match self.remote.level_for(&self.peer, asked) {
            Err(code) => return refused(code),
            Ok((Level::Full, _)) if state.locked => return refused(Code::Locked),
            Ok(_) => {}
        }
        match self.remote.claim(self.peer, asked, self.handle.clone()) {
            Err(code) => refused(code),
            Ok(Claimed { level, grant, flag }) => {
                // … and once more on the level the session really got: the grant may have been
                // raised between the two looks (only then is the older session already replaced)
                if state.locked && level == Level::Full {
                    self.remote.release(&flag);
                    return refused(Code::Locked);
                }
                self.phase = Phase::Live(Box::new(Live {
                    level,
                    flag,
                    limits: Limits::new(now),
                    held: [false; 2],
                    answer_due: false,
                    told: state,
                    told_at: now,
                    power,
                    present,
                    // what happened before this session is not news to it
                    news_seen: self.sink.power_news().map_or(0, |(n, _, _)| n),
                    programs,
                    programs_told: None,
                }));
                let ext = features.map(|features| {
                    let (pending, hibernate) = self.sink.power_info();
                    OpenedExt {
                        features,
                        power: PowerInfo {
                            granted: grant.power_effective(),
                            pending,
                            hibernate,
                        },
                    }
                });
                let opened = Opened {
                    level,
                    grant: grant.level,
                    unlock_required: grant.unlock && grant.level == Level::Full,
                    state,
                    ext,
                };
                Step::Reply(wire::TAG_OPENED, wire::encode_opened(opened))
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
        live.answer_due = true;
        match tag {
            wire::TAG_EVENTS => {
                let Ok(records) = wire::decode_events(body) else {
                    return Step::Close;
                };
                // the whole frame is judged before anything of it acts
                if live.level != Level::Full && records.iter().any(|r| r.needs_full()) {
                    return Step::Close;
                }
                // monitor off belongs to a phone that asked for power
                if !live.power && records.contains(&Record::Media(Media::MonitorOff)) {
                    return Step::Close;
                }
                // and the presentation keys to a phone that asked for them
                if !live.present && records.iter().any(Record::needs_present) {
                    return Step::Close;
                }
                for r in records {
                    if let Record::Button {
                        button,
                        down: false,
                    } = r
                    {
                        // letting go of a button this session holds: always, and at no cost
                        if std::mem::take(&mut live.held[slot_of(button)]) {
                            sink.apply(Action::from(r));
                            continue;
                        }
                    }
                    // the lock state is looked at for every record
                    let verdict = if r.needs_full() && sink.state().locked {
                        live.limits.dropped(now)
                    } else {
                        live.limits.record(&r, now)
                    };
                    match verdict {
                        Verdict::Pass => {
                            if let Record::Button { button, down: true } = r {
                                live.held[slot_of(button)] = true;
                            }
                            sink.apply(Action::from(r));
                        }
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
            wire::TAG_POWER if live.power => {
                let Ok((power, despite)) = wire::decode_power(body) else {
                    return Step::Close;
                };
                // every refusal counts as a drop, so a session cannot ask without end
                let (verdict, refused) = if power == Power::Cancel {
                    // stopping is always allowed: it costs only an ordinary event
                    (live.limits.cancel(now), None)
                } else if !remote.grant_of(peer).power_effective() {
                    (live.limits.dropped(now), Some(PowerAnswer::NotGranted))
                } else if sink.state().locked {
                    (live.limits.dropped(now), Some(PowerAnswer::Locked))
                } else {
                    (live.limits.power(now), None)
                };
                let answer = match (verdict, refused) {
                    (Verdict::Flood, _) => return closed(Code::Limit),
                    (_, Some(answer)) => answer,
                    (Verdict::Drop, None) => PowerAnswer::Limit,
                    (Verdict::Pass, None) => sink.power(peer, power, despite),
                };
                // (news this may have made comes again from the tick: the phone takes every
                // answer as the latest state, so hearing "cancelled" twice changes nothing)
                Step::Reply(
                    wire::TAG_POWER_ANSWER,
                    wire::encode_power_answer(answer).to_vec(),
                )
            }
            wire::TAG_PROGRAM_START if live.programs => {
                let Ok((slot, epoch)) = wire::decode_program_start(body) else {
                    return Step::Close;
                };
                // starting a program is the mouse/keyboard level, like a key
                if live.level != Level::Full {
                    return Step::Close;
                }
                // every refusal counts as a drop, so a session cannot ask without end
                let (verdict, refused) = if !remote.grant_of(peer).programs_effective() {
                    (live.limits.dropped(now), Some(ProgramAnswer::NotGranted))
                } else if sink.state().locked {
                    (live.limits.dropped(now), Some(ProgramAnswer::Locked))
                } else {
                    (live.limits.program(now), None)
                };
                let answer = match (verdict, refused) {
                    (Verdict::Flood, _) => return closed(Code::Limit),
                    (_, Some(answer)) => answer,
                    (Verdict::Drop, None) => ProgramAnswer::Limit,
                    // the sink checks the epoch and the slot against its list now
                    (Verdict::Pass, None) => sink.start_program(peer, slot, epoch),
                };
                Step::Reply(
                    wire::TAG_PROGRAM_ANSWER,
                    wire::encode_program_answer(answer).to_vec(),
                )
            }
            // a sync tag, a PC → phone tag, a second `open`, power or programs without asking,
            // anything unknown
            _ => Step::Close,
        }
    }

    /// The PC's program list, when the phone asked for it, the device may start programs and the
    /// phone has not been told this list yet (right after `opened`, after every change, and after
    /// the permission came back). Asks the sink for the epoch alone first: the names are read only
    /// when they are to be sent.
    fn program_list(
        remote: &Remote,
        sink: &dyn InputSink,
        peer: &PublicKey,
        live: &mut Live,
    ) -> Option<Step> {
        if !live.programs {
            return None;
        }
        if !remote.grant_of(peer).programs_effective() {
            // told again once it is in effect again
            live.programs_told = None;
            return None;
        }
        if live.programs_told == Some(sink.programs_version()) {
            return None;
        }
        let (epoch, names) = sink.programs();
        live.programs_told = Some(epoch);
        Some(Step::Reply(
            wire::TAG_PROGRAMS,
            wire::encode_programs(epoch, &names),
        ))
    }

    /// Countdown news of this device that the phone has not heard yet.
    fn news(sink: &dyn InputSink, peer: &PublicKey, live: &mut Live) -> Option<Step> {
        if !live.power {
            return None;
        }
        let (n, device, answer) = sink.power_news()?;
        if n <= live.news_seen {
            return None;
        }
        live.news_seen = n;
        (device == *peer).then(|| {
            Step::Reply(
                wire::TAG_POWER_ANSWER,
                wire::encode_power_answer(answer).to_vec(),
            )
        })
    }

    /// A closing step ends the session for good: its buttons are let go and the slot is freed.
    fn finish(&mut self, step: Step) -> Step {
        if matches!(step, Step::Close | Step::ReplyClose(..)) {
            self.teardown();
        }
        step
    }

    fn teardown(&mut self) {
        if let Phase::Live(live) = std::mem::replace(&mut self.phase, Phase::Done) {
            // the slot is freed (and the session stops counting as open) only after its buttons
            // are let go – also if the sink fails while doing so
            let _slot = Releasing(&self.remote, &live.flag);
            for button in [Button::Left, Button::Right] {
                if live.held[slot_of(button)] {
                    self.sink.apply(Action::Button {
                        button,
                        down: false,
                    });
                }
            }
        }
    }
}

impl Drop for InputConn {
    /// A dropped connection (socket gone, idle, hub stopped) ends like a closed one.
    fn drop(&mut self) {
        self.teardown();
    }
}
