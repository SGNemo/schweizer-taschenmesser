//! The pointer: moves, the two mouse buttons, the wheel. **This is the simulated input of this
//! crate, and all of it** – the mouse part of `SendInput`, nothing else (no keyboard, no absolute
//! position, no window message).
//!
//! It has a thread of its own. The media worker waits for the audio device and the media session,
//! sometimes for many milliseconds; a pointer that shared its queue would stutter whenever the
//! state is read. Here a call takes microseconds, so the queue is all but always empty.
//!
//! * Moves and wheel steps are dropped when [`QUEUE`] actions wait (a late move is worth nothing).
//! * A button press is dropped then too. A **release is still taken** (up to [`RELEASE_ROOM`]):
//!   a press that went through must not lose its release.
//! * Only a button this crate pressed is ever released. A release without a press is ignored, so
//!   the hub may release once more at the end of a session, and a button the person holds on the
//!   real mouse is left alone. A press of a button already pressed is ignored as well.
//! * When the last handle is dropped the thread releases what it still holds, then ends.
//! * Nothing is logged, counted or stored; no coordinate outlives the call that applies it.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::Arc;

/// Moves, wheel steps and presses waiting for the thread; one more is dropped.
pub const QUEUE: usize = 64;
/// Releases are taken beyond [`QUEUE`], up to this many waiting actions in all.
pub const RELEASE_ROOM: usize = 256;
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
    fn button(&mut self, button: Button, down: bool);
    /// `amount` in the system's wheel delta; positive = away from the person (up) or to the right.
    fn wheel(&mut self, horizontal: bool, amount: i32);
}

/// What the thread does with the actions: pure, so it is tested without a thread.
pub struct Hand<M: Mouse + ?Sized> {
    left: bool,
    right: bool,
    mouse: Box<M>,
}

impl<M: Mouse + ?Sized> Hand<M> {
    pub fn new(mouse: Box<M>) -> Self {
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

    pub fn moved(&mut self, dx: i32, dy: i32) {
        if dx != 0 || dy != 0 {
            self.mouse.moved(dx, dy);
        }
    }

    pub fn apply(&mut self, action: PointerAction) {
        match action {
            PointerAction::Move { dx, dy } => self.moved(i32::from(dx), i32::from(dy)),
            PointerAction::Button { button, down } => {
                let held = self.held(button);
                if *held != down {
                    *held = down;
                    self.mouse.button(button, down);
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
    pub fn release_all(&mut self) {
        for button in [Button::Left, Button::Right] {
            self.apply(PointerAction::Button {
                button,
                down: false,
            });
        }
    }
}

/// The handle the shell keeps. Cheap to clone; the thread ends when the last handle is dropped.
#[derive(Clone)]
pub struct Pointer {
    tx: Option<Sender<PointerAction>>,
    waiting: Arc<AtomicUsize>,
}

impl Pointer {
    /// The pointer of this PC. Where input cannot be simulated, no thread is started.
    pub fn start() -> Pointer {
        match imp::native() {
            Some(mouse) => Pointer::with(mouse),
            None => Pointer {
                tx: None,
                waiting: Arc::new(AtomicUsize::new(0)),
            },
        }
    }

    /// A pointer over a given mouse (tests).
    pub fn with(mouse: Box<dyn Mouse>) -> Pointer {
        let (tx, rx) = mpsc::channel::<PointerAction>();
        let waiting = Arc::new(AtomicUsize::new(0));
        let count = waiting.clone();
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
                                count.fetch_sub(1, Ordering::SeqCst);
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
                        count.fetch_sub(1, Ordering::SeqCst);
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
                hand.release_all();
            });
        Pointer {
            tx: spawned.is_ok().then_some(tx),
            waiting,
        }
    }

    /// Whether this PC's pointer can be moved at all.
    pub fn supported(&self) -> bool {
        self.tx.is_some()
    }

    /// Hands the action to the thread and returns at once. `false` = not supported, or too much
    /// is waiting and the action was dropped.
    pub fn send(&self, action: PointerAction) -> bool {
        let Some(tx) = &self.tx else {
            return false;
        };
        let room = match action {
            PointerAction::Button { down: false, .. } => RELEASE_ROOM,
            _ => QUEUE,
        };
        if self.waiting.fetch_add(1, Ordering::SeqCst) >= room || tx.send(action).is_err() {
            self.waiting.fetch_sub(1, Ordering::SeqCst);
            return false;
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
    fn send(flags: MOUSE_EVENT_FLAGS, dx: i32, dy: i32, data: i32) {
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
        unsafe {
            SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
        }
    }

    impl Mouse for Windows {
        fn moved(&mut self, dx: i32, dy: i32) {
            send(MOUSEEVENTF_MOVE, dx, dy, 0);
        }

        fn button(&mut self, button: Button, down: bool) {
            let flags = match (button, down) {
                (Button::Left, true) => MOUSEEVENTF_LEFTDOWN,
                (Button::Left, false) => MOUSEEVENTF_LEFTUP,
                (Button::Right, true) => MOUSEEVENTF_RIGHTDOWN,
                (Button::Right, false) => MOUSEEVENTF_RIGHTUP,
            };
            send(flags, 0, 0, 0);
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
