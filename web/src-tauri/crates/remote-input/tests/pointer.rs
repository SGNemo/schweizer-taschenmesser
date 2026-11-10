//! The pointer's behaviour over a mouse that only writes down what it was asked to do.

use remote_input::{Button, Mouse, Pointer, PointerAction, QUEUE, WHEEL_UNIT};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Did {
    Moved(i32, i32),
    Button(Button, bool),
    Wheel(bool, i32),
}

#[derive(Clone, Default)]
struct Log(Arc<Mutex<Vec<Did>>>);

impl Log {
    fn all(&self) -> Vec<Did> {
        self.0.lock().unwrap().clone()
    }
    fn until(&self, want: impl Fn(&[Did]) -> bool) -> Vec<Did> {
        let end = Instant::now() + Duration::from_secs(10);
        loop {
            let all = self.all();
            if want(&all) || Instant::now() > end {
                return all;
            }
            std::thread::sleep(Duration::from_millis(2));
        }
    }
}

/// Writes down every call. With a gate, each call first says "I am here" and waits for a token.
struct Fake {
    log: Log,
    gate: Option<(Sender<()>, Receiver<()>)>,
    /// The system refuses presses.
    refuses: bool,
}

impl Fake {
    fn note(&mut self, did: Did) {
        if let Some((here, go)) = &self.gate {
            let _ = here.send(());
            let _ = go.recv();
        }
        self.log.0.lock().unwrap().push(did);
    }
}

impl Mouse for Fake {
    fn moved(&mut self, dx: i32, dy: i32) {
        self.note(Did::Moved(dx, dy));
    }
    fn button(&mut self, button: Button, down: bool) -> bool {
        self.note(Did::Button(button, down));
        !(down && self.refuses)
    }
    fn wheel(&mut self, horizontal: bool, amount: i32) {
        self.note(Did::Wheel(horizontal, amount));
    }
}

fn free() -> (Pointer, Log) {
    let log = Log::default();
    let pointer = Pointer::with(Box::new(Fake {
        log: log.clone(),
        gate: None,
        refuses: false,
    }));
    (pointer, log)
}

/// A pointer whose mouse stops at every call: `here` tells when it arrived, `go` lets it on.
fn gated() -> (Pointer, Log, Receiver<()>, Sender<()>) {
    let log = Log::default();
    let (here_tx, here) = mpsc::channel();
    let (go, go_rx) = mpsc::channel();
    let pointer = Pointer::with(Box::new(Fake {
        log: log.clone(),
        gate: Some((here_tx, go_rx)),
        refuses: false,
    }));
    (pointer, log, here, go)
}

fn arrived(here: &Receiver<()>) {
    here.recv_timeout(Duration::from_secs(10))
        .expect("the pointer thread reached the mouse");
}

const fn button(button: Button, down: bool) -> PointerAction {
    PointerAction::Button { button, down }
}
const LEFT_DOWN: PointerAction = button(Button::Left, true);
const LEFT_UP: PointerAction = button(Button::Left, false);
const RIGHT_DOWN: PointerAction = button(Button::Right, true);
const RIGHT_UP: PointerAction = button(Button::Right, false);
/// Something harmless that ends a sequence, so a test can wait for "everything before it ran".
const END: PointerAction = PointerAction::Scroll { dx: 7, dy: 0 };
const ENDED: Did = Did::Wheel(true, 7 * WHEEL_UNIT);

fn run(actions: &[PointerAction]) -> Vec<Did> {
    let (pointer, log) = free();
    for a in actions {
        pointer.send(*a);
    }
    assert!(pointer.send(END));
    let mut all = log.until(|l| l.last() == Some(&ENDED));
    assert_eq!(all.pop(), Some(ENDED));
    all
}

#[test]
fn a_move_is_relative_and_a_still_one_is_nothing() {
    let all = run(&[
        PointerAction::Move { dx: 0, dy: 0 },
        LEFT_DOWN,
        PointerAction::Move { dx: -128, dy: 127 },
    ]);
    assert_eq!(
        all,
        [Did::Button(Button::Left, true), Did::Moved(-128, 127)]
    );
}

#[test]
fn the_wheel_turns_in_units_down_is_positive_and_right_is_positive() {
    let all = run(&[
        PointerAction::Scroll { dx: 0, dy: 8 },
        PointerAction::Scroll { dx: -2, dy: 0 },
        PointerAction::Scroll { dx: 1, dy: -1 },
        PointerAction::Scroll { dx: 0, dy: 0 },
    ]);
    assert_eq!(WHEEL_UNIT * 8, 120, "eight units are one notch");
    assert_eq!(
        all,
        [
            Did::Wheel(false, -120),
            Did::Wheel(true, -2 * WHEEL_UNIT),
            Did::Wheel(false, WHEEL_UNIT),
            Did::Wheel(true, WHEEL_UNIT),
        ]
    );
}

#[test]
fn a_press_is_pressed_once_and_a_release_without_a_press_does_nothing() {
    let (pointer, log) = free();
    assert!(pointer.supported());
    // the real mouse may hold it: not ours to release
    assert!(!pointer.send(LEFT_UP));
    assert!(!pointer.send(RIGHT_UP));
    assert!(pointer.send(LEFT_DOWN));
    assert!(pointer.send(LEFT_DOWN));
    assert!(pointer.send(LEFT_UP));
    // the hub releases once more when the session ends
    assert!(!pointer.send(LEFT_UP));
    assert!(pointer.send(END));
    let all = log.until(|l| l.last() == Some(&ENDED));
    assert_eq!(
        all,
        [
            Did::Button(Button::Left, true),
            Did::Button(Button::Left, false),
            ENDED
        ]
    );
}

