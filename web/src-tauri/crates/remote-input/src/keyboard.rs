//! The keyboard: text as the person typed it, and the keys of a fixed list. **This file and
//! `pointer.rs` are the simulated input of this crate, and all of it** – here the keyboard part
//! of `SendInput`, nothing else (no window message, no hook, no clipboard).
//!
//! * There is no "any key". A [`Key`] is one of sixteen; the one combination among them
//!   (Alt+Tab) is one id, pressed and released inside one call. No modifier is ever left down:
//!   every call carries the release of everything it presses, and if the system took only part
//!   of a call, the releases are sent once more on their own.
//! * Text goes in as Unicode units (`KEYEVENTF_UNICODE`), each one down and up: what arrives is
//!   the characters, whatever keyboard layout the PC has. The hub has already refused control
//!   characters and anything over its length; this file caps the length again for itself.
//! * It has a thread of its own, so text and keys keep their order among themselves ("the line,
//!   then Enter") and never wait for the media worker. When [`QUEUE`] actions wait, one more is
//!   dropped – typed text that arrives late and in pieces is worse than text that does not.
//! * What the system does not take (the secure desktop, a desktop switch) is simply not typed.
//!   An elevated window in front swallows the input and reports success: that cannot be told
//!   here.
//! * Nothing is logged, counted or stored; no character outlives the call that types it.

use std::sync::mpsc::{self, SyncSender};

/// Actions waiting for the thread; one more is dropped.
pub const QUEUE: usize = 32;
/// Longest text of one action, in UTF-16 units; the rest is cut (the hub allows far less).
pub const TEXT_UNITS: usize = 512;

/// The fixed list of keys. Never a raw key code; a combination is one id.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Key {
    Enter,
    Escape,
    Backspace,
    Tab,
    Space,
    Left,
    Up,
    Right,
    Down,
    Home,
    End,
    PageUp,
    PageDown,
    Delete,
    F11,
    /// Switch window: Alt held while Tab is pressed once, then both released.
    AltTab,
}

/// Every key of the list (tests walk it).
pub const KEYS: [Key; 16] = [
    Key::Enter,
    Key::Escape,
    Key::Backspace,
    Key::Tab,
    Key::Space,
    Key::Left,
    Key::Up,
    Key::Right,
    Key::Down,
    Key::Home,
    Key::End,
    Key::PageUp,
    Key::PageDown,
    Key::Delete,
    Key::F11,
    Key::AltTab,
];

/// One thing the keyboard does.
#[derive(Clone, PartialEq, Eq)]
pub enum KeyAction {
    Key(Key),
    /// Text without control characters (the hub checked it; they are dropped here once more).
    Text(Box<str>),
}

/// The system's keyboard as the thread sees it. Called on that thread only.
pub trait Keys: Send {
    /// Presses and releases the key (or the combination) in one call.
    fn key(&mut self, key: Key);
    /// Types the units, each one down and up.
    fn text(&mut self, units: &[u16]);
}

/// The text of an action as the units to type: no control characters, capped at
/// [`TEXT_UNITS`] without cutting a character in two.
fn units_of(text: &str) -> Vec<u16> {
    let mut units = Vec::new();
    let mut buf = [0u16; 2];
    for c in text.chars().filter(|c| !c.is_control()) {
        let pair = c.encode_utf16(&mut buf);
        if units.len() + pair.len() > TEXT_UNITS {
            break;
        }
        units.extend_from_slice(pair);
    }
    units
}

fn apply(keys: &mut dyn Keys, action: KeyAction) {
    match action {
        KeyAction::Key(key) => keys.key(key),
        KeyAction::Text(text) => {
            let units = units_of(&text);
            if !units.is_empty() {
                keys.text(&units);
            }
        }
    }
}

/// The handle the shell keeps; the thread ends when it is dropped.
pub struct Keyboard {
    tx: Option<SyncSender<KeyAction>>,
}

impl Keyboard {
    /// The keyboard of this PC. Where input cannot be simulated, no thread is started.
    pub fn start() -> Keyboard {
        match imp::native() {
            Some(keys) => Keyboard::with(keys),
            None => Keyboard { tx: None },
        }
    }

    /// A keyboard over given keys (tests).
    pub fn with(mut keys: Box<dyn Keys>) -> Keyboard {
        let (tx, rx) = mpsc::sync_channel::<KeyAction>(QUEUE);
        let spawned = std::thread::Builder::new()
            .name("remote-keys".into())
            .spawn(move || {
                while let Ok(action) = rx.recv() {
                    apply(keys.as_mut(), action);
                }
            });
        Keyboard {
            tx: spawned.is_ok().then_some(tx),
        }
    }

