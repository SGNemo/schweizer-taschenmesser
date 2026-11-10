//! The pointer's behaviour over a mouse that only writes down what it was asked to do.

use remote_input::{Button, Hand, Mouse, Pointer, PointerAction, QUEUE, RELEASE_ROOM, WHEEL_UNIT};
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
        let end = Instant::now() + Duration::from_secs(5);
        loop {
            let all = self.all();
            if want(&all) || Instant::now() > end {
                return all;
            }
            std::thread::sleep(Duration::from_millis(2));
        }
    }
}

/// Writes down every call; with a gate, each call first waits for a token.
struct Fake {
    log: Log,
    gate: Option<Receiver<()>>,
}

impl Fake {
    fn note(&mut self, did: Did) {
        if let Some(gate) = &self.gate {
            let _ = gate.recv();
        }
        self.log.0.lock().unwrap().push(did);
    }
}

impl Mouse for Fake {
    fn moved(&mut self, dx: i32, dy: i32) {
        self.note(Did::Moved(dx, dy));
    }
    fn button(&mut self, button: Button, down: bool) {
        self.note(Did::Button(button, down));
    }
    fn wheel(&mut self, horizontal: bool, amount: i32) {
        self.note(Did::Wheel(horizontal, amount));
    }
}

fn hand() -> (Hand<dyn Mouse>, Log) {
    let log = Log::default();
    let mouse: Box<dyn Mouse> = Box::new(Fake {
        log: log.clone(),
        gate: None,
    });
    (Hand::new(mouse), log)
}

fn gated() -> (Pointer, Log, Sender<()>) {
    let log = Log::default();
    let (open, gate) = mpsc::channel();
    let pointer = Pointer::with(Box::new(Fake {
        log: log.clone(),
        gate: Some(gate),
    }));
    (pointer, log, open)
}

const LEFT_DOWN: PointerAction = PointerAction::Button {
    button: Button::Left,
    down: true,
};
const LEFT_UP: PointerAction = PointerAction::Button {
    button: Button::Left,
    down: false,
};
const RIGHT_UP: PointerAction = PointerAction::Button {
    button: Button::Right,
    down: false,
};

#[test]
fn a_move_is_relative_and_a_still_one_is_nothing() {
    let (mut hand, log) = hand();
    hand.apply(PointerAction::Move { dx: -128, dy: 127 });
    hand.apply(PointerAction::Move { dx: 0, dy: 0 });
    assert_eq!(log.all(), [Did::Moved(-128, 127)]);
}

#[test]
fn the_wheel_turns_in_units_down_is_positive_and_right_is_positive() {
    let (mut hand, log) = hand();
    hand.apply(PointerAction::Scroll { dx: 0, dy: 8 });
    hand.apply(PointerAction::Scroll { dx: -2, dy: 0 });
    hand.apply(PointerAction::Scroll { dx: 1, dy: -1 });
    hand.apply(PointerAction::Scroll { dx: 0, dy: 0 });
    assert_eq!(WHEEL_UNIT * 8, 120, "eight units are one notch");
    assert_eq!(
        log.all(),
        [
            Did::Wheel(false, -120),
            Did::Wheel(true, -2 * WHEEL_UNIT),
            Did::Wheel(false, WHEEL_UNIT),
            Did::Wheel(true, WHEEL_UNIT),
        ]
    );
}

#[test]
fn a_press_is_pressed_once_and_a_release_without_a_press_is_ignored() {
    let (mut hand, log) = hand();
    hand.apply(LEFT_UP); // the real mouse may hold it: not ours to release
    hand.apply(RIGHT_UP);
    assert_eq!(log.all(), []);
    hand.apply(LEFT_DOWN);
    hand.apply(LEFT_DOWN);
    hand.apply(LEFT_UP);
    hand.apply(LEFT_UP); // the hub releases once more when the session ends
    assert_eq!(
        log.all(),
        [
            Did::Button(Button::Left, true),
            Did::Button(Button::Left, false)
        ]
    );
}

#[test]
fn letting_go_releases_exactly_what_is_held() {
    let (mut hand, log) = hand();
    hand.apply(PointerAction::Button {
        button: Button::Right,
        down: true,
    });
    hand.release_all();
    hand.release_all();
    assert_eq!(
        log.all(),
        [
            Did::Button(Button::Right, true),
            Did::Button(Button::Right, false)
        ]
    );
}

