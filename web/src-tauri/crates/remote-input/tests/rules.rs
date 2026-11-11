//! Source-level rules of this crate (`docs/rules/remote-control.md`): they scan the files, so a
//! later change that breaks one fails here even if every behaviour test still passes.

use std::fs;
use std::path::PathBuf;

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// A source file as text, whatever line ends the checkout gave it (Windows: CRLF).
fn read(path: impl AsRef<std::path::Path>) -> String {
    fs::read_to_string(path).unwrap().replace("\r\n", "\n")
}

fn sources() -> Vec<(String, String)> {
    fs::read_dir(root().join("src"))
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|x| x == "rs"))
        .map(|p| {
            (
                p.file_name().unwrap().to_string_lossy().into_owned(),
                read(&p),
            )
        })
        .collect()
}

fn code_lines(text: &str) -> impl Iterator<Item = &str> {
    text.lines().filter(|l| !l.trim_start().starts_with("//"))
}

fn assert_absent(needles: &[&str]) {
    for (name, text) in sources() {
        for line in code_lines(&text) {
            for n in needles {
                assert!(!line.contains(n), "{name}: `{n}` in `{}`", line.trim());
            }
        }
    }
}

/// Simulated input is `SendInput` in two files and nothing else: the mouse part in
/// `src/pointer.rs`, the keyboard part in `src/keyboard.rs`. No absolute position, no window
/// message, no hook, no other crate for it.
#[test]
fn only_two_files_simulate_input_each_its_own_kind() {
    assert_absent(&[
        "keybd_event",
        "mouse_event",
        "SetCursorPos",
        "SetPhysicalCursorPos",
        "MOUSEEVENTF_ABSOLUTE",
        "MOUSEEVENTF_VIRTUALDESK",
        "MOUSEEVENTF_MIDDLE",
        "MOUSEEVENTF_X",
        "KEYEVENTF_SCANCODE",
        "INPUT_HARDWARE",
        "enigo",
        "PostMessage",
        "SendMessage",
        "APPCOMMAND",
        "BlockInput",
        "SetWindowsHook",
        "VkKeyScan",
        "MapVirtualKey",
        // no media, volume, Windows or modifier-lock key, by any route
        "VK_MEDIA",
        "VK_VOLUME",
        "VK_LWIN",
        "VK_RWIN",
        "VK_CONTROL",
        "VK_SHIFT",
        "VK_CAPITAL",
        // no flag or input type built from a number, no other member of the input union
        "MOUSE_EVENT_FLAGS(",
        "INPUT_TYPE(",
        " hi:",
        // no input type changed after it was written, no bytes read as another type
        "r#type.",
        "transmute",
        // no window message that carries a key, no scripting host that types
        "SendNotifyMessage",
        "PostThreadMessage",
        "WM_KEY",
        "WM_CHAR",
        "WM_SYSKEY",
        "IDispatch",
        "CLSIDFromProgID",
    ]);
    let mouse = ["MOUSEEVENTF", "INPUT_MOUSE", "MOUSEINPUT", " mi:"];
    let keys = [
        "VK_",
        "KEYEVENTF",
        "KEYBDINPUT",
        "INPUT_KEYBOARD",
        "VIRTUAL_KEY",
        " ki:",
    ];
    for (name, text) in sources() {
        for line in code_lines(&text) {
            if name != "pointer.rs" && name != "keyboard.rs" {
                assert!(!line.contains("SendInput"), "{name}: SendInput");
            }
            if name != "pointer.rs" {
                for n in mouse {
                    assert!(!line.contains(n), "{name}: `{n}` outside pointer.rs");
                }
            }
            if name != "keyboard.rs" {
                for n in keys {
                    assert!(!line.contains(n), "{name}: `{n}` outside keyboard.rs");
                }
            }
        }
    }
    let words = |text: &str, prefix: &str| {
        let mut found: Vec<String> = code_lines(text)
            .flat_map(|l| l.split(|c: char| !c.is_ascii_alphanumeric() && c != '_'))
            .filter(|w| w.starts_with(prefix))
            .map(str::to_owned)
            .collect();
        found.sort_unstable();
        found.dedup();
        found
    };
    let one_call = |text: &str| {
        code_lines(text)
            .filter(|l| l.contains("SendInput(") && !l.contains("fn "))
            .count()
    };
    let types = |text: &str| -> Vec<String> {
        code_lines(text)
            .filter(|l| l.contains("r#type:"))
            .map(|l| l.trim().to_owned())
            .collect()
    };

    // the pointer: exactly one call site, and the flags are the seven of move, two buttons and
    // the wheel
    let pointer = read(root().join("src/pointer.rs"));
    assert_eq!(one_call(&pointer), 1, "one SendInput call");
    assert_eq!(types(&pointer), ["r#type: INPUT_MOUSE,"]);
    assert_eq!(
        words(&pointer, "MOUSEEVENTF_"),
        [
            "MOUSEEVENTF_HWHEEL",
            "MOUSEEVENTF_LEFTDOWN",
            "MOUSEEVENTF_LEFTUP",
            "MOUSEEVENTF_MOVE",
            "MOUSEEVENTF_RIGHTDOWN",
            "MOUSEEVENTF_RIGHTUP",
            "MOUSEEVENTF_WHEEL",
        ]
    );

    // The keyboard. What is pressed is planned in plain code (`strokes`, `typed`), which
    // `tests/keyboard.rs` checks on every system; the Windows part below it may only turn one
    // planned stroke into one event. Linux never compiles that part, so it is read here.
    let keyboard = read(root().join("src/keyboard.rs"));
    // Two parts. The plan (which key goes down and comes up, in which order; what of a text is
    // typed) is plain code that `tests/keyboard.rs` checks on every system. Everything from the
    // handle on – the thread, the way to the system's keyboard, the Windows part – is pinned
    // whole below: Linux never compiles the Windows part, and no behaviour test runs the real
    // keyboard.
    let at = keyboard
        .find("/// The handle the shell keeps;")
        .expect("the handle");
    let (plan, rest) = keyboard.split_at(at);
    // The plan is the same on every system and knows nothing of one: no conditional
    // compilation, nothing of Windows, no second implementation of the keys, no module.
    for line in code_lines(plan) {
        for n in [
            "cfg",
            "windows",
            "VK_",
            "KEYEVENTF",
            "INPUT",
            "VIRTUAL_KEY",
            "unsafe",
            "impl Keys for",
            "mod ",
        ] {
            assert!(
                !line.contains(n),
                "keyboard.rs: `{n}` in the plan: `{}`",
                line.trim()
            );
        }
    }
    // Every attempt to pin single properties of the rest left a way to hold a key down, add an
    // event or change a flag. So it is pinned as it stands (comments and layout aside): a
    // change fails here on purpose, needs a second pair of eyes, and this copy changes with it.
    let lines = |text: &str| -> Vec<String> {
        code_lines(text)
            .map(|l| l.trim().to_owned())
            .filter(|l| !l.is_empty())
            .collect()
    };
    let same = |file: &str, now: Vec<String>, pinned: Vec<String>, name: &str| {
        let differs = now
            .iter()
            .zip(&pinned)
            .position(|(a, b)| a != b)
            .or((now.len() != pinned.len()).then_some(now.len().min(pinned.len())));
        if let Some(i) = differs {
            panic!(
                "{file} changed, at code line {}:\n  now:    {}\n  pinned: {}\n\
                 Read docs/rules/remote-control.md and have the change reviewed; then update \
                 {name} in tests/rules.rs. A new key also needs: `Key`, `KEYS`, `Code`, `chord`, \
                 `key_of` and its import, the count of sixteen below, tests/keyboard.rs, the \
                 hub's list and `key_of` in the shell.",
                i + 1,
                now.get(i).map_or("(end)", String::as_str),
                pinned.get(i).map_or("(end)", String::as_str),
            );
        }
    };
    // the whole keyboard file: the plan too, so that no hidden case in it can hold a key
    assert!(
        rest.contains("mod imp"),
        "the Windows part is in the pinned file"
    );
    same("keyboard.rs", lines(&keyboard), lines(PINNED), "PINNED");
    // and the Windows part of the pointer: the one place a mouse event is built – it must stay
    // a mouse event (an input union read as another member would be any key)
    let at = pointer
        .find("#[cfg(windows)]\nmod imp {")
        .expect("the pointer's Windows part");
    same(
        "pointer.rs (Windows part)",
        lines(&pointer[at..]),
        lines(PINNED_POINTER),
        "PINNED_POINTER",
    );
    assert_eq!(
        pointer.matches("mod imp").count(),
        2,
        "the stub and Windows"
    );
    // one list of keys, the public one: sixteen
    let list = &keyboard[keyboard.find("pub enum Key {").unwrap()..];
    let list = &list[..list.find("\n}").unwrap()];
    let keys: usize = code_lines(list)
        .skip(1)
        .map(|l| l.split(',').filter(|w| !w.trim().is_empty()).count())
        .sum();
    assert_eq!(keys, 16, "the fixed list has sixteen keys");
}

