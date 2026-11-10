use super::limits::{Bucket, Limits, Verdict};
use super::remote::{ControlError, FileSwitch, MasterSwitch, MemorySwitch, Remote};
use super::session::{InputConn, Step, STATE_INTERVAL};
use super::sink::{Action, InputSink, NoSink};
use super::wire::{self, Button, Code, Key, Level, Media, Opened, PcState, Record};
use crate::noise::{Mode, PublicKey};
use crate::trust::{Device, MemoryTrustStore, RemoteGrant, SessionRegistry, TrustStore};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Records what reached the PC. Shared with the transport tests.
pub(crate) struct TestSink {
    pub actions: Mutex<Vec<Action>>,
    pub state: Mutex<PcState>,
    pub released: AtomicUsize,
    pub supported: AtomicBool,
}

impl TestSink {
    pub fn new() -> Arc<TestSink> {
        Arc::new(TestSink {
            actions: Mutex::new(Vec::new()),
            state: Mutex::new(PcState {
                volume: 42,
                mute: false,
                playing: true,
                locked: false,
            }),
            released: AtomicUsize::new(0),
            supported: AtomicBool::new(true),
        })
    }

    pub fn taken(&self) -> Vec<Action> {
        std::mem::take(&mut self.actions.lock().unwrap())
    }

    pub fn set_locked(&self, locked: bool) {
        self.state.lock().unwrap().locked = locked;
    }

    pub fn set_volume(&self, volume: u8) {
        self.state.lock().unwrap().volume = volume;
    }
}

impl InputSink for TestSink {
    fn supported(&self) -> bool {
        self.supported.load(Ordering::SeqCst)
    }
    fn state(&self) -> PcState {
        *self.state.lock().unwrap()
    }
    fn apply(&self, action: Action) {
        self.actions.lock().unwrap().push(action);
    }
    fn release_all(&self) {
        self.released.fetch_add(1, Ordering::SeqCst);
    }
}

const T0: Duration = Duration::from_secs(100);
const PHONE: u8 = 1;
const TABLET: u8 = 2;

fn key(b: u8) -> PublicKey {
    PublicKey::from_bytes([b; 32])
}

struct Bench {
    trust: Arc<MemoryTrustStore>,
    sessions: Arc<SessionRegistry>,
    remote: Arc<Remote>,
    sink: Arc<TestSink>,
}

/// Two paired devices, the master switch on, no grant for anybody.
fn bench() -> Bench {
    let trust = Arc::new(MemoryTrustStore::new());
    for b in [PHONE, TABLET] {
        trust
            .add(Device {
                key: key(b),
                name: "Device".into(),
                last_seen: None,
                revoked: false,
            })
            .unwrap();
    }
    let sessions = Arc::new(SessionRegistry::new());
    let switch = Arc::new(MemorySwitch::new());
    switch.set(true).unwrap();
    let remote = Arc::new(Remote::new(trust.clone(), switch, sessions.clone()));
    Bench {
        trust,
        sessions,
        remote,
        sink: TestSink::new(),
    }
}

fn grant(level: Level) -> RemoteGrant {
    RemoteGrant {
        level,
        ..RemoteGrant::default()
    }
}

impl Bench {
    fn grant(&self, device: u8, level: Level) {
        self.remote.set_grant(&key(device), grant(level)).unwrap();
    }

    /// A connection that said `hello`.
    fn conn(&self, device: u8) -> InputConn {
        let handle = self.sessions.register(key(device), Mode::Input);
        let mut c = InputConn::new(self.remote.clone(), self.sink.clone(), key(device), handle);
        assert_eq!(c.on_hello(), Step::Continue);
        c
    }

    fn open(&self, device: u8, level: Level) -> (InputConn, Step) {
        let mut c = self.conn(device);
        let step = c.on_frame(wire::TAG_OPEN, &wire::encode_open(level), T0);
        (c, step)
    }

    /// Opens and expects `opened`.
    fn opened(&self, device: u8, level: Level) -> (InputConn, Opened) {
        let (c, step) = self.open(device, level);
        let Step::Reply(wire::TAG_OPENED, body) = step else {
            panic!("not opened: {step:?}")
        };
        (c, wire::decode_opened(&body).unwrap())
    }

