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
    assert_eq!(one_call(imp), 1, "one SendInput call");
    assert_eq!(types(imp), ["r#type: INPUT_KEYBOARD,"]);
    assert_eq!(
        words(imp, "KEYEVENTF_"),
        [
            "KEYEVENTF_EXTENDEDKEY",
            "KEYEVENTF_KEYUP",
            "KEYEVENTF_UNICODE"
        ]
    );
    assert_eq!(
        words(imp, "VK_"),
        [
            "VK_BACK",
            "VK_DELETE",
            "VK_DOWN",
            "VK_END",
            "VK_ESCAPE",
            "VK_F11",
            "VK_HOME",
            "VK_LEFT",
            "VK_MENU",
            "VK_NEXT",
            "VK_PRIOR",
            "VK_RETURN",
            "VK_RIGHT",
            "VK_SPACE",
            "VK_TAB",
            "VK_UP",
        ]
    );
    // each virtual key is named twice: in the import and for its one `Code`; Alt is `Code::Alt`
    for vk in words(imp, "VK_") {
        assert_eq!(imp.matches(vk.as_str()).count(), 2, "{vk}");
    }
    assert!(imp.contains("Code::Alt => (VK_MENU, false),"));
    assert_eq!(
        code_lines(imp)
            .filter(|l| l.contains("Code::") && l.contains("=> (VK_"))
            .count(),
        16
    );
    // No key and no flag by another spelling: none built from a number but "none", no struct
    // literal, no renamed import, no alias, no field read or written after the event is built,
    // no inverted flags, no reinterpreting.
    for line in code_lines(imp) {
        for (built, none) in [
            ("VIRTUAL_KEY(", "VIRTUAL_KEY(0)"),
            ("KEYBD_EVENT_FLAGS(", "KEYBD_EVENT_FLAGS(0)"),
        ] {
            let rest = line.replace(none, "");
            assert!(!rest.contains(built), "keyboard.rs: `{}`", line.trim());
        }
        for n in [
            "VIRTUAL_KEY {",
            "KEYBD_EVENT_FLAGS {",
            "transmute",
            "from_raw",
            "as *",
            "type ",
            ".Anonymous",
            ".ki",
            ".wVk",
            ".wScan",
            ".dwFlags",
            "!(",
            "!KEYEVENTF",
            "!flags",
            "^",
            "<<",
            "iter::once",
            "repeat",
            ".push(",
            ".extend(",
            ".insert(",
            "chain(",
        ] {
            assert!(!line.contains(n), "keyboard.rs: `{n}` in `{}`", line.trim());
        }
        let renamed =
            line.contains(" as ") && !line.contains(" as i32") && !line.contains(" as usize");
        assert!(!renamed, "keyboard.rs: a renamed name in `{}`", line.trim());
        let field = line
            .match_indices(".0")
            .any(|(at, _)| !line[at + 2..].starts_with(|c: char| c.is_ascii_digit()));
        assert!(!field, "keyboard.rs: a `.0` field in `{}`", line.trim());
    }
    // one way into an event: the three fields take what `event` is handed, and `event` is
    // called for a key of the list and for a unit of text, nowhere else
    for field in ["wVk: vk,", "wScan: scan,", "dwFlags: flags,"] {
        assert_eq!(imp.matches(field).count(), 1, "{field}");
    }
    let calls: Vec<&str> = code_lines(imp)
        .filter(|l| l.contains("event(") && !l.contains("fn event("))
        .map(str::trim)
        .collect();
    assert_eq!(
        calls,
        [
            "event(vk, 0, flags)",
            "Stroke::Unit { unit, .. } => event(VIRTUAL_KEY(0), unit, flags | KEYEVENTF_UNICODE),"
        ]
    );
    // every planned stroke becomes exactly one event, in order: nothing added, nothing dropped
    assert_eq!(
        imp.matches(
            "let inputs: Vec<INPUT> = strokes.iter().map(|stroke| input(*stroke)).collect();"
        )
        .count(),
        1
    );
    assert_eq!(imp.matches("SendInput(&inputs,").count(), 1);
    assert_eq!(imp.matches("input(").count(), 2, "defined once, used once");
    assert_eq!(imp.matches("Vec<").count(), 1);
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
