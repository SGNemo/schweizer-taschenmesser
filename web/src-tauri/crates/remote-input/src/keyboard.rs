//! The keyboard: text as the person typed it, and the keys of a fixed list. **This file and
//! `pointer.rs` are the simulated input of this crate, and all of it** – here the keyboard part
//! of `SendInput`, nothing else (no window message, no hook, no clipboard).
//!
//! * There is no "any key". A [`Key`] is one of sixteen; the one combination among them
//!   (Alt+Tab) is one id, pressed and released inside one call: every call carries the release
//!   of everything it presses, and if the system took only part of a call, the releases are
//!   sent once more on their own (the system takes a call whole or not at all in practice).
//!   No key is held between two calls.
//! * Text goes in as Unicode units (`KEYEVENTF_UNICODE`), each one down and up: what arrives is
//!   the characters, whatever keyboard layout the PC has. The hub has already refused control
//!   characters and anything over its length; this file drops them again for itself, the two
//!   Unicode line breaks with them (a line break is the key Enter, never part of a text), and
//!   caps the length.
//! * It has a thread of its own, so text and keys keep their order among themselves ("the line,
//!   then Enter") and never wait for the media worker. When [`QUEUE`] actions wait, one more is
//!   dropped – typed text that arrives late and in pieces is worse than text that does not.
//! * What is pressed and released, and in which order, is planned in plain code that every
//!   system compiles and tests ([`strokes`], [`typed`]): each key that goes down comes up in
//!   the same plan, the last one down first. The Windows part at the end only turns one planned
//!   event into one event of the system – it adds none, drops none and changes none.
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

/// One key of the keyboard itself: the fifteen plain keys of the list, and Alt (which exists
/// only as the one half of [`Key::AltTab`]).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Code {
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
    Alt,
}

/// One event the system is handed: a key of the keyboard, or one unit of text – down or up.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stroke {
    Key { code: Code, up: bool },
    Unit { unit: u16, up: bool },
}

/// The keys of one [`Key`], in the order they go down.
fn chord(key: Key) -> &'static [Code] {
    match key {
        Key::Enter => &[Code::Enter],
        Key::Escape => &[Code::Escape],
        Key::Backspace => &[Code::Backspace],
        Key::Tab => &[Code::Tab],
        Key::Space => &[Code::Space],
        Key::Left => &[Code::Left],
        Key::Up => &[Code::Up],
        Key::Right => &[Code::Right],
        Key::Down => &[Code::Down],
        Key::Home => &[Code::Home],
        Key::End => &[Code::End],
        Key::PageUp => &[Code::PageUp],
        Key::PageDown => &[Code::PageDown],
        Key::Delete => &[Code::Delete],
        Key::F11 => &[Code::F11],
        Key::AltTab => &[Code::Alt, Code::Tab],
    }
}

/// What pressing `key` is, whole: every key of it down in order, then up in reverse – the
/// modifier goes down first and comes up last, and nothing stays down.
pub fn strokes(key: Key) -> Vec<Stroke> {
    let chord = chord(key);
    let downs = chord.iter().map(|code| Stroke::Key {
        code: *code,
        up: false,
    });
    let ups = chord.iter().rev().map(|code| Stroke::Key {
        code: *code,
        up: true,
    });
    downs.chain(ups).collect()
}

/// The releases of a plan, once more on their own.
fn releases(plan: &[Stroke]) -> Vec<Stroke> {
    plan.iter()
        .copied()
        .filter(|stroke| matches!(stroke, Stroke::Key { up: true, .. }))
        .collect()
}

