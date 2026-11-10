//! The pointer: moves, the two mouse buttons, the wheel. **This is the simulated input of this
//! crate, and all of it** – the mouse part of `SendInput`, nothing else (no keyboard, no absolute
//! position, no window message).
//!
//! It has a thread of its own. The media worker waits for the audio device and the media session,
//! sometimes for many milliseconds; a pointer that shared its queue would stutter whenever the
//! state is read. Here a call takes microseconds, so the queue is all but always empty.
//!
//! * Moves, wheel steps and presses are dropped when [`QUEUE`] actions wait (a late move is worth
//!   nothing).
//! * A **release is never dropped** and never waits for room – but it is only taken for a button
//!   whose press was taken before it. So there is at most one release per press, a flood of spare
//!   releases takes no room at all, and a press that went through cannot lose its release.
//! * The hub decides which button a session holds; this file only makes sure of two things: a
//!   release without a press of ours does nothing (the hub may release once more at the end of a
//!   session, and a button the person holds on the real mouse is left alone), and a press of a
//!   button already pressed does nothing.
//! * What this file believes is held can differ from the system for a moment: a click on the real
//!   mouse lifts a button we pressed, and the next remote press of it is then ignored once. One
//!   device controls at a time (the hub's slot), so two sessions never share the buttons.
//! * A press the system refused is not held, so nothing is released for it later.
//! * When the thread ends – the last handle was dropped, or it unwinds – it releases what it
//!   still holds. A process that is killed cannot: the button then stays down for the system
//!   until the person clicks it once.
//! * Nothing is logged, counted or stored; no coordinate outlives the call that applies it.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::Arc;

/// Moves, wheel steps and presses waiting for the thread; one more is dropped.
pub const QUEUE: usize = 64;
/// One wheel unit of a [`PointerAction::Scroll`], in the system's wheel delta (120 = one notch).
pub const WHEEL_UNIT: i32 = 15;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Button {
    Left,
    Right,
}

/// One thing the pointer does. A fixed list.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum PointerAction {
    /// Relative, in the system's own units (its pointer speed and acceleration apply). `dy > 0`
    /// is down.
    Move {
        dx: i8,
        dy: i8,
    },
    Button {
        button: Button,
        down: bool,
    },
    /// In units of [`WHEEL_UNIT`]. `dy > 0` moves the view down, `dx > 0` to the right.
    Scroll {
        dx: i8,
        dy: i8,
    },
}

/// The system's mouse as the pointer thread sees it. Called on that thread only.
pub trait Mouse: Send {
    fn moved(&mut self, dx: i32, dy: i32);
    /// `false` = the system did not take it.
    fn button(&mut self, button: Button, down: bool) -> bool;
    /// `amount` in the system's wheel delta; positive = away from the person (up) or to the right.
    fn wheel(&mut self, horizontal: bool, amount: i32);
}

/// What the thread does with the actions.
struct Hand {
    left: bool,
    right: bool,
    mouse: Box<dyn Mouse>,
}

impl Hand {
    fn new(mouse: Box<dyn Mouse>) -> Self {
        Hand {
            left: false,
            right: false,
            mouse,
        }
    }

    fn held(&mut self, button: Button) -> &mut bool {
        match button {
            Button::Left => &mut self.left,
            Button::Right => &mut self.right,
        }
    }

    fn moved(&mut self, dx: i32, dy: i32) {
        if dx != 0 || dy != 0 {
            self.mouse.moved(dx, dy);
        }
    }

    fn apply(&mut self, action: PointerAction) {
        match action {
            PointerAction::Move { dx, dy } => self.moved(i32::from(dx), i32::from(dy)),
            PointerAction::Button { button, down } => {
                if *self.held(button) == down {
                    return;
                }
                // a refused press is not held; a release counts as done either way
                if self.mouse.button(button, down) || !down {
                    *self.held(button) = down;
                }
            }
            PointerAction::Scroll { dx, dy } => {
                if dy != 0 {
                    self.mouse.wheel(false, -i32::from(dy) * WHEEL_UNIT);
                }
                if dx != 0 {
                    self.mouse.wheel(true, i32::from(dx) * WHEEL_UNIT);
                }
            }
        }
    }

    /// Lets go of every button this hand still holds.
    fn release_all(&mut self) {
        for button in [Button::Left, Button::Right] {
            self.apply(PointerAction::Button {
                button,
                down: false,
            });
        }
    }
}

impl Drop for Hand {
    /// Also when the thread unwinds: nothing this hand pressed stays down.
    fn drop(&mut self) {
        self.release_all();
    }
}

/// The handle the shell keeps. Cheap to clone; the thread ends when the last handle is dropped.
#[derive(Clone)]
pub struct Pointer {
    tx: Option<Sender<PointerAction>>,
    shared: Arc<Shared>,
}

#[derive(Default)]
struct Shared {
    /// Actions handed over and not yet taken by the thread.
    waiting: AtomicUsize,
    /// A press of this button was taken and its release was not yet: left, right.
    pressed: [AtomicBool; 2],
}

impl Shared {
    fn pressed(&self, button: Button) -> &AtomicBool {
        &self.pressed[match button {
            Button::Left => 0,
            Button::Right => 1,
        }]
    }
}

