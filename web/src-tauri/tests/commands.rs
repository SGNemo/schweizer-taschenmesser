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
    for name in [
        "browser_open",
        "browser_close",
        "browser_show",
        "browser_clear_data",
    ] {
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

/// Source of `src/<file>` with LF line ends (Windows checkouts have CRLF; the patterns below span
/// two lines).
fn source(file: &str) -> String {
    read(&format!("src/{file}")).replace("\r\n", "\n")
}

fn assert_async(src: &str, names: &[&str]) {
    for name in names {
        assert!(
            src.contains(&format!("#[tauri::command(async)]\npub fn {name}(")),
            "{name} must be #[tauri::command(async)]"
        );
    }
}

/// Commands the inventory (`docs/perf/MAIN-THREAD-COMMANDS-2026-11.md`) rates "can block the main
/// thread" stay off it.
#[test]
fn blocking_commands_never_run_on_the_main_thread() {
    let lan = source("lan_sync.rs");
    assert_eq!(lan.matches("#[tauri::command]").count(), 0, "lan_sync.rs");
    assert_eq!(
        lan.matches("#[tauri::command(async)]\npub fn lan_").count(),
        11
    );
    assert_async(
        &source("disk.rs"),
        &[
            "disk_children",
            "disk_query",
            "disk_known_places",
            "disk_reveal",
            "disk_can_delete",
            "disk_delete_plan",
            "disk_delete",
        ],
    );
    assert_async(
        &source("capture.rs"),
        &[
            "capture_read_clipboard",
            "desktop_set_autostart",
            "desktop_autostart_enabled",
            "desktop_take_panic_log",
            "desktop_open_data_dir",
        ],
    );
    assert_async(&source("system.rs"), &["system_open_task_manager"]);
    // Every command that reaches the download manager (file access, one at a time under the gate).
    let downloads = source("downloads.rs");
    assert_eq!(
        downloads
            .matches("#[tauri::command(async)]\npub fn downloads_")
            .count(),
        10
    );
    assert_eq!(downloads.matches("#[tauri::command]").count(), 1);
    assert!(downloads.contains("#[tauri::command]\npub fn downloads_default_dir("));
    // Both builds of the three registration commands (Windows and elsewhere), plus start and stop.
    let bridge = source("vault_bridge.rs");
    assert_eq!(
        bridge
            .matches("#[tauri::command(async)]\npub fn vault_bridge_")
            .count(),
        8
    );
    assert_eq!(bridge.matches("#[tauri::command]").count(), 1);
    assert!(bridge.contains("#[tauri::command]\npub fn vault_bridge_respond("));
}

/// The tab calls that stay on the main thread on purpose: the WebView2 call behind them runs there
/// either way, and the main thread keeps two quick "back" clicks in order.
#[test]
fn tab_navigation_stays_in_call_order() {
    let src = source("browser.rs");
    for name in [
        "browser_navigate",
        "browser_back",
        "browser_forward",
        "browser_reload",
        "browser_set_zoom",
    ] {
        assert!(
            src.contains(&format!("#[tauri::command]\npub fn {name}(")),
            "{name} is expected to be a plain #[tauri::command]"
        );
    }
}

/// `disk_delete` left the main thread by its attribute alone. Its checks keep their order: plan
/// known → not expired → second confirmation → not already running → fresh guard (block list) →
/// only then the worker that deletes.
#[test]
fn disk_delete_checks_keep_their_order() {
    let src = source("disk.rs");
    let start = src.find("pub fn disk_delete(").expect("disk_delete");
    let body = &src[start..start + src[start..].find("\n}\n").expect("end of disk_delete")];
    let steps = [
        "inner.plans.get(&plan_id).cloned().ok_or(\"unknown-plan\")?",
        "return Err(\"plan-expired\".into());",
        "if stored.plan.needs_double_confirmation(mode) && !confirmed_twice {",
        "return Err(\"confirmation-missing\".into());",
        ".swap(true, std::sync::atomic::Ordering::SeqCst)",
        "return Err(\"already-running\".into());",
        "let guard = guard_for(&app);",
        ".spawn(move || {",
        "let report = execute(",
        "&stored.plan,",
        "&guard,",
    ];
    let mut at = 0;
    for step in steps {
        let found = body[at..]
            .find(step)
            .unwrap_or_else(|| panic!("disk_delete: {step:?} missing or out of order"));
        at += found + step.len();
    }
    // Nothing deletes outside that worker, and the guard is built once.
    assert_eq!(body.matches("execute(").count(), 1);
    assert_eq!(body.matches("guard_for(").count(), 1);
}

/// The four remote-control commands and nothing else, all off the main thread: two of them wait
/// for a native dialog, which must never block the event loop (or be shown from it).
#[test]
fn remote_commands_never_run_on_the_main_thread() {
    let src = source("remote.rs");
    assert_eq!(src.matches("#[tauri::command]").count(), 0);
    assert_eq!(src.matches("#[tauri::command(async)]\npub fn ").count(), 4);
    assert_async(
        &src,
        &[
            "remote_status",
            "remote_set_enabled",
            "remote_set_device",
            "remote_end",
        ],
    );
}

/// The command part of `src/remote.rs` (between the marker and the unit tests).
fn remote_commands_source() -> String {
    let src = source("remote.rs");
    let start = src.find("// ---- commands ----").expect("commands marker");
    let end = src.find("#[cfg(test)]").expect("unit tests");
    src[start..end].to_owned()
}

/// Rule "no Tauri command simulates input" (`docs/rules/remote-control.md`): input reaches the PC
/// only through the hub's input session. No command takes an action, hands one to the sink or the
/// worker, and nothing in the shell calls an input-simulation API – that lives in
/// `crates/remote-input`, which has its own source test.
#[test]
fn no_tauri_command_simulates_input() {
    let commands = remote_commands_source();
    for forbidden in [
        "Action",
        "Sink",
        "Worker",
        "Pointer",
        "Mouse",
        "Command::",
        "Media::",
        ".apply(",
        ".send(",
        "remote_input",
    ] {
        assert!(
            !commands.contains(forbidden),
            "a remote command mentions {forbidden}"
        );
    }
    // the sink is the only place that hands anything to the worker (only media) or to the
    // pointer thread (only what `pointer_of` maps: move, button, scroll)
    let src = source("remote.rs");
    let code = &src[..src.find("#[cfg(test)]").unwrap()];
    assert_eq!(
        code.matches("self.media.send(command_of(media))").count(),
        1
    );
    assert_eq!(code.matches("self.pointer.send(pointer)").count(), 1);
    assert_eq!(code.matches("self.media.send(").count(), 1);
    assert_eq!(code.matches("self.pointer.send(").count(), 1);
    assert_eq!(
        code.matches("Pointer::start()").count(),
        1,
        "started by the sink only"
    );
    assert_eq!(
        code.matches("Worker::start()").count(),
        1,
        "started by the sink only"
    );
    assert_eq!(code.matches("impl InputSink for").count(), 1);
    let map = &code[code.find("fn pointer_of(").unwrap()..];
    let map = &map[..map.find("\n}\n").unwrap()];
    assert!(map.contains("Action::Key(_) | Action::Media(_) | Action::Text(_) => return None"));

    // nowhere in the shell: simulated input, or a command of another module reaching the sink
    for entry in fs::read_dir(format!("{}/src", env!("CARGO_MANIFEST_DIR"))).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().is_none_or(|e| e != "rs") {
            continue;
        }
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        let text = fs::read_to_string(&path).unwrap();
        for api in [
            "SendInput",
            "keybd_event",
            "mouse_event",
            "SetCursorPos",
            "enigo",
            "KEYEVENTF",
            "MOUSEEVENTF",
        ] {
            assert!(!text.contains(api), "{name} mentions {api}");
        }
        if name != "remote.rs" {
            assert!(
                !text.contains("remote_input") && !text.contains("InputSink for"),
                "{name} reaches the input sink"
            );
        }
    }
}