    fn refusal(&self, device: u8, level: Level) -> Code {
        let (_c, step) = self.open(device, level);
        let Step::ReplyClose(wire::TAG_REFUSED, body) = step else {
            panic!("not refused: {step:?}")
        };
        wire::decode_code(&body).unwrap()
    }
}

fn events(c: &mut InputConn, records: &[Record], at: Duration) -> Step {
    c.on_frame(wire::TAG_EVENTS, &wire::encode_events(records).unwrap(), at)
}

fn closed_with(step: &Step) -> Code {
    let Step::ReplyClose(wire::TAG_CLOSED, body) = step else {
        panic!("not closed with a code: {step:?}")
    };
    wire::decode_code(body).unwrap()
}

const MOVE: Record = Record::Move { dx: 3, dy: -2 };
const CLICK: Record = Record::Button {
    button: Button::Left,
    down: true,
};
const UNCLICK: Record = Record::Button {
    button: Button::Left,
    down: false,
};
const PAUSE: Record = Record::Media(Media::PlayPause);

// ---- pairing is not permission ----

#[test]
fn a_paired_device_controls_nothing_until_the_pc_says_so() {
    let b = bench();
    // paired, switch on, no grant
    assert_eq!(b.refusal(PHONE, Level::Media), Code::NotGranted);
    assert_eq!(b.refusal(PHONE, Level::Full), Code::NotGranted);
    // a grant, but the master switch is off
    b.grant(PHONE, Level::Full);
    b.remote.set_enabled(false).unwrap();
    assert_eq!(b.refusal(PHONE, Level::Media), Code::RemoteOff);
    b.remote.set_enabled(true).unwrap();
    // paused at the PC
    b.remote
        .set_grant(
            &key(PHONE),
            RemoteGrant {
                paused: true,
                ..grant(Level::Full)
            },
        )
        .unwrap();
    assert_eq!(b.refusal(PHONE, Level::Media), Code::Paused);
    // another device's grant is not this device's
    assert_eq!(b.refusal(TABLET, Level::Media), Code::NotGranted);
    // a revoked device has no grant left
    b.grant(TABLET, Level::Full);
    b.trust.revoke(&key(TABLET)).unwrap();
    assert_eq!(b.remote.grant_of(&key(TABLET)), RemoteGrant::default());
    assert_eq!(b.refusal(TABLET, Level::Full), Code::NotGranted);
    assert!(b.sink.taken().is_empty());
}

#[test]
fn a_pc_that_cannot_be_controlled_says_so_and_a_locked_pc_opens_for_media_only() {
    let b = bench();
    b.grant(PHONE, Level::Full);
    b.sink.supported.store(false, Ordering::SeqCst);
    assert_eq!(b.refusal(PHONE, Level::Media), Code::Unsupported);
    b.sink.supported.store(true, Ordering::SeqCst);
    b.sink.set_locked(true);
    assert_eq!(b.refusal(PHONE, Level::Full), Code::Locked);
    let (_c, o) = b.opened(PHONE, Level::Media);
    assert_eq!(o.level, Level::Media);
    assert!(o.state.locked);

    // the sink of a PC without remote control
    let none = NoSink;
    assert!(!none.supported());
    assert_eq!(none.state(), PcState::UNKNOWN);
}

#[test]
fn the_level_of_a_session_is_the_smaller_of_asked_and_granted() {
    let b = bench();
    b.grant(PHONE, Level::Full);
    let (c, o) = b.opened(PHONE, Level::Media);
    assert_eq!((o.level, o.grant), (Level::Media, Level::Full));
    assert!(o.unlock_required, "full grant with the unlock option on");
    assert_eq!(o.state.volume, 42);
    drop(c);
    let (c, o) = b.opened(PHONE, Level::Full);
    assert_eq!((o.level, o.grant), (Level::Full, Level::Full));
    drop(c);

    b.grant(TABLET, Level::Media);
    let (c, o) = b.opened(TABLET, Level::Full);
    assert_eq!((o.level, o.grant), (Level::Media, Level::Media));
    assert!(!o.unlock_required, "never asked of a media grant");
    drop(c);

    // the unlock option off
    b.remote
        .set_grant(
            &key(PHONE),
            RemoteGrant {
                unlock: false,
                ..grant(Level::Full)
            },
        )
        .unwrap();
    let (_c, o) = b.opened(PHONE, Level::Media);
    assert!(!o.unlock_required);
}