/// The crate is five files and nothing else: no sub-directory, no file pulled in from elsewhere,
/// no macro that could hide code from the tests that read these files.
#[test]
fn the_crate_is_exactly_its_five_files() {
    let mut names: Vec<String> = fs::read_dir(root().join("src"))
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    assert_eq!(
        names,
        [
            "keyboard.rs",
            "lib.rs",
            "pointer.rs",
            "system.rs",
            "worker.rs"
        ]
    );
    assert_absent(&[
        "#[path",
        "include!",
        "include_str!",
        "include_bytes!",
        "macro_rules!",
    ]);
    let lib = read(root().join("src/lib.rs"));
    let mods: Vec<&str> = code_lines(&lib)
        .map(str::trim)
        .filter(|l| l.starts_with("mod ") || l.starts_with("pub mod ") || l.contains(" mod "))
        .collect();
    assert_eq!(
        mods,
        [
            "mod keyboard;",
            "mod pointer;",
            "mod system;",
            "mod worker;"
        ]
    );
}

/// The two files that simulate input keep nothing: no place a coordinate, a key or a text could
/// stay after the call that applies it.
#[test]
fn the_input_files_have_nowhere_to_keep_anything() {
    for (name, text) in sources() {
        if name != "keyboard.rs" && name != "pointer.rs" {
            continue;
        }
        for line in code_lines(&text) {
            let line = line.trim_start();
            for n in [
                "Mutex",
                "RwLock",
                "RefCell",
                "OnceLock",
                "OnceCell",
                "thread_local",
                "lazy_static",
            ] {
                assert!(!line.contains(n), "{name}: `{n}` in `{line}`");
            }
            assert!(
                !line.split_whitespace().any(|w| w == "static"),
                "{name}: a static in `{line}`"
            );
        }
    }
}