/// The notice of a mouse/keyboard session comes from Rust alone: one place shows it (the tray
/// thread), no command and no event to the page is involved, and no sound is set (a Windows
/// toast without one is silent).
#[test]
fn the_full_session_notice_is_shown_from_rust_only() {
    let commands = remote_commands_source();
    for forbidden in ["remote_notice", "Notices", "full_opened"] {
        assert!(
            !commands.contains(forbidden),
            "a remote command mentions {forbidden}"
        );
    }
    let remote = source("remote.rs");
    let code = &remote[..remote.find("#[cfg(test)]").unwrap()];
    assert_eq!(code.matches("remote_notice::show(").count(), 1);
    let notice = source("remote_notice.rs");
    let code = &notice[..notice.find("#[cfg(test)]").unwrap()];
    for forbidden in ["emit(", "tauri::command", "std::fs", "File::", ".sound("] {
        assert!(!code.contains(forbidden), "remote_notice.rs: {forbidden}");
    }
}

/// Every widening is asked at the PC, in a fixed order: ticket, native dialog, setter with that
/// ticket. A setter without a ticket is only ever a narrowing (the crate refuses anything else).
#[test]
fn remote_widening_takes_a_ticket_before_the_native_dialog() {
    let commands = remote_commands_source();
    for name in ["remote_set_enabled", "remote_set_device"] {
        let at = commands.find(&format!("pub fn {name}(")).unwrap();
        let body = &commands[at..];
        let body = &body[..body.find("\n}\n").unwrap()];
        let ticket = body.find("parts.remote.ticket()").expect("ticket");
        let dialog = body.find("confirmed(&app").expect("native dialog");
        let setter = body.rfind("Some(ticket)").expect("setter with the ticket");
        let busy = body.find("full_session_open()").expect("session check");
        assert!(
            ticket < busy && busy < dialog && dialog < setter,
            "{name}: wrong order"
        );
        assert_eq!(body.matches("parts.remote.ticket()").count(), 1, "{name}");
        // the only setter call before the dialog passes no ticket (a narrowing)
        assert!(!body[..dialog].contains("Some("), "{name}");
    }
    // `remote_end` and `remote_status` widen nothing
    for name in ["remote_status", "remote_end"] {
        let at = commands.find(&format!("pub fn {name}(")).unwrap();
        let body = &commands[at..];
        let body = &body[..body.find("\n}\n").unwrap()];
        assert!(
            !body.contains("ticket")
                && !body.contains("set_enabled")
                && !body.contains("set_grant"),
            "{name}"
        );
    }
    // the answer comes from a blocking native dialog, never from the page
    let src = source("remote.rs");
    assert_eq!(src.matches(".blocking_show()").count(), 1);
    assert!(!commands.contains("confirmed: bool") && !commands.contains("confirm: bool"));
}