// ---- the gate ----

#[test]
fn a_full_session_acts_in_order() {
    let b = bench();
    b.grant(PHONE, Level::Full);
    let (mut c, _) = b.opened(PHONE, Level::Full);
    assert_eq!(
        events(
            &mut c,
            &[MOVE, CLICK, UNCLICK, Record::Key(Key::Enter), PAUSE],
            T0
        ),
        Step::Continue
    );
    assert_eq!(
        c.on_frame(wire::TAG_TEXT, "Grüße".as_bytes(), T0),
        Step::Continue
    );
    assert!(
        b.sink.taken()
            == vec![
                Action::Move { dx: 3, dy: -2 },
                Action::Button {
                    button: Button::Left,
                    down: true
                },
                Action::Button {
                    button: Button::Left,
                    down: false
                },
                Action::Key(Key::Enter),
                Action::Media(Media::PlayPause),
                Action::Text("Grüße".into()),
            ]
    );
}

#[test]
fn a_media_session_closes_on_a_pointer_key_or_text_frame_whatever_the_grant() {
    let b = bench();
    b.grant(PHONE, Level::Full); // the grant is full, the session is not
    for frame in [
        (wire::TAG_EVENTS, wire::encode_events(&[MOVE]).unwrap()),
        (wire::TAG_EVENTS, wire::encode_events(&[CLICK]).unwrap()),
        (
            wire::TAG_EVENTS,
            wire::encode_events(&[Record::Key(Key::AltTab)]).unwrap(),
        ),
        (
            wire::TAG_EVENTS,
            wire::encode_events(&[Record::Scroll { dx: 0, dy: 1 }]).unwrap(),
        ),
        // a media command first does not smuggle the rest in: nothing of the frame acts
        (
            wire::TAG_EVENTS,
            wire::encode_events(&[PAUSE, MOVE]).unwrap(),
        ),
        (wire::TAG_TEXT, b"calc".to_vec()),
    ] {
        let (mut c, o) = b.opened(PHONE, Level::Media);
        assert_eq!(o.level, Level::Media);
        assert_eq!(c.on_frame(frame.0, &frame.1, T0), Step::Close);
        assert!(b.sink.taken().is_empty(), "nothing acted");
        // closed for good
        assert_eq!(events(&mut c, &[PAUSE], T0), Step::Close);
        assert!(b.sink.taken().is_empty());
    }
    // and media commands do work on it
    let (mut c, _) = b.opened(PHONE, Level::Media);
    assert_eq!(events(&mut c, &[PAUSE], T0), Step::Continue);
    assert!(b.sink.taken() == vec![Action::Media(Media::PlayPause)]);
}

#[test]
fn a_locked_pc_takes_media_commands_only() {
    let b = bench();
    b.grant(PHONE, Level::Full);
    let (mut c, _) = b.opened(PHONE, Level::Full);
    b.sink.set_locked(true);
    assert_eq!(
        events(&mut c, &[MOVE, CLICK, Record::Key(Key::Enter), PAUSE], T0),
        Step::Continue
    );
    assert_eq!(c.on_frame(wire::TAG_TEXT, b"hello", T0), Step::Continue);
    assert!(b.sink.taken() == vec![Action::Media(Media::PlayPause)]);
    // unlocked again (at the PC): the session goes on
    b.sink.set_locked(false);
    assert_eq!(events(&mut c, &[MOVE], T0), Step::Continue);
    assert_eq!(b.sink.taken().len(), 1);
}