/// What typing `text` is: every unit down and up, one after the other. No control characters
/// and neither Unicode line break; capped at [`TEXT_UNITS`] without cutting a character in two.
pub fn typed(text: &str) -> Vec<Stroke> {
    let wanted = |c: &char| !c.is_control() && !matches!(c, '\u{2028}' | '\u{2029}');
    let mut plan = Vec::new();
    let mut buf = [0u16; 2];
    for c in text.chars().filter(wanted) {
        let pair = c.encode_utf16(&mut buf);
        if plan.len() / 2 + pair.len() > TEXT_UNITS {
            break;
        }
        for unit in pair.iter().copied() {
            plan.push(Stroke::Unit { unit, up: false });
            plan.push(Stroke::Unit { unit, up: true });
        }
    }
    plan
}

/// One thing the keyboard does.
#[derive(Clone, PartialEq, Eq)]
pub enum KeyAction {
    Key(Key),
    /// Text without control characters (the hub checked it; they are dropped here once more).
    Text(Box<str>),
}

/// The system's keyboard as the thread sees it. Called on that thread only.
pub trait Keys: Send {
    /// Hands the strokes to the system in one call, in their order; how many it took.
    fn send(&mut self, strokes: &[Stroke]) -> usize;
}

fn apply(keys: &mut dyn Keys, action: KeyAction) {
    match action {
        KeyAction::Key(key) => {
            let plan = strokes(key);
            if keys.send(&plan) < plan.len() {
                // the system took only a part: whatever went down comes up (a spare release
                // does nothing; a lone Alt tap may give the menu bar of the window the focus)
                keys.send(&releases(&plan));
            }
        }
        KeyAction::Text(text) => {
            let plan = typed(&text);
            if !plan.is_empty() {
                keys.send(&plan);
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

/// Windows: one planned stroke becomes one event of the system, nothing more. What is pressed
/// is decided above; this part must not add, drop or change a stroke (`tests/rules.rs` reads it).
#[cfg(windows)]
mod imp {
    use super::{Code, Keys, Stroke};
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

    /// The system's key for one [`Code`], and whether it is one of the extended keys (the
    /// arrows and the block above them, as opposed to the number pad).
    fn key_of(code: Code) -> (VIRTUAL_KEY, bool) {
        match code {
            Code::Enter => (VK_RETURN, false),
            Code::Escape => (VK_ESCAPE, false),
            Code::Backspace => (VK_BACK, false),
            Code::Tab => (VK_TAB, false),
            Code::Space => (VK_SPACE, false),
            Code::Left => (VK_LEFT, true),
            Code::Up => (VK_UP, true),
            Code::Right => (VK_RIGHT, true),
            Code::Down => (VK_DOWN, true),
            Code::Home => (VK_HOME, true),
            Code::End => (VK_END, true),
            Code::PageUp => (VK_PRIOR, true),
            Code::PageDown => (VK_NEXT, true),
            Code::Delete => (VK_DELETE, true),
            Code::F11 => (VK_F11, false),
            Code::Alt => (VK_MENU, false),
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

    /// One stroke as the system's event: a key by its virtual key, a unit of text as Unicode.
    fn input(stroke: Stroke) -> INPUT {
        let mut flags = KEYBD_EVENT_FLAGS(0);
        let up = match stroke {
            Stroke::Key { up, .. } | Stroke::Unit { up, .. } => up,
        };
        if up {
            flags |= KEYEVENTF_KEYUP;
        }
        match stroke {
            Stroke::Key { code, .. } => {
                let (vk, extended) = key_of(code);
                if extended {
                    flags |= KEYEVENTF_EXTENDEDKEY;
                }
                event(vk, 0, flags)
            }
            Stroke::Unit { unit, .. } => event(VIRTUAL_KEY(0), unit, flags | KEYEVENTF_UNICODE),
        }
    }

    impl Keys for Windows {
        fn send(&mut self, strokes: &[Stroke]) -> usize {
            if strokes.is_empty() {
                return 0;
            }
            let inputs: Vec<INPUT> = strokes.iter().map(|stroke| input(*stroke)).collect();
            // SAFETY: `SendInput` reads fully initialised `INPUT`s from the slice and is told
            // their exact size; it keeps no pointer after returning.
            let taken = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
            taken as usize
        }
    }
}