/// The crate that acts cannot listen, read files, or be reached by anything but its typed API.
#[test]
fn no_network_no_files_no_tauri_no_serde() {
    assert_absent(&[
        "std::net",
        "TcpStream",
        "TcpListener",
        "UdpSocket",
        "std::fs",
        "File::",
        "tauri",
        "serde",
        "lan_sync",
        "std::process",
        "Command::new",
    ]);
    let manifest = read(root().join("Cargo.toml"));
    let deps: Vec<&str> = manifest
        .lines()
        .skip_while(|l| !l.starts_with("[target.") && !l.starts_with("[dependencies"))
        .filter(|l| l.contains('=') && !l.trim_start().starts_with('"') && !l.starts_with('['))
        .map(|l| l.split('=').next().unwrap().trim())
        .collect();
    assert_eq!(
        deps,
        ["windows"],
        "the only dependency, and only on Windows"
    );
    assert!(manifest.contains("[target.'cfg(windows)'.dependencies]"));
    // The system APIs the crate can reach at all: a new feature opens new calls (window
    // messages, scripting hosts) that could type by a route the word lists above do not know.
    let features: Vec<&str> = manifest
        .lines()
        .map(str::trim)
        .filter(|l| l.starts_with('"') && l.ends_with("\","))
        .map(|l| l.trim_matches(|c| c == '"' || c == ','))
        .collect();
    assert_eq!(
        features,
        [
            "Foundation",
            "Media_Control",
            "Win32_Foundation",
            "Win32_Media_Audio",
            "Win32_Media_Audio_Endpoints",
            "Win32_System_Com",
            "Win32_System_Com_StructuredStorage",
            "Win32_System_Variant",
            "Win32_System_RemoteDesktop",
            "Win32_System_Shutdown",
            "Win32_UI_Input_KeyboardAndMouse",
        ],
        "a new Windows feature needs a review (docs/rules/remote-control.md)"
    );
    assert_eq!(manifest.matches("features").count(), 1);
    // Of the standard library the crate uses threads, channels, time and two helpers for
    // system calls – nothing that reads or writes a file, a stream or the environment.
    for (name, text) in sources() {
        for line in code_lines(&text) {
            for (at, _) in line.match_indices("std::") {
                let path: String = line[at + 5..]
                    .chars()
                    .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
                    .collect();
                assert!(
                    ["mem", "ptr", "sync", "thread", "time"].contains(&path.as_str()),
                    "{name}: `std::{path}` in `{}`",
                    line.trim()
                );
            }
            for n in [
                "extern crate",
                "use std;",
                "OpenOptions",
                "stderr",
                "stdout",
                "write_all",
            ] {
                assert!(!line.contains(n), "{name}: `{n}` in `{}`", line.trim());
            }
        }
    }
    assert!(!manifest.contains("\n[dependencies]"));
}