#[test]
fn every_frame_looks_at_the_switch_and_the_grant_again() {
    // the master switch
    let b = bench();
    b.grant(PHONE, Level::Full);
    let (mut c, _) = b.opened(PHONE, Level::Full);
    b.remote.set_enabled(false).unwrap();
    assert_eq!(closed_with(&events(&mut c, &[MOVE], T0)), Code::RemoteOff);
    assert!(b.sink.taken().is_empty());
    assert_eq!(b.sink.released.load(Ordering::SeqCst), 1, "buttons let go");

    // the level is lowered below the session's
    let b = bench();
    b.grant(PHONE, Level::Full);
    let (mut c, _) = b.opened(PHONE, Level::Full);
    b.grant(PHONE, Level::Media);
    assert_eq!(closed_with(&events(&mut c, &[PAUSE], T0)), Code::NotGranted);
    assert!(b.sink.taken().is_empty());

    // lowered, but not below the session's level: it goes on
    let b = bench();
    b.grant(PHONE, Level::Full);
    let (mut c, _) = b.opened(PHONE, Level::Media);
    b.grant(PHONE, Level::Media);
    assert_eq!(events(&mut c, &[PAUSE], T0), Step::Continue);

    // the grant is taken away / the device is revoked
    for take_away in [0, 1] {
        let b = bench();
        b.grant(PHONE, Level::Media);
        let (mut c, _) = b.opened(PHONE, Level::Media);
        if take_away == 0 {
            b.grant(PHONE, Level::Off);
        } else {
            b.trust.revoke(&key(PHONE)).unwrap();
        }
        assert_eq!(closed_with(&events(&mut c, &[PAUSE], T0)), Code::NotGranted);
        assert!(b.sink.taken().is_empty());
    }
}

#[test]
fn ending_at_the_pc_closes_with_a_reason_and_pauses_that_device() {
    let b = bench();
    b.grant(PHONE, Level::Full);
    b.grant(TABLET, Level::Media);
    let (mut c, _) = b.opened(PHONE, Level::Full);
    assert_eq!(
        b.remote.status().controller,
        Some((key(PHONE), Level::Full))
    );
    assert_eq!(b.remote.end(), Some(key(PHONE)));
    assert_eq!(
        b.remote.status().controller,
        None,
        "the slot is free at once"
    );
    // the session hears it on its next tick, without any frame from the phone
    assert_eq!(closed_with(&c.poll(T0)), Code::Ended);
    assert_eq!(b.sink.released.load(Ordering::SeqCst), 1);
    assert_eq!(c.poll(T0), Step::Continue, "over: nothing more to say");
    assert_eq!(events(&mut c, &[MOVE], T0), Step::Close);
    assert!(b.sink.taken().is_empty());
    // paused until someone at the PC switches it on again; the level is remembered
    let g = b.remote.grant_of(&key(PHONE));
    assert!(g.paused && g.level == Level::Full);
    assert_eq!(b.refusal(PHONE, Level::Media), Code::Paused);
    // the other device is not affected
    let (_t, o) = b.opened(TABLET, Level::Media);
    assert_eq!(o.level, Level::Media);
    // nobody controls: nothing to end
    drop(_t);
    assert_eq!(b.remote.end(), None);
    // switched on again at the PC
    b.grant(PHONE, Level::Full);
    assert!(!b.remote.grant_of(&key(PHONE)).paused);
    b.opened(PHONE, Level::Full);
}

#[test]
fn an_event_that_races_the_end_does_not_act() {
    let b = bench();
    b.grant(PHONE, Level::Full);
    let (mut c, _) = b.opened(PHONE, Level::Full);
    b.remote.end();
    assert_eq!(
        closed_with(&events(&mut c, &[MOVE, CLICK], T0)),
        Code::Ended
    );
    assert!(b.sink.taken().is_empty());
}

// ---- one controller ----

#[test]
fn one_device_controls_at_a_time_and_the_slot_is_taken_only_by_an_open() {
    let b = bench();
    b.grant(PHONE, Level::Media);
    b.grant(TABLET, Level::Full);
    // a connection that only said hello holds nothing
    let idle = b.conn(TABLET);
    let (phone, _) = b.opened(PHONE, Level::Media);
    assert_eq!(b.refusal(TABLET, Level::Full), Code::Busy);
    drop(idle);
    assert_eq!(b.refusal(TABLET, Level::Full), Code::Busy);
    // the phone's connection goes away: the slot is free
    drop(phone);
    assert_eq!(b.remote.status().controller, None);
    let (_t, o) = b.opened(TABLET, Level::Full);
    assert_eq!(o.level, Level::Full);
    assert_eq!(b.refusal(PHONE, Level::Media), Code::Busy);
}

