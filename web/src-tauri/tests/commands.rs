//! Guards the per-window command permissions: every command registered in `generate_handler!`
//! must be listed in `build.rs` (otherwise no capability can grant it and it silently stops
//! working), and the capture window may only get its own commands.

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

#[test]
fn main_window_is_granted_every_command_except_capture_only_ones() {
    let default = read("capabilities/default.json");
    for name in handler_commands() {
        if name == "capture_hide" || name == "capture_read_clipboard" {
            continue;
        }
        let permission = format!("\"allow-{}\"", name.replace('_', "-"));
        assert!(
            default.contains(&permission),
            "{permission} missing in default.json"
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
