//! Source-level rules of this crate (`docs/rules/remote-control.md`): they scan the files, so a
//! later change that breaks one fails here even if every behaviour test still passes.

use std::fs;
use std::path::PathBuf;

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn sources() -> Vec<(String, String)> {
    fs::read_dir(root().join("src"))
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|x| x == "rs"))
        .map(|p| {
            (
                p.file_name().unwrap().to_string_lossy().into_owned(),
                fs::read_to_string(&p).unwrap(),
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
    let pointer = fs::read_to_string(root().join("src/pointer.rs")).unwrap();
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
    let keyboard = fs::read_to_string(root().join("src/keyboard.rs")).unwrap();
    let at = keyboard
        .find("#[cfg(windows)]\nmod imp {")
        .expect("the Windows part");
    let (plain, imp) = keyboard.split_at(at);
    // nothing of the system above it
    for line in code_lines(plain) {
        for n in [
            "windows::",
            "VK_",
            "KEYEVENTF",
            "INPUT",
            "VIRTUAL_KEY",
            "unsafe",
        ] {
            assert!(
                !line.contains(n),
                "keyboard.rs: `{n}` above the Windows part"
            );
        }
    }
    // The Windows part itself is pinned whole, as it stands (comments and layout aside): every
    // attempt to pin single properties left a way to hold a key down, add an event or change a
    // flag. A change to it fails here on purpose – it needs a second pair of eyes, and then
    // this copy is updated with it.
    let normal = |text: &str| -> String {
        code_lines(text)
            .map(str::trim)
            .filter(|l| !l.is_empty())
            .collect::<Vec<_>>()
            .join(" ")
    };
    assert_eq!(
        normal(imp),
        normal(IMP),
        "the Windows part of keyboard.rs changed: read docs/rules/remote-control.md, have it \
         reviewed, then update the copy in tests/rules.rs"
    );
    // one list of keys, the public one: sixteen
    let list = &keyboard[keyboard.find("pub enum Key {").unwrap()..];
    let list = &list[..list.find("\n}").unwrap()];
    assert_eq!(
        list.lines()
            .filter(|l| l.trim().ends_with(',') && !l.trim().starts_with("//"))
            .count(),
        16
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
                !line.starts_with("static ") && !line.starts_with("pub static "),
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
    let manifest = fs::read_to_string(root().join("Cargo.toml")).unwrap();
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
    let lib = fs::read_to_string(root().join("src/lib.rs")).unwrap();
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
    let lib = fs::read_to_string(root().join("src/lib.rs")).unwrap();
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

/// The Windows part of `src/keyboard.rs`, as reviewed (see the test above).
const IMP: &str = r#"
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