#[test]
fn a_press_the_system_refused_is_not_released_later() {
    let log = Log::default();
    let pointer = Pointer::with(Box::new(Fake {
        log: log.clone(),
        gate: None,
        refuses: true,
    }));
    assert!(pointer.send(LEFT_DOWN));
    assert!(pointer.send(LEFT_UP));
    assert!(pointer.send(END));
    let all = log.until(|l| l.last() == Some(&ENDED));
    assert_eq!(all, [Did::Button(Button::Left, true), ENDED]);
    drop(pointer);
    std::thread::sleep(Duration::from_millis(30));
    assert_eq!(log.all().len(), 2, "nothing to let go of at the end either");
}

#[test]
fn moves_that_wait_become_fewer_and_a_click_keeps_its_place() {
    let (pointer, log, here, go) = gated();
    assert!(pointer.send(PointerAction::Move { dx: 1, dy: 1 }));
    arrived(&here); // the thread holds the first move at the gate; the rest waits
    for _ in 0..3 {
        assert!(pointer.send(PointerAction::Move { dx: 100, dy: -100 }));
    }
    assert!(pointer.send(LEFT_DOWN));
    assert!(pointer.send(PointerAction::Move { dx: 5, dy: 5 }));
    for _ in 0..8 {
        let _ = go.send(());
    }
    let all = log.until(|l| l.last() == Some(&Did::Moved(5, 5)));
    assert_eq!(
        all,
        [
            Did::Moved(1, 1),
            Did::Moved(300, -300),
            Did::Button(Button::Left, true),
            Did::Moved(5, 5),
        ],
        "the three that waited are one, nothing of the way is lost, the press keeps its place"
    );
}

#[test]
fn a_full_queue_drops_moves_and_presses_but_never_a_release() {
    let (pointer, log, here, go) = gated();
    assert!(pointer.send(LEFT_DOWN));
    arrived(&here); // taken by the thread; what follows waits behind it
    for _ in 0..QUEUE {
        assert!(pointer.send(PointerAction::Scroll { dx: 0, dy: 1 }));
    }
    assert!(!pointer.send(PointerAction::Move { dx: 1, dy: 1 }));
    assert!(!pointer.send(PointerAction::Scroll { dx: 1, dy: 0 }));
    assert!(!pointer.send(RIGHT_DOWN));
    // a flood of releases nobody pressed for takes no room …
    for _ in 0..10_000 {
        assert!(!pointer.send(RIGHT_UP));
    }
    // … and the one that belongs to a press goes through, once
    assert!(pointer.send(LEFT_UP), "the release of a press is taken");
    assert!(!pointer.send(LEFT_UP));
    for _ in 0..(QUEUE + 4) {
        let _ = go.send(());
    }
    let all = log.until(|l| l.last() == Some(&Did::Button(Button::Left, false)));
    assert_eq!(all.first(), Some(&Did::Button(Button::Left, true)));
    assert_eq!(all.last(), Some(&Did::Button(Button::Left, false)));
    assert_eq!(all.len(), QUEUE + 2);
    assert!(!all.contains(&Did::Button(Button::Right, true)));
}

#[test]
fn dropping_the_last_handle_releases_what_is_held() {
    let (pointer, log) = free();
    let second = pointer.clone();
    assert!(pointer.send(LEFT_DOWN));
    assert!(pointer.send(RIGHT_DOWN));
    assert!(pointer.send(RIGHT_UP));
    assert!(pointer.send(END));
    log.until(|l| l.last() == Some(&ENDED));
    drop(pointer);
    std::thread::sleep(Duration::from_millis(30));
    assert_eq!(log.all().len(), 4, "a handle is left: nothing is released");
    drop(second);
    let all = log.until(|l| l.len() == 5);
    assert_eq!(all[4..], [Did::Button(Button::Left, false)]);
}

#[test]
fn a_thread_that_dies_lets_go_first() {
    struct Dies(Log);
    impl Mouse for Dies {
        fn moved(&mut self, _dx: i32, _dy: i32) {
            panic!("the mouse broke");
        }
        fn button(&mut self, button: Button, down: bool) -> bool {
            self.0 .0.lock().unwrap().push(Did::Button(button, down));
            true
        }
        fn wheel(&mut self, _horizontal: bool, _amount: i32) {}
    }
    let log = Log::default();
    let pointer = Pointer::with(Box::new(Dies(log.clone())));
    assert!(pointer.send(LEFT_DOWN));
    assert!(pointer.send(PointerAction::Move { dx: 1, dy: 0 }));
    let all = log.until(|l| l.len() == 2);
    assert_eq!(
        all,
        [
            Did::Button(Button::Left, true),
            Did::Button(Button::Left, false)
        ]
    );
}

#[test]
fn where_the_pointer_cannot_be_moved_everything_is_a_no_op() {
    if cfg!(windows) {
        return;
    }
    let pointer = Pointer::start();
    assert!(!pointer.supported());
    assert!(!pointer.send(LEFT_DOWN));
    assert!(!pointer.send(LEFT_UP));
}