impl Pointer {
    /// The pointer of this PC. Where input cannot be simulated, no thread is started.
    pub fn start() -> Pointer {
        match imp::native() {
            Some(mouse) => Pointer::with(mouse),
            None => Pointer {
                tx: None,
                shared: Arc::default(),
            },
        }
    }

    /// A pointer over a given mouse (tests).
    pub fn with(mouse: Box<dyn Mouse>) -> Pointer {
        let (tx, rx) = mpsc::channel::<PointerAction>();
        let shared = Arc::<Shared>::default();
        let count = shared.clone();
        let spawned = std::thread::Builder::new()
            .name("remote-pointer".into())
            .spawn(move || {
                let mut hand = Hand::new(mouse);
                let mut carried: Option<PointerAction> = None;
                loop {
                    let action = match carried.take() {
                        Some(action) => action,
                        None => match rx.recv() {
                            Ok(action) => {
                                count.waiting.fetch_sub(1, Ordering::SeqCst);
                                action
                            }
                            Err(_) => break,
                        },
                    };
                    let PointerAction::Move { dx, dy } = action else {
                        hand.apply(action);
                        continue;
                    };
                    // moves that already wait become one move; anything else keeps its place
                    let (mut x, mut y) = (i32::from(dx), i32::from(dy));
                    while let Ok(next) = rx.try_recv() {
                        count.waiting.fetch_sub(1, Ordering::SeqCst);
                        match next {
                            PointerAction::Move { dx, dy } => {
                                x += i32::from(dx);
                                y += i32::from(dy);
                            }
                            other => {
                                carried = Some(other);
                                break;
                            }
                        }
                    }
                    hand.moved(x, y);
                }
                // `hand` is dropped here and lets go of what it holds
            });
        Pointer {
            tx: spawned.is_ok().then_some(tx),
            shared,
        }
    }

    /// Whether this PC's pointer can be moved at all.
    pub fn supported(&self) -> bool {
        self.tx.is_some()
    }

    /// Hands the action to the thread and returns at once. `false` = not supported, too much is
    /// waiting, or a release without a press before it: the action was dropped.
    pub fn send(&self, action: PointerAction) -> bool {
        let Some(tx) = &self.tx else {
            return false;
        };
        if let PointerAction::Button {
            button,
            down: false,
        } = action
        {
            // one release per press that was taken, and that one always goes through
            if !self.shared.pressed(button).swap(false, Ordering::SeqCst) {
                return false;
            }
            self.shared.waiting.fetch_add(1, Ordering::SeqCst);
        } else if self.shared.waiting.fetch_add(1, Ordering::SeqCst) >= QUEUE {
            self.shared.waiting.fetch_sub(1, Ordering::SeqCst);
            return false;
        }
        if tx.send(action).is_err() {
            self.shared.waiting.fetch_sub(1, Ordering::SeqCst);
            return false;
        }
        if let PointerAction::Button { button, down: true } = action {
            self.shared.pressed(button).store(true, Ordering::SeqCst);
        }
        true
    }
}

#[cfg(not(windows))]
mod imp {
    use super::Mouse;

    pub fn native() -> Option<Box<dyn Mouse>> {
        None
    }
}

#[cfg(windows)]
mod imp {
    use super::{Button, Mouse};
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_HWHEEL, MOUSEEVENTF_LEFTDOWN,
        MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MOVE, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP,
        MOUSEEVENTF_WHEEL, MOUSEINPUT, MOUSE_EVENT_FLAGS,
    };

    pub fn native() -> Option<Box<dyn Mouse>> {
        Some(Box::new(Windows))
    }

    struct Windows;

    /// One mouse event to the system. A refusal (an elevated window in front, the secure
    /// desktop) is not an error to anyone: the event is simply not applied.
    fn send(flags: MOUSE_EVENT_FLAGS, dx: i32, dy: i32, data: i32) -> bool {
        let input = INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx,
                    dy,
                    // the wheel delta is a signed value in this unsigned field
                    mouseData: data as u32,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        // SAFETY: `SendInput` reads one fully initialised `INPUT` from the slice and is told its
        // exact size; it keeps no pointer after returning.
        let taken = unsafe { SendInput(&[input], std::mem::size_of::<INPUT>() as i32) };
        taken == 1
    }

    impl Mouse for Windows {
        fn moved(&mut self, dx: i32, dy: i32) {
            send(MOUSEEVENTF_MOVE, dx, dy, 0);
        }

        fn button(&mut self, button: Button, down: bool) -> bool {
            let flags = match (button, down) {
                (Button::Left, true) => MOUSEEVENTF_LEFTDOWN,
                (Button::Left, false) => MOUSEEVENTF_LEFTUP,
                (Button::Right, true) => MOUSEEVENTF_RIGHTDOWN,
                (Button::Right, false) => MOUSEEVENTF_RIGHTUP,
            };
            send(flags, 0, 0, 0)
        }

        fn wheel(&mut self, horizontal: bool, amount: i32) {
            let flags = if horizontal {
                MOUSEEVENTF_HWHEEL
            } else {
                MOUSEEVENTF_WHEEL
            };
            send(flags, 0, 0, amount);
        }
    }
}
