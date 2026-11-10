//! The worker's logic over a fake system (runs on any machine).

use remote_input::{percent, stepped, Command, State, System, Worker, VOLUME_STEP};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Default)]
struct Pc {
    volume: Option<f32>,
    mute: Option<bool>,
    playing: Option<bool>,
    locked: Option<bool>,
    media: Vec<Command>,
    lock_calls: usize,
    /// How long every read takes (a slow system).
    slow: Duration,
}

struct Fake(Arc<Mutex<Pc>>);

impl System for Fake {
    fn volume(&mut self) -> Option<f32> {
        let slow = self.0.lock().unwrap().slow;
        std::thread::sleep(slow);
        self.0.lock().unwrap().volume
    }
    fn set_volume(&mut self, volume: f32) -> bool {
        let mut pc = self.0.lock().unwrap();
        pc.volume.is_some() && {
            pc.volume = Some(volume);
            true
        }
    }
    fn mute(&mut self) -> Option<bool> {
        self.0.lock().unwrap().mute
    }
    fn set_mute(&mut self, mute: bool) -> bool {
        self.0.lock().unwrap().mute = Some(mute);
        true
    }
    fn media(&mut self, command: Command) -> bool {
        let mut pc = self.0.lock().unwrap();
        pc.media.push(command);
        if command == Command::PlayPause {
            pc.playing = pc.playing.map(|p| !p);
        }
        true
    }
    fn playing(&mut self) -> Option<bool> {
        self.0.lock().unwrap().playing
    }
    fn lock(&mut self) -> bool {
        let mut pc = self.0.lock().unwrap();
        pc.lock_calls += 1;
        pc.locked = Some(true);
        true
    }
    fn locked(&mut self) -> Option<bool> {
        self.0.lock().unwrap().locked
    }
}

fn rig(pc: Pc) -> (Worker, Arc<Mutex<Pc>>) {
    let pc = Arc::new(Mutex::new(pc));
    let handle = pc.clone();
    (
        Worker::with(move || Some(Box::new(Fake(handle)) as Box<dyn System>)),
        pc,
    )
}

fn usual() -> Pc {
    Pc {
        volume: Some(0.42),
        mute: Some(false),
        playing: Some(true),
        locked: Some(false),
        ..Pc::default()
    }
}

/// Waits until the worker's state shows what `want` looks for.
fn until(w: &Worker, want: impl Fn(&State) -> bool) -> State {
    let began = Instant::now();
    loop {
        let s = w.state();
        if want(&s) {
            return s;
        }
        assert!(began.elapsed() < Duration::from_secs(5), "never: {s:?}");
        std::thread::sleep(Duration::from_millis(5));
    }
}

#[test]
fn the_state_is_the_four_facts() {
    let (w, _) = rig(usual());
    assert!(w.supported());
    let s = until(&w, |s| s.volume.is_some());
    assert_eq!(
        s,
        State {
            volume: Some(42),
            mute: false,
            playing: true,
            locked: false
        }
    );
}

#[test]
fn volume_moves_in_steps_of_two_percent_and_stays_in_range() {
    let (w, pc) = rig(usual());
    until(&w, |s| s.volume == Some(42));
    assert!(w.send(Command::VolumeUp));
    until(&w, |s| s.volume == Some(44));
    assert!(w.send(Command::VolumeDown));
    assert!(w.send(Command::VolumeDown));
    until(&w, |s| s.volume == Some(40));
    // the ends of the range
    pc.lock().unwrap().volume = Some(0.99);
    w.send(Command::VolumeUp);
    until(&w, |s| s.volume == Some(100));
    w.send(Command::VolumeUp);
    std::thread::sleep(Duration::from_millis(50));
    until(&w, |s| s.volume == Some(100));
    assert!(pc.lock().unwrap().volume.unwrap() <= 1.0);
    pc.lock().unwrap().volume = Some(0.01);
    w.send(Command::VolumeDown);
    until(&w, |s| s.volume == Some(0));
    w.send(Command::VolumeDown);
    std::thread::sleep(Duration::from_millis(50));
    assert_eq!(pc.lock().unwrap().volume, Some(0.0));

    assert_eq!(VOLUME_STEP, 0.02);
    assert_eq!(stepped(0.5, true), 0.52);
    assert_eq!(stepped(1.0, true), 1.0);
    assert_eq!(stepped(0.0, false), 0.0);
    assert_eq!(stepped(f32::NAN, true), VOLUME_STEP);
    assert_eq!(
        (percent(0.424), percent(0.425), percent(2.0)),
        (42, 43, 100)
    );
    assert_eq!((percent(-1.0), percent(f32::NAN)), (0, 0));
}