    /// Whether this PC's keyboard can be used at all.
    pub fn supported(&self) -> bool {
        self.tx.is_some()
    }

    /// Hands the action to the thread and returns at once. `false` = not supported, or too much
    /// is waiting: the action was dropped.
    pub fn send(&self, action: KeyAction) -> bool {
        self.tx
            .as_ref()
            .is_some_and(|tx| tx.try_send(action).is_ok())
    }
}

#[cfg(not(windows))]
mod imp {
    use super::Keys;

    pub fn native() -> Option<Box<dyn Keys>> {
        None
    }
}

#[cfg(windows)]
mod imp {
    use super::{Key, Keys};
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS,
        KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE, VIRTUAL_KEY, VK_BACK, VK_DELETE,
        VK_DOWN, VK_END, VK_ESCAPE, VK_F11, VK_HOME, VK_LEFT, VK_MENU, VK_NEXT, VK_PRIOR,
        VK_RETURN, VK_RIGHT, VK_SPACE, VK_TAB, VK_UP,
    };

    pub fn native() -> Option<Box<dyn Keys>> {
        Some(Box::new(Windows))
    }

    struct Windows;

    /// The keys of one [`Key`], in the order they go down: (virtual key, extended).
    fn chord(key: Key) -> &'static [(VIRTUAL_KEY, bool)] {
        match key {
            Key::Enter => &[(VK_RETURN, false)],
            Key::Escape => &[(VK_ESCAPE, false)],
            Key::Backspace => &[(VK_BACK, false)],
            Key::Tab => &[(VK_TAB, false)],
            Key::Space => &[(VK_SPACE, false)],
            Key::Left => &[(VK_LEFT, true)],
            Key::Up => &[(VK_UP, true)],
            Key::Right => &[(VK_RIGHT, true)],
            Key::Down => &[(VK_DOWN, true)],
            Key::Home => &[(VK_HOME, true)],
            Key::End => &[(VK_END, true)],
            Key::PageUp => &[(VK_PRIOR, true)],
            Key::PageDown => &[(VK_NEXT, true)],
            Key::Delete => &[(VK_DELETE, true)],
            Key::F11 => &[(VK_F11, false)],
            Key::AltTab => &[(VK_MENU, false), (VK_TAB, false)],
        }
    }

    fn event(vk: VIRTUAL_KEY, scan: u16, flags: KEYBD_EVENT_FLAGS) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: scan,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }

    fn of_key((vk, extended): (VIRTUAL_KEY, bool), up: bool) -> INPUT {
        let mut flags = KEYBD_EVENT_FLAGS(0);
        if extended {
            flags |= KEYEVENTF_EXTENDEDKEY;
        }
        if up {
            flags |= KEYEVENTF_KEYUP;
        }
        event(vk, 0, flags)
    }

    /// Hands the events to the system in one call; how many it took.
    fn send(inputs: &[INPUT]) -> usize {
        if inputs.is_empty() {
            return 0;
        }
        // SAFETY: `SendInput` reads fully initialised `INPUT`s from the slice and is told their
        // exact size; it keeps no pointer after returning.
        let taken = unsafe { SendInput(inputs, std::mem::size_of::<INPUT>() as i32) };
        taken as usize
    }

    impl Keys for Windows {
        fn key(&mut self, key: Key) {
            let chord = chord(key);
            // down in order, up in reverse: the modifier goes down first and comes up last
            let downs = chord.iter().map(|k| of_key(*k, false));
            let ups = chord.iter().rev().map(|k| of_key(*k, true));
            let all: Vec<INPUT> = downs.chain(ups.clone()).collect();
            if send(&all) < all.len() {
                // the system took only a part: whatever went down comes up (a spare release
                // does nothing)
                let ups: Vec<INPUT> = ups.collect();
                send(&ups);
            }
        }

        fn text(&mut self, units: &[u16]) {
            let all: Vec<INPUT> = units
                .iter()
                .flat_map(|u| {
                    [
                        event(VIRTUAL_KEY(0), *u, KEYEVENTF_UNICODE),
                        event(VIRTUAL_KEY(0), *u, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP),
                    ]
                })
                .collect();
            send(&all);
        }
    }
}