#[test]
fn the_same_device_moves_from_media_to_full_by_opening_anew() {
    let b = bench();
    b.grant(PHONE, Level::Full);
    let (mut media, _) = b.opened(PHONE, Level::Media);
    let (mut full, o) = b.opened(PHONE, Level::Full);
    assert_eq!(o.level, Level::Full);
    assert_eq!(
        b.remote.status().controller,
        Some((key(PHONE), Level::Full))
    );
    // the older session ends without a word and can do nothing any more
    assert_eq!(events(&mut media, &[PAUSE], T0), Step::Close);
    assert!(b.sink.taken().is_empty());
    // … and its end does not free the newer session's slot
    drop(media);
    assert_eq!(
        b.remote.status().controller,
        Some((key(PHONE), Level::Full))
    );
    assert_eq!(events(&mut full, &[MOVE], T0), Step::Continue);
    assert_eq!(b.sink.taken().len(), 1);
}

#[test]
fn a_session_closed_by_the_registry_no_longer_holds_the_slot() {
    let b = bench();
    b.grant(PHONE, Level::Full);
    b.grant(TABLET, Level::Media);
    let (_phone, _) = b.opened(PHONE, Level::Full);
    assert!(b.remote.full_session_open());
    // revoke closes the device's sessions (registry), whatever its connection thread does
    b.sessions.revoke(&*b.trust, &key(PHONE)).unwrap();
    assert!(!b.remote.full_session_open());
    assert_eq!(b.remote.status().controller, None);
    b.opened(TABLET, Level::Media);
}

// ---- nothing is widened while a device controls mouse and keyboard ----

#[test]
fn no_widening_while_a_mouse_and_keyboard_session_is_open() {
    let b = bench();
    b.grant(PHONE, Level::Full);
    b.grant(TABLET, Level::Media);
    let paused = RemoteGrant {
        paused: true,
        ..grant(Level::Media)
    };
    b.remote.set_grant(&key(TABLET), paused).unwrap();
    let (full, _) = b.opened(PHONE, Level::Full);

    let busy = Err(ControlError::BusyControlled);
    // a higher level, lifting a pause, dropping the unlock request: all refused
    assert_eq!(
        b.remote.set_grant(
            &key(TABLET),
            RemoteGrant {
                level: Level::Full,
                ..paused
            }
        ),
        busy
    );
    assert_eq!(b.remote.set_grant(&key(TABLET), grant(Level::Media)), busy);
    assert_eq!(
        b.remote.set_grant(
            &key(PHONE),
            RemoteGrant {
                unlock: false,
                ..grant(Level::Full)
            }
        ),
        busy
    );
    assert_eq!(b.remote.grant_of(&key(TABLET)), paused, "nothing changed");
    assert!(b.remote.grant_of(&key(PHONE)).unlock);
    // narrowing always works
    b.remote
        .set_grant(
            &key(TABLET),
            RemoteGrant {
                level: Level::Off,
                ..paused
            },
        )
        .unwrap();
    // once that session is over, widening works again
    drop(full);
    b.remote
        .set_grant(&key(TABLET), grant(Level::Full))
        .unwrap();
}

#[test]
fn the_guard_hangs_on_the_opened_level_not_on_the_grant() {
    let b = bench();
    b.grant(PHONE, Level::Full);
    // a device with a full grant that opened a media session cannot click anything
    let (_media, o) = b.opened(PHONE, Level::Media);
    assert_eq!(o.level, Level::Media);
    assert!(!b.remote.full_session_open());
    b.remote
        .set_grant(&key(TABLET), grant(Level::Full))
        .unwrap();
}

#[test]
fn unknown_devices_cannot_be_granted_and_the_switch_is_off_by_default() {
    let b = bench();
    assert_eq!(
        b.remote.set_grant(&key(9), grant(Level::Media)),
        Err(ControlError::NotFound)
    );
    b.trust.revoke(&key(TABLET)).unwrap();
    assert_eq!(
        b.remote.set_grant(&key(TABLET), grant(Level::Media)),
        Err(ControlError::NotFound)
    );
    assert!(!MemorySwitch::new().enabled());
    assert_eq!(RemoteGrant::default().level, Level::Off);
    assert!(RemoteGrant::default().unlock && !RemoteGrant::default().paused);
}

// ---- protocol ----