/// Only the tray thread says who controls: nothing else in the shell calls `set_remote_tray`.
#[test]
fn only_the_tray_thread_writes_who_controls() {
    let mut calls = 0;
    for entry in fs::read_dir(format!("{}/src", env!("CARGO_MANIFEST_DIR"))).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().is_none_or(|e| e != "rs") {
            continue;
        }
        let text = fs::read_to_string(&path).unwrap();
        calls += text.matches("set_remote_tray(&").count();
    }
    assert_eq!(calls, 1, "one call, inside the tray thread's writer");
    assert!(!remote_commands_source().contains("set_remote_tray"));
}

/// The hub wires remote control on every desktop, and its controls go away with the hub.
#[test]
fn the_hub_wires_remote_control_and_drops_it_on_stop() {
    let lan = source("lan_sync.rs");
    assert_eq!(lan.matches(".with_input(").count(), 1);
    assert_eq!(lan.matches("crate::remote::attach(").count(), 1);
    assert_eq!(lan.matches("crate::remote::detach(").count(), 1);
    let stop = &lan[lan.find("pub fn lan_hub_stop(").unwrap()..];
    let stop = &stop[..stop.find("\n}\n").unwrap()];
    // sessions are closed before the controls and the tray indicator go
    assert!(stop.find("close_all()").unwrap() < stop.find("crate::remote::detach(").unwrap());
}

/// The commands of the phone's handler (`#[cfg(mobile)]` block in `src/lib.rs`).
fn mobile_handler_commands() -> Vec<String> {
    // LF line ends: a Windows checkout has CRLF, and the pattern below spans two lines
    let lib = source("lib.rs");
    let at = lib
        .find("#[cfg(mobile)]\n    let builder = builder.invoke_handler(")
        .expect("mobile handler");
    let start = at + lib[at..].find("generate_handler![").unwrap();
    let block = &lib[start..lib[start..].find(']').map(|i| start + i).unwrap()];
    block
        .split(',')
        .filter_map(|item| item.trim().rsplit("::").next().map(str::trim))
        .filter(|name| !name.is_empty() && !name.contains('['))
        .map(str::to_owned)
        .collect()
}

fn permissions_of(file: &str) -> Vec<String> {
    let value: serde_json::Value = serde_json::from_str(&read(file)).unwrap();
    value["permissions"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|p| p.as_str().map(str::to_owned))
        .collect()
}