#[test]
fn louder_lifts_a_mute_and_quieter_does_not() {
    let (w, pc) = rig(Pc {
        mute: Some(true),
        ..usual()
    });
    until(&w, |s| s.mute);
    w.send(Command::VolumeDown);
    until(&w, |s| s.volume == Some(40));
    assert!(w.state().mute, "quieter leaves the mute alone");
    w.send(Command::VolumeUp);
    let s = until(&w, |s| !s.mute);
    assert_eq!(s.volume, Some(42));
    // the toggle
    w.send(Command::MuteToggle);
    until(&w, |s| s.mute);
    w.send(Command::MuteToggle);
    until(&w, |s| !s.mute);
    assert_eq!(pc.lock().unwrap().mute, Some(false));
}

#[test]
fn media_commands_reach_the_media_session_and_lock_locks() {
    let (w, pc) = rig(usual());
    until(&w, |s| s.playing);
    w.send(Command::PlayPause);
    until(&w, |s| !s.playing);
    w.send(Command::Next);
    w.send(Command::Previous);
    w.send(Command::Lock);
    let s = until(&w, |s| s.locked);
    assert!(!s.playing);
    let pc = pc.lock().unwrap();
    assert_eq!(
        pc.media,
        vec![Command::PlayPause, Command::Next, Command::Previous]
    );
    assert_eq!(pc.lock_calls, 1);
}

#[test]
fn what_cannot_be_read_is_no_volume_and_locked() {
    let (w, pc) = rig(Pc::default()); // no audio device, no media session, lock state unreadable
    std::thread::sleep(Duration::from_millis(50));
    let s = w.state();
    assert_eq!(s.volume, None);
    assert!(!s.mute && !s.playing);
    assert!(s.locked, "unknown is treated as locked");
    // commands do no harm on such a PC
    for c in [Command::VolumeUp, Command::VolumeDown, Command::MuteToggle] {
        w.send(c);
    }
    std::thread::sleep(Duration::from_millis(50));
    assert_eq!(pc.lock().unwrap().volume, None);
    assert_eq!(State::UNKNOWN.volume, None);
}

#[test]
fn the_caller_never_waits_for_a_slow_system_longer_than_the_bound() {
    let (w, pc) = rig(Pc {
        slow: Duration::from_millis(400),
        ..usual()
    });
    // the first reading is still being taken: the caller gets "unknown" within the bound
    let began = Instant::now();
    let s = w.state();
    assert!(began.elapsed() < remote_input::FRESH_WAIT + Duration::from_millis(100));
    assert_eq!(s, State::UNKNOWN);
    // sending never waits either
    let began = Instant::now();
    for _ in 0..100 {
        w.send(Command::MuteToggle);
    }
    assert!(began.elapsed() < Duration::from_millis(100));
    pc.lock().unwrap().slow = Duration::ZERO;
    until(&w, |s| s.volume.is_some());
}

#[test]
fn a_full_queue_drops_commands_instead_of_blocking() {
    let (w, pc) = rig(Pc {
        slow: Duration::from_millis(300),
        ..usual()
    });
    let accepted = (0..200).filter(|_| w.send(Command::Next)).count();
    assert!(accepted < 200, "some were dropped");
    assert!(accepted >= 1);
    pc.lock().unwrap().slow = Duration::ZERO;
    until(&w, |s| s.volume.is_some());
}

#[test]
fn where_the_pc_cannot_be_controlled_everything_is_a_no_op() {
    // a system that cannot be created (what `Worker::start` gets off Windows)
    let w = Worker::with(|| None);
    std::thread::sleep(Duration::from_millis(30));
    assert_eq!(w.state(), State::UNKNOWN);
    #[cfg(not(windows))]
    {
        let w = Worker::start();
        assert!(!w.supported());
        assert!(!w.send(Command::PlayPause));
        assert_eq!(w.state(), State::UNKNOWN);
    }
}

#[test]
fn nobody_asking_means_no_reading() {
    let (w, pc) = rig(usual());
    until(&w, |s| s.volume == Some(42));
    // the PC changes while nobody asks …
    pc.lock().unwrap().volume = Some(0.8);
    std::thread::sleep(Duration::from_millis(100));
    // … and the next asker (within the stale bound) gets the old reading at once, and the new
    // one right after
    until(&w, |s| s.volume == Some(80));
}