#[test]
fn the_order_is_hello_open_events_and_anything_else_closes() {
    let b = bench();
    b.grant(PHONE, Level::Full);
    let fresh = || {
        let handle = b.sessions.register(key(PHONE), Mode::Input);
        InputConn::new(b.remote.clone(), b.sink.clone(), key(PHONE), handle)
    };
    // open before hello
    let mut c = fresh();
    assert_eq!(
        c.on_frame(wire::TAG_OPEN, &wire::encode_open(Level::Media), T0),
        Step::Close
    );
    // hello twice
    let mut c = fresh();
    assert_eq!(c.on_hello(), Step::Continue);
    assert_eq!(c.on_hello(), Step::Close);
    // events before open
    let mut c = b.conn(PHONE);
    assert_eq!(events(&mut c, &[PAUSE], T0), Step::Close);
    // a malformed open
    for bad in [&[][..], &[0], &[3], &[1, 1]] {
        let mut c = b.conn(PHONE);
        assert_eq!(c.on_frame(wire::TAG_OPEN, bad, T0), Step::Close);
    }
    assert_eq!(b.remote.status().controller, None);
    // in an open session: a second open, a sync tag, a PC → phone tag, an unknown tag, bad bodies
    for (tag, body) in [
        (wire::TAG_OPEN, wire::encode_open(Level::Full).to_vec()),
        (crate::client::TAG_REQUEST, b"{\"type\":\"info\"}".to_vec()),
        (crate::client::TAG_RESPONSE, vec![]),
        (wire::TAG_OPENED, vec![2, 2, 0, 0, 0, 0, 0]),
        (wire::TAG_STATE, vec![0, 0, 0, 0]),
        (wire::TAG_CLOSED, vec![1]),
        (0x27, vec![]),
        (0xff, vec![1, 2, 3, 4]),
        (wire::TAG_EVENTS, vec![9, 0, 0, 0]),
        (wire::TAG_EVENTS, vec![1, 0, 0]),
        (wire::TAG_TEXT, b"a\nb".to_vec()),
        (wire::TAG_TEXT, vec![]),
    ] {
        let (mut c, _) = b.opened(PHONE, Level::Full);
        assert_eq!(c.on_frame(tag, &body, T0), Step::Close, "tag {tag:#x}");
        assert!(b.sink.taken().is_empty());
        assert_eq!(b.remote.status().controller, None, "slot freed");
    }
}

#[test]
fn the_pc_tells_a_changed_state_at_most_every_interval_and_nothing_else() {
    let b = bench();
    b.grant(PHONE, Level::Media);
    let (mut c, _) = b.opened(PHONE, Level::Media);
    assert_eq!(c.poll(T0), Step::Continue, "nothing changed");
    b.sink.set_volume(50);
    assert_eq!(c.poll(T0 + STATE_INTERVAL / 2), Step::Continue, "too soon");
    let Step::Reply(wire::TAG_STATE, body) = c.poll(T0 + STATE_INTERVAL) else {
        panic!("no state")
    };
    assert_eq!(wire::decode_state(&body).unwrap().volume, 50);
    assert_eq!(
        c.poll(T0 + STATE_INTERVAL * 2),
        Step::Continue,
        "told already"
    );
    // a connection that has not opened says nothing; switching off closes it in the registry
    let mut idle = b.conn(TABLET);
    assert_eq!(idle.poll(T0), Step::Continue);
    assert_eq!(b.sessions.open_count(), 2);
    b.remote.set_enabled(false).unwrap();
    assert_eq!(b.sessions.open_count(), 0);
}

// ---- limits ----

#[test]
fn buckets_refill_with_time_and_never_past_their_burst() {
    let mut b = Bucket::new(5, 50, T0); // 5 at once, 5 per second
    for _ in 0..5 {
        assert!(b.take(1, T0));
    }
    assert!(!b.take(1, T0));
    assert!(!b.take(1, T0 + Duration::from_millis(100)), "half a token");
    assert!(b.take(1, T0 + Duration::from_millis(200)));
    // a long pause fills it up to the burst, not beyond
    let later = T0 + Duration::from_secs(3600);
    for _ in 0..5 {
        assert!(b.take(1, later));
    }
    assert!(!b.take(1, later));
    // time running backwards refills nothing
    assert!(!b.take(1, T0));
    // more than the burst never fits
    assert!(!Bucket::new(5, 50, T0).take(6, T0));
    assert!(!Bucket::new(5, 50, T0).take(u64::MAX, T0));
}