/// Nothing is logged, printed or formatted.
#[test]
fn nothing_is_logged() {
    assert_absent(&[
        "println!",
        "eprintln!",
        "print!(",
        "dbg!",
        "log::",
        "tracing::",
        "format!",
        "write!(",
    ]);
}

/// Screen, clipboard, files, window titles and track titles are not this crate's business: it
/// tells four facts and nothing else.
#[test]
fn only_the_four_facts_leave() {
    assert_absent(&[
        "Clipboard",
        "GetWindowText",
        "GetForegroundWindow",
        "BitBlt",
        "TryGetMediaPropertiesAsync",
        "Title(",
        "Artist(",
        "Thumbnail",
        "SourceAppUserModelId",
    ]);
    let lib = read(root().join("src/lib.rs"));
    let state = &lib[lib.find("pub struct State").unwrap()..];
    let body = &state[..state.find("\n}").unwrap()];
    let fields: Vec<&str> = body
        .lines()
        .filter_map(|l| l.trim().strip_prefix("pub "))
        .filter(|l| l.contains(':'))
        .map(|l| l.split(':').next().unwrap())
        .collect();
    assert_eq!(fields, ["volume", "mute", "playing", "locked"]);
}

/// `unsafe` is for the Windows calls only, and every block says why it is sound.
#[test]
fn unsafe_is_windows_only_and_explained() {
    let lib = read(root().join("src/lib.rs"));
    assert!(lib.contains("#![cfg_attr(not(windows), forbid(unsafe_code))]"));
    for (name, text) in sources() {
        let lines: Vec<&str> = text.lines().collect();
        for (i, line) in lines.iter().enumerate() {
            if line.trim_start().starts_with("//") || !line.contains("unsafe ") {
                continue;
            }
            assert!(
                name == "system.rs" || name == "pointer.rs" || name == "keyboard.rs",
                "{name}: unsafe outside the Windows calls"
            );
            let explained = lines[i.saturating_sub(4)..i]
                .iter()
                .any(|l| l.contains("// SAFETY:"));
            assert!(explained, "{name}:{}: unsafe without a SAFETY note", i + 1);
        }
    }
}

/// `src/keyboard.rs` as it stands, comments and layout aside (see the test above).
const PINNED: &str = r#"
use std::sync::mpsc::{self, SyncSender};
pub const QUEUE: usize = 32;
pub const TEXT_UNITS: usize = 512;
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
AltTab,
}
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
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stroke {
Key { code: Code, up: bool },
Unit { unit: u16, up: bool },
}
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
fn releases(plan: &[Stroke]) -> Vec<Stroke> {
plan.iter()
.copied()
.filter(|stroke| matches!(stroke, Stroke::Key { up: true, .. }))
.collect()
}
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
#[derive(Clone, PartialEq, Eq)]
pub enum KeyAction {
Key(Key),
Text(Box<str>),
}
pub trait Keys: Send {
fn send(&mut self, strokes: &[Stroke]) -> usize;
}
fn apply(keys: &mut dyn Keys, action: KeyAction) {
match action {
KeyAction::Key(key) => {
let plan = strokes(key);
if keys.send(&plan) < plan.len() {
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
pub struct Keyboard {
tx: Option<SyncSender<KeyAction>>,
}
impl Keyboard {
pub fn start() -> Keyboard {
match imp::native() {
Some(keys) => Keyboard::with(keys),
None => Keyboard { tx: None },
}
}
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
pub fn supported(&self) -> bool {
self.tx.is_some()
}
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
let taken = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
taken as usize
}
}
}
"#;

/// The Windows part of `src/pointer.rs` as it stands, comments and layout aside.
const PINNED_POINTER: &str = r#"
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
fn send(flags: MOUSE_EVENT_FLAGS, dx: i32, dy: i32, data: i32) -> bool {
let input = INPUT {
r#type: INPUT_MOUSE,
Anonymous: INPUT_0 {
mi: MOUSEINPUT {
dx,
dy,
mouseData: data as u32,
dwFlags: flags,
time: 0,
dwExtraInfo: 0,
},
},
};
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
"#;
