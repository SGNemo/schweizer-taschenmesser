//! Guards the per-window command permissions: every command registered in `generate_handler!`
//! must be listed in `build.rs` (otherwise no capability can grant it and it silently stops
//! working), every other command must be granted to the main window (default.json or the
//! desktop-only desktop.json), and the capture window may only get its own commands.

use std::fs;

fn read(path: &str) -> String {
    fs::read_to_string(format!("{}/{path}", env!("CARGO_MANIFEST_DIR"))).unwrap()
}

fn handler_commands() -> Vec<String> {
    let lib = read("src/lib.rs");
    let start = lib
        .find("generate_handler![")
        .expect("generate_handler block");
    let block = &lib[start..lib[start..].find(']').map(|i| start + i).unwrap()];
    block
        .split(',')
        .filter_map(|item| item.trim().rsplit("::").next().map(str::trim))
        .filter(|name| !name.is_empty() && !name.contains('['))
        .map(str::to_owned)
        .collect()
}

#[test]
fn every_handler_command_is_in_the_app_manifest() {
    let build = read("build.rs");
    let commands = handler_commands();
    assert!(commands.len() >= 17, "parsed {commands:?}");
    for name in commands {
        assert!(
            build.contains(&format!("\"{name}\"")),
            "{name} missing in build.rs"
        );
    }
}

/// Every permission string granted to the `main` window, from all capability files that name it
/// (`default.json` for everything shared, `desktop.json` for the desktop-only commands).
fn main_window_permissions() -> Vec<String> {
    let mut granted = Vec::new();
    for file in ["capabilities/default.json", "capabilities/desktop.json"] {
        let value: serde_json::Value = serde_json::from_str(&read(file)).unwrap();
        let windows = value["windows"].as_array().unwrap();
        assert!(
            windows.iter().any(|w| w == "main"),
            "{file} does not apply to the main window"
        );
        granted.extend(
            value["permissions"]
                .as_array()
                .unwrap()
                .iter()
                .filter_map(|p| p.as_str().map(str::to_owned)),
        );
    }
    granted
}

#[test]
fn main_window_is_granted_every_command_except_capture_only_ones() {
    let granted = main_window_permissions();
    for name in handler_commands() {
        if name == "capture_hide" || name == "capture_read_clipboard" {
            continue;
        }
        let permission = format!("allow-{}", name.replace('_', "-"));
        assert!(
            granted.contains(&permission),
            "{permission} is granted to the main window by neither default.json nor desktop.json"
        );
    }
}

#[test]
fn capture_window_gets_only_its_own_commands() {
    let capture = read("capabilities/capture.json");
    let value: serde_json::Value = serde_json::from_str(&capture).unwrap();
    let permissions: Vec<&str> = value["permissions"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p.as_str().unwrap())
        .collect();
    assert_eq!(
        permissions,
        ["allow-capture-hide", "allow-capture-read-clipboard"]
    );
    assert_eq!(value["windows"], serde_json::json!(["capture"]));
}