#[test]
fn each_kind_has_its_own_limit() {
    let count = |r: Record, n: usize| {
        let mut l = Limits::new(T0);
        (0..n).filter(|_| l.record(&r, T0) == Verdict::Pass).count()
    };
    assert_eq!(count(MOVE, 1000), 250);
    assert_eq!(count(CLICK, 100), 20);
    assert_eq!(count(Record::Key(Key::Enter), 100), 30);
    assert_eq!(count(PAUSE, 100), 10);
    assert_eq!(
        count(Record::Media(Media::VolumeUp), 100),
        5,
        "no jump to 100 %"
    );
    assert_eq!(count(Record::Media(Media::VolumeDown), 100), 10);
    assert_eq!(count(Record::Media(Media::Lock), 100), 1);
    // a release passes even when no click is left
    let mut l = Limits::new(T0);
    for _ in 0..40 {
        l.record(&CLICK, T0);
    }
    assert_eq!(l.record(&CLICK, T0), Verdict::Drop);
    assert_eq!(l.record(&UNCLICK, T0), Verdict::Pass);
    // text counts bytes: 512 at once
    let mut l = Limits::new(T0);
    assert_eq!(l.text(256, T0), Verdict::Pass);
    assert_eq!(l.text(256, T0), Verdict::Pass);
    assert_eq!(l.text(1, T0), Verdict::Drop);
    assert_eq!(l.text(1, T0 + Duration::from_secs(1)), Verdict::Pass);
    // a second lock needs ten seconds
    let mut l = Limits::new(T0);
    let lock = Record::Media(Media::Lock);
    assert_eq!(l.record(&lock, T0), Verdict::Pass);
    assert_eq!(l.record(&lock, T0 + Duration::from_secs(9)), Verdict::Drop);
    assert_eq!(l.record(&lock, T0 + Duration::from_secs(10)), Verdict::Pass);
}

#[test]
fn a_flood_is_dropped_and_then_closes_the_session() {
    let b = bench();
    b.grant(PHONE, Level::Full);
    let (mut c, _) = b.opened(PHONE, Level::Full);
    let frame = [MOVE; wire::MAX_RECORDS];
    let mut last = Step::Continue;
    let mut frames = 0;
    while last == Step::Continue && frames < 200 {
        last = events(&mut c, &frame, T0);
        frames += 1;
    }
    assert_eq!(closed_with(&last), Code::Limit);
    assert_eq!(b.sink.taken().len(), 250, "only the burst acted");
    assert!(frames < 100, "closed after about 2250 events, not later");
    assert_eq!(b.remote.status().controller, None);
    // a steady touchpad (240 events per second for a minute) never gets there
    let (mut c, _) = b.opened(PHONE, Level::Full);
    for i in 0..(240 * 60) {
        let at = T0 + Duration::from_micros(i * 1_000_000 / 240);
        assert_eq!(events(&mut c, &[MOVE], at), Step::Continue);
    }
    assert_eq!(b.sink.taken().len(), 240 * 60);
}

// ---- the switch on disk ----

#[test]
fn the_switch_file_is_off_when_missing_and_an_error_when_broken() {
    let dir = std::env::temp_dir().join(format!("lan-remote-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("remote.json");
    assert!(!FileSwitch::open(&path).unwrap().enabled(), "missing = off");
    {
        let s = FileSwitch::open(&path).unwrap();
        s.set(true).unwrap();
        assert!(s.enabled());
    }
    assert!(
        FileSwitch::open(&path).unwrap().enabled(),
        "survives a restart"
    );
    FileSwitch::open(&path).unwrap().set(false).unwrap();
    assert!(!FileSwitch::open(&path).unwrap().enabled());
    for bad in [
        &b"{"[..],
        br#"{"v":2,"enabled":true}"#,
        br#"{"v":1}"#,
        b"true",
    ] {
        std::fs::write(&path, bad).unwrap();
        assert!(FileSwitch::open(&path).is_err(), "never guessed");
    }
    // unwritable: "on" does not happen, "off" does
    std::fs::write(&path, br#"{"v":1,"enabled":true}"#).unwrap();
    let s = FileSwitch::open(&path).unwrap();
    std::fs::create_dir_all(dir.join("remote.json.tmp")).unwrap();
    assert!(s.set(false).is_err());
    assert!(!s.enabled(), "off at once, written or not");
    assert!(s.set(true).is_err());
    assert!(!s.enabled(), "on only once it is on disk");
    std::fs::remove_dir_all(dir).ok();
}
