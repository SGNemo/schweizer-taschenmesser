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

/// Simulated input is the mouse part of `SendInput`, in `src/pointer.rs`, and nothing else:
/// no key of any kind, no absolute position, no window message, no other crate for it.
#[test]
fn only_the_pointer_file_simulates_input_and_only_the_mouse() {
    assert_absent(&[
        "keybd_event",
        "mouse_event",
        "SetCursorPos",
        "SetPhysicalCursorPos",
        "MOUSEEVENTF_ABSOLUTE",
        "MOUSEEVENTF_VIRTUALDESK",
        "MOUSEEVENTF_MIDDLE",
        "MOUSEEVENTF_X",
        "VK_",
        "KEYEVENTF",
        "KEYBDINPUT",
        "INPUT_KEYBOARD",
        "INPUT_HARDWARE",
        "enigo",
        "PostMessage",
        "SendMessage",
        "APPCOMMAND",
        "BlockInput",
        "SetWindowsHook",
    ]);
    for (name, text) in sources() {
        if name == "pointer.rs" {
            continue;
        }
        for line in code_lines(&text) {
            for n in ["SendInput", "MOUSEEVENTF", "INPUT_MOUSE", "MOUSEINPUT"] {
                assert!(!line.contains(n), "{name}: `{n}` outside pointer.rs");
            }
        }
    }
    // exactly one call site, and the flags are the seven of move, two buttons and the wheel
    let pointer = fs::read_to_string(root().join("src/pointer.rs")).unwrap();
    let calls = code_lines(&pointer)
        .filter(|l| l.contains("SendInput(") && !l.contains("fn "))
        .count();
    assert_eq!(calls, 1, "one SendInput call");
    let mut flags: Vec<&str> = code_lines(&pointer)
        .flat_map(|l| l.split(|c: char| !c.is_ascii_alphanumeric() && c != '_'))
        .filter(|w| w.starts_with("MOUSEEVENTF_"))
        .collect();
    flags.sort_unstable();
    flags.dedup();
    assert_eq!(
        flags,
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
}

/// The media level stays API calls: the worker and the system file never reach for the pointer.
#[test]
fn the_media_level_simulates_nothing() {
    for file in ["worker.rs", "system.rs"] {
        let text = fs::read_to_string(root().join("src").join(file)).unwrap();
        for line in code_lines(&text) {
            for n in ["pointer", "Pointer", "Mouse", "Hand"] {
                assert!(!line.contains(n), "{file}: `{n}`");
            }
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
                name == "system.rs" || name == "pointer.rs",
                "{name}: unsafe outside the Windows calls"
            );
            let explained = lines[i.saturating_sub(4)..i]
                .iter()
                .any(|l| l.contains("// SAFETY:"));
            assert!(explained, "{name}:{}: unsafe without a SAFETY note", i + 1);
        }
    }
}