/// Remote control, phone side: the three commands exist on the phone only. They are in the mobile
/// handler and in `mobile.json`, in the app manifest, and nowhere a desktop window could get them.
#[test]
fn remote_client_commands_exist_on_the_phone_only() {
    let wanted = [
        "remote_client_open",
        "remote_client_send",
        "remote_client_pointer",
        "remote_client_close",
    ];
    let mobile = mobile_handler_commands();
    let desktop = handler_commands();
    let build = read("build.rs");
    let granted = permissions_of("capabilities/mobile.json");
    for name in wanted {
        assert!(
            mobile.iter().any(|c| c == name),
            "{name}: not in the mobile handler"
        );
        assert!(
            !desktop.iter().any(|c| c == name),
            "{name}: in the desktop handler"
        );
        assert!(
            build.contains(&format!("\"{name}\"")),
            "{name}: not in build.rs"
        );
        let permission = format!("allow-{}", name.replace('_', "-"));
        assert!(
            granted.contains(&permission),
            "{permission}: not in mobile.json"
        );
        for other in [
            "capabilities/default.json",
            "capabilities/desktop.json",
            "capabilities/capture.json",
        ] {
            assert!(
                !permissions_of(other).contains(&permission),
                "{permission} is granted in {other}"
            );
        }
    }
    // every command of the mobile handler is in the app manifest and granted to the phone's page
    let mut phone = permissions_of("capabilities/default.json");
    phone.extend(granted);
    for name in &mobile {
        assert!(
            build.contains(&format!("\"{name}\"")),
            "{name} missing in build.rs"
        );
        let permission = format!("allow-{}", name.replace('_', "-"));
        assert!(
            phone.contains(&permission),
            "{permission}: the phone's page cannot call it"
        );
    }
    // mobile.json applies to the phone only
    let value: serde_json::Value = serde_json::from_str(&read("capabilities/mobile.json")).unwrap();
    assert_eq!(value["platforms"], serde_json::json!(["android", "iOS"]));
    assert_eq!(value["webviews"], serde_json::json!(["main"]));
}

/// The phone's remote client never unpairs, never touches the sync link, keeps keys in Rust and
/// takes only names from its fixed list.
#[test]
fn the_remote_client_only_passes_on_fixed_actions_and_keeps_out_of_sync() {
    let src = source("remote_client.rs");
    // the code without its comments (the header explains what the file must not do)
    let code: String = src[..src.find("#[cfg(test)]").unwrap()]
        .lines()
        .filter(|line| !line.trim_start().starts_with("//"))
        .collect::<Vec<_>>()
        .join("\n");
    let code = code.as_str();
    for forbidden in [
        "forget(",
        "unpair",
        ".link",
        "Link",
        "send_text",
        "Record::Key",
        "Key::",
        "println!",
        "eprintln!",
        "log::",
        "dbg!",
    ] {
        assert!(
            !code.contains(forbidden),
            "remote_client.rs mentions {forbidden}"
        );
    }
    // the mouse level goes through the gate, and the phone's unlock never touches the vault's
    // biometric key: it is the plugin's keyless presence prompt, which no command of the page
    // maps to
    let open = &code[code.find("pub async fn remote_client_open").unwrap()..];
    let open = &open[..open.find("\n}\n").unwrap()];
    assert!(open.contains("pass_gate(&app, prompt.as_ref()).await?"));
    assert!(open.contains("if !keep("));
    for vault in ["biometric_seal", "biometric_unseal", "biometric_delete"] {
        assert!(!code.contains(vault), "remote_client.rs mentions {vault}");
    }
    let plugin = format!("{}/plugins/secure-store", env!("CARGO_MANIFEST_DIR"));
    for file in [
        "build.rs",
        "src/commands.rs",
        "src/lib.rs",
        "permissions/default.toml",
    ] {
        let text = fs::read_to_string(format!("{plugin}/{file}")).unwrap();
        assert!(
            !text.contains("confirm_user") && !text.contains("confirm-user"),
            "{file}: the presence prompt must not become a command of the page"
        );
    }
    // the key and the hub entry are read, never returned: no DTO carries them
    assert_eq!(code.matches("stored_key(&app)").count(), 1);
    assert_eq!(code.matches("hub_entry(&app)").count(), 1);
    for dto in ["StateDto", "EventDto", "OpenedDto"] {
        let at = code
            .find(&format!("pub struct {dto}"))
            .or_else(|| code.find(&format!("pub enum {dto}")));
        let body = &code[at.unwrap()..];
        let body = &body[..body.find("\n}\n").unwrap()];
        // field names only: the test names which kind of field a DTO must never have
        for field in ["key", "hub", "addr", "name"] {
            assert!(
                !body.to_lowercase().contains(field),
                "{dto} carries {field}"
            );
        }
    }
}