#[test]
fn the_thread_applies_in_order() {
    let log = Log::default();
    let pointer = Pointer::with(Box::new(Fake {
        log: log.clone(),
        gate: None,
    }));
    assert!(pointer.supported());
    assert!(pointer.send(LEFT_DOWN));
    assert!(pointer.send(PointerAction::Scroll { dx: 0, dy: 1 }));
    assert!(pointer.send(LEFT_UP));
    let all = log.until(|l| l.len() == 3);
    assert_eq!(
        all,
        [
            Did::Button(Button::Left, true),
            Did::Wheel(false, -WHEEL_UNIT),
            Did::Button(Button::Left, false),
        ]
    );
}

#[test]
fn moves_that_wait_become_one_and_a_click_keeps_its_place() {
    let (pointer, log, open) = gated();
    // the thread takes the first move and waits at the gate; the rest waits in the queue
    assert!(pointer.send(PointerAction::Move { dx: 1, dy: 1 }));
    for _ in 0..3 {
        assert!(pointer.send(PointerAction::Move { dx: 100, dy: -100 }));
    }
    assert!(pointer.send(LEFT_DOWN));
    assert!(pointer.send(PointerAction::Move { dx: 5, dy: 5 }));
    std::thread::sleep(Duration::from_millis(50));
    for _ in 0..8 {
        let _ = open.send(());
    }
    let all = log.until(|l| l.len() == 3);
    let moved: (i32, i32) =
        all.iter()
            .take_while(|d| matches!(d, Did::Moved(..)))
            .fold((0, 0), |(x, y), d| match d {
                Did::Moved(dx, dy) => (x + dx, y + dy),
                _ => (x, y),
            });
    assert_eq!(moved, (301, -299), "nothing of the way is lost: {all:?}");
    assert_eq!(
        &all[all.len() - 2..],
        [Did::Button(Button::Left, true), Did::Moved(5, 5)],
        "the move after the press stays after it"
    );
}

#[test]
fn a_full_queue_drops_moves_and_presses_but_takes_the_release() {
    let (pointer, log, open) = gated();
    assert!(pointer.send(LEFT_DOWN)); // taken by the thread, waits at the gate
    let end = Instant::now() + Duration::from_secs(5);
    // fill what waits behind it
    let mut sent = 0;
    while sent < QUEUE && Instant::now() < end {
        if pointer.send(PointerAction::Scroll { dx: 0, dy: 1 }) {
            sent += 1;
        }
    }
    assert_eq!(sent, QUEUE);
    assert!(!pointer.send(PointerAction::Move { dx: 1, dy: 1 }));
    assert!(!pointer.send(PointerAction::Scroll { dx: 1, dy: 0 }));
    assert!(!pointer.send(PointerAction::Button {
        button: Button::Right,
        down: true
    }));
    assert!(pointer.send(LEFT_UP), "a release is still taken");
    for _ in 0..(QUEUE + 4) {
        let _ = open.send(());
    }
    let all = log.until(|l| l.last() == Some(&Did::Button(Button::Left, false)));
    assert_eq!(all.first(), Some(&Did::Button(Button::Left, true)));
    assert_eq!(all.last(), Some(&Did::Button(Button::Left, false)));
    assert!(!all.contains(&Did::Button(Button::Right, true)));
}

#[test]
fn releases_have_a_bound_too() {
    let (pointer, _log, _open) = gated();
    assert!(pointer.send(LEFT_DOWN));
    std::thread::sleep(Duration::from_millis(50)); // the thread holds it at the gate
    let taken = (0..RELEASE_ROOM * 2)
        .filter(|_| pointer.send(RIGHT_UP))
        .count();
    assert_eq!(taken, RELEASE_ROOM);
}

#[test]
fn dropping_the_last_handle_releases_what_is_held() {
    let log = Log::default();
    let pointer = Pointer::with(Box::new(Fake {
        log: log.clone(),
        gate: None,
    }));
    let second = pointer.clone();
    assert!(pointer.send(LEFT_DOWN));
    log.until(|l| l.len() == 1);
    drop(pointer);
    std::thread::sleep(Duration::from_millis(30));
    assert_eq!(log.all().len(), 1, "a handle is left: nothing is released");
    drop(second);
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
