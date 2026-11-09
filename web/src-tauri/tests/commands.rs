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
        // `webviews`, not `windows`: the browser tabs are child webviews INSIDE the main window and
        // must not inherit what the main webview may do.
        assert!(value.get("windows").is_none(), "{file}: use webviews");
        let webviews = value["webviews"].as_array().unwrap();
        assert!(
            webviews.iter().any(|w| w == "main"),
            "{file} does not apply to the main webview"
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

/// The built-in browser loads foreign pages in child webviews (`browser-tab-<n>`) of the main window.
/// They must reach nothing of Nemo: no capability may name them, match everything, or open IPC to a
/// remote origin.
#[test]
fn browser_tabs_get_no_capability() {
    for entry in fs::read_dir(format!("{}/capabilities", env!("CARGO_MANIFEST_DIR"))).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().is_none_or(|e| e != "json") {
            continue;
        }
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        let value: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert!(
            value.get("remote").is_none(),
            "{name}: remote IPC is forbidden"
        );
        for key in ["windows", "webviews"] {
            for label in value[key].as_array().into_iter().flatten() {
                let label = label.as_str().unwrap();
                assert!(
                    !label.contains('*') && !label.starts_with("browser"),
                    "{name}: {key} entry {label:?} could match a browser tab"
                );
            }
        }
    }
}

/// Only the main webview may drive tabs: every browser command checks its caller.
#[test]
fn browser_commands_check_the_caller() {
    let src = read("src/browser.rs");
    let commands =
        src.matches("#[tauri::command]").count() + src.matches("#[tauri::command(async)]").count();
    assert_eq!(commands, src.matches("ensure_main(&webview)?;").count());
}

/// The music page opens the Spotify app with a `spotify:` link, and home-network sync opens Windows' network page (to set
/// the network to "Private"): the opener may open exactly these besides the default ones (http, https, mailto, tel) –
/// the one `ms-settings:` page, not the scheme.
#[test]
fn opener_scope_adds_only_spotify_and_the_network_settings_page() {
    let value: serde_json::Value =
        serde_json::from_str(&read("capabilities/default.json")).unwrap();
    let scoped: Vec<&serde_json::Value> = value["permissions"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|p| p["identifier"] == "opener:allow-open-url")
        .collect();
    assert_eq!(scoped.len(), 1, "one scoped opener grant");
    let urls: Vec<&str> = scoped[0]["allow"]
        .as_array()
        .unwrap()
        .iter()
        .map(|a| a["url"].as_str().unwrap())
        .collect();
    assert_eq!(urls, ["spotify:*", "ms-settings:network-status"]);
}

/// Creating (or closing) a webview from a synchronous command deadlocks WebView2 on Windows: the
/// main thread hangs, IPC and app assets stop answering and every other Nemo page stays at "…".
/// Every command that creates or closes webviews must run off the main thread (`async`).
#[test]
fn webview_lifecycle_commands_never_run_on_the_main_thread() {
    let src = read("src/browser.rs");
    for name in ["browser_open", "browser_close", "browser_clear_data"] {
        let at = src
            .find(&format!("pub fn {name}("))
            .unwrap_or_else(|| panic!("{name} not found"));
        let attr = src[..at]
            .rfind("#[tauri::command")
            .expect("command attribute");
        assert!(
            src[attr..at].starts_with("#[tauri::command(async)]"),
            "{name} must be #[tauri::command(async)] (WebView2 deadlock on Windows)"
        );
    }
    // No other command may build a webview.
    for (i, _) in src.match_indices(".add_child(") {
        let cmd = src[..i].rfind("pub fn ").unwrap();
        assert!(
            src[cmd..].starts_with("pub fn browser_open("),
            "add_child outside browser_open"
        );
    }
}
