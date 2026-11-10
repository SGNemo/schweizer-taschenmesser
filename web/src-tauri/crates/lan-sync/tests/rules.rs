//! Source-level rules of the LAN sync crate (CONCEPT §5, `docs/RULES.md`). They scan the files, so
//! a later change that breaks a rule fails here even if every behaviour test still passes.

use std::fs;
use std::path::{Path, PathBuf};

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// Every `.rs` file under `src/`, with the test-only parts removed: files named `tests.rs`, and
/// inline `#[cfg(test)]` modules (everything from that attribute to the end of the file).
fn production_sources() -> Vec<(String, String)> {
    fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
        for e in fs::read_dir(dir).unwrap() {
            let p = e.unwrap().path();
            if p.is_dir() {
                walk(&p, out);
            } else if p.extension().is_some_and(|x| x == "rs") {
                out.push(p);
            }
        }
    }
    let mut files = vec![];
    walk(&root().join("src"), &mut files);
    files
        .into_iter()
        .filter(|p| p.file_name().unwrap() != "tests.rs")
        .map(|p| {
            let text = fs::read_to_string(&p).unwrap();
            let kept = match text.find("#[cfg(test)]") {
                Some(i) => text[..i].to_owned(),
                None => text,
            };
            (
                p.strip_prefix(root())
                    .unwrap()
                    .display()
                    .to_string()
                    .replace('\\', "/"),
                kept,
            )
        })
        .collect()
}

fn code_lines(text: &str) -> impl Iterator<Item = &str> {
    text.lines().filter(|l| {
        let t = l.trim_start();
        !(t.starts_with("//"))
    })
}

fn assert_absent(needles: &[&str], only_under: Option<&str>) {
    assert_absent_outside(needles, only_under, None);
}

fn assert_absent_outside(needles: &[&str], only_under: Option<&str>, except: Option<&str>) {
    for (name, text) in production_sources() {
        if only_under.is_some_and(|d| !name.contains(d)) || except.is_some_and(|d| name.contains(d))
        {
            continue;
        }
        for line in code_lines(&text) {
            for n in needles {
                assert!(!line.contains(n), "{name}: `{n}` in `{}`", line.trim());
            }
        }
    }
}

#[test]
fn no_sockets_or_async_runtime_outside_tests() {
    assert_absent(&["tokio", "async fn", "ToSocketAddrs"], None);
    // sockets live in `src/transport` and nowhere else
    assert_absent_outside(
        &[
            "TcpListener",
            "TcpStream",
            "UdpSocket",
            "SocketAddr",
            "TcpSocket",
        ],
        None,
        Some("src/transport"),
    );
}

/// The transport never formats a peer address or a frame (no `{:?}`/`{}` of either).
#[test]
fn the_transport_formats_nothing() {
    assert_absent(
        &["{:?}", "format!", "to_string()", "write!("],
        Some("src/transport"),
    );
}

/// The hub core uses `std::net` for address *types* only (policy decisions); sockets are package 2b-2.
#[test]
fn std_net_is_for_address_types_only() {
    assert_absent(&["std::net::*", "use std::net;"], None);
}

#[test]
fn the_hub_core_reads_no_clock() {
    assert_absent(
        &["SystemTime", "UNIX_EPOCH", "Instant::now"],
        Some("src/hub"),
    );
    // remote control: limits and the state interval get their time as an argument
    assert_absent(
        &["SystemTime", "UNIX_EPOCH", "Instant", "chrono"],
        Some("src/input"),
    );
}

// ---------- remote control (`docs/rules/remote-control.md`) ----------

fn source(name: &str) -> String {
    production_sources()
        .into_iter()
        .find(|(n, _)| n == name)
        .unwrap_or_else(|| panic!("{name} missing"))
        .1
}

/// This crate decides and hands typed actions to a sink; it never simulates input itself.
#[test]
fn no_os_input_api_in_this_crate() {
    assert_absent(
        &[
            "SendInput",
            "keybd_event",
            "mouse_event",
            "SetCursorPos",
            "enigo",
            "windows::",
            "winapi",
            "VK_",
            "uinput",
            "xdotool",
            "CGEvent",
        ],
        None,
    );
    let m = fs::read_to_string(root().join("Cargo.toml")).unwrap();
    for banned in ["enigo", "windows", "winapi", "rdev", "inputbot"] {
        assert!(
            !m.lines().any(|l| l.trim_start().starts_with(banned)),
            "dependency `{banned}`"
        );
    }
}

/// The switch and the grants are changed by the PC's own controls only. Nothing on the path of a
/// frame from the network (wire, session, router, endpoint, transport) can reach a setter.
#[test]
fn no_frame_from_the_network_reaches_a_setter() {
    let setters = ["set_enabled", "set_grant", "set_remote", ".set(", ".end()"];
    for (name, text) in production_sources() {
        let on_the_path = [
            "src/input/wire.rs",
            "src/input/session.rs",
            "src/input/limits.rs",
            "src/input/sink.rs",
            "src/hub/router.rs",
            "src/endpoint.rs",
        ]
        .contains(&name.as_str())
            || name.contains("src/transport");
        if !on_the_path {
            continue;
        }
        for line in code_lines(&text) {
            for s in setters {
                assert!(!line.contains(s), "{name}: `{s}` in `{}`", line.trim());
            }
        }
    }
    // and the trust store's setter is called from the PC's controls and the store itself only
    for (name, text) in production_sources() {
        if name == "src/input/remote.rs" || name.starts_with("src/trust/") {
            continue;
        }
        for line in code_lines(&text) {
            assert!(!line.contains("set_remote"), "{name}: {}", line.trim());
        }
    }
}

/// An input session records nothing: the one place that writes `lastSeen` is fenced to sync
/// sessions, and nothing under `src/input` stores a time or touches the trust list's activity.
#[test]
fn an_input_session_leaves_no_trace() {
    assert_absent(&["touch(", "last_seen", "lastSeen"], Some("src/input"));
    let endpoint = source("src/endpoint.rs");
    let touches: Vec<&str> = code_lines(&endpoint)
        .filter(|l| l.contains(".touch("))
        .collect();
    assert_eq!(touches.len(), 1, "one place records activity");
    let at = endpoint.find(".touch(").unwrap();
    let before = &endpoint[..at];
    let guard = before
        .rfind("if self.mode == noise::Mode::Session")
        .expect("mode guard");
    assert!(
        before[guard..].lines().count() <= 2,
        "the touch sits directly inside the sync-session guard"
    );
    // the grant on disk is three settings, nothing about use
    let file = source("src/trust/file.rs");
    for field in ["remote:", "remote_paused:", "remote_unlock:"] {
        assert!(file.contains(field), "{field}");
    }
    for word in [
        "remoteUsed",
        "used_at",
        "usedAt",
        "last_input",
        "last_remote",
    ] {
        assert!(
            !file.contains(word),
            "no time of use in the trust file: {word}"
        );
    }
}

/// What the user typed and what was pressed is never formatted: `Action` has a redacted `Debug`
/// and no `Display`, and nothing under `src/input` formats anything at all.
#[test]
fn input_is_never_formatted() {
    let sink = source("src/input/sink.rs");
    let action = sink.find("pub enum Action").expect("Action");
    let derive = sink[..action].rfind("#[derive(").expect("derive");
    let derives = &sink[derive..action];
    assert!(!derives.contains("Debug"), "Action must not derive Debug");
    assert!(!derives.contains("Serialize"));
    assert!(sink.contains("f.write_str(\"Action(..)\")"));
    assert!(!sink.contains("impl fmt::Display"));
    assert_absent(
        &["format!", "to_string()", "write!(", "{:?}", "serde"],
        Some("src/input/s"),
    );
    assert_absent(
        &["format!", "to_string()", "write!(", "{:?}"],
        Some("src/input/wire"),
    );
    assert_absent(
        &["format!", "to_string()", "write!(", "{:?}"],
        Some("src/input/limits"),
    );
}

/// The input path never reaches the sync store, and the sync handler never sees an input frame.
#[test]
fn input_and_sync_stay_apart() {
    assert_absent(
        &[
            "crate::store",
            "crate::Store",
            "Store::",
            "handle_json",
            "FieldOp",
            "crate::hub",
            "rusqlite",
        ],
        Some("src/input"),
    );
    assert_absent(
        &["crate::input", "TAG_EVENTS", "TAG_TEXT"],
        Some("src/hub/handler"),
    );
    assert_absent(&["crate::input"], Some("src/store"));
    // the input session is its own handshake mode, with a cap of its own
    let frame = source("src/noise/frame.rs");
    assert!(frame.contains("pub const MODE_INPUT: u8 = 3;"));
    assert!(frame.contains("pub const INPUT_CAP: usize = 512;"));
}

#[test]
fn the_hub_never_touches_the_local_api() {
    assert_absent(&["local_api", "local-api", "LOCAL_API"], None);
}

#[test]
fn no_log_crate_in_the_manifest() {
    let m = fs::read_to_string(root().join("Cargo.toml")).unwrap();
    for banned in ["log", "tracing", "env_logger", "slog"] {
        assert!(
            !m.lines().any(|l| {
                let t = l.trim_start();
                t.starts_with(banned) && t[banned.len()..].trim_start().starts_with('=')
            }),
            "log crate `{banned}`"
        );
    }
}

#[test]
fn nothing_is_logged_or_printed() {
    assert_absent(
        &[
            "println!",
            "eprintln!",
            "print!(",
            "dbg!",
            "log::",
            "tracing::",
            "info!(",
            "warn!(",
            "error!(",
            "debug!(",
            "trace!(",
        ],
        None,
    );
}

#[test]
fn pairing_uses_the_monotonic_clock_only() {
    assert_absent(&["SystemTime", "UNIX_EPOCH", "chrono"], Some("src/pairing"));
    assert_absent(
        &["SystemTime", "UNIX_EPOCH", "chrono"],
        Some("src/endpoint"),
    );
}

#[test]
fn only_the_stateful_transport_is_used_and_no_raw_split() {
    assert_absent(
        &[
            "StatelessTransportState",
            "into_stateless",
            "dangerously_get_raw_split",
            "fixed_ephemeral_key_for_testing_only",
        ],
        None,
    );
}

#[test]
fn no_unsafe_code_outside_tests() {
    assert_absent(&["unsafe "], None);
    let lib = fs::read_to_string(root().join("src/lib.rs")).unwrap();
    assert!(lib.contains("forbid(unsafe_code)"));
}

#[test]
fn manifest_keeps_the_dependency_rules() {
    let m = fs::read_to_string(root().join("Cargo.toml")).unwrap();
    for banned in [
        "taschenmesser-local-api",
        "tauri",
        "tokio",
        "ring",
        "aes-gcm",
        "p256",
        "serde_json_core",
    ] {
        let deps: Vec<&str> = m
            .lines()
            .filter(|l| l.trim_start().starts_with(banned))
            .collect();
        assert!(deps.is_empty(), "banned dependency: {deps:?}");
    }
    let snow = m
        .lines()
        .find(|l| l.trim_start().starts_with("snow"))
        .expect("snow dependency");
    assert!(
        snow.contains("\"=0."),
        "snow must be pinned exactly: {snow}"
    );
    assert!(snow.contains("default-features = false"), "{snow}");
    for feature in [
        "\"std\"",
        "ring",
        "aes",
        "p256",
        "default-resolver\"",
        "xchacha",
        "hfs",
        "risky-raw-split",
    ] {
        assert!(
            !snow.contains(feature),
            "snow feature `{feature}` must stay off: {snow}"
        );
    }
    for needed in ["use-chacha20poly1305", "use-blake2", "use-curve25519"] {
        assert!(snow.contains(needed), "{needed}");
    }
}

#[test]
fn hub_modules_are_compiled_out_on_mobile() {
    let lib = fs::read_to_string(root().join("src/lib.rs")).unwrap();
    let gate = "#[cfg(not(any(target_os = \"android\", target_os = \"ios\")))]";
    let lines: Vec<&str> = lib.lines().map(str::trim).collect();
    for module in [
        "pairing",
        "trust",
        "endpoint",
        "hub",
        "transport",
        "discovery",
    ] {
        let decl = format!("pub mod {module};");
        let at = lines
            .iter()
            .position(|l| *l == decl)
            .unwrap_or_else(|| panic!("{decl} missing"));
        // the hub parts that need the store also need the `store` feature (devices build without it)
        let with_store =
            "#[cfg(all(not(any(target_os = \"android\", target_os = \"ios\")), feature = \"store\"))]";
        assert!(
            at > 0 && (lines[at - 1] == gate || lines[at - 1] == with_store),
            "{module} must carry the mobile cfg gate"
        );
    }
    // the device side is on every target
    let at = lines
        .iter()
        .position(|l| *l == "pub mod client;")
        .expect("client module");
    assert!(
        !lines[at - 1].starts_with("#[cfg") && !lines[at - 2].starts_with("#[cfg"),
        "the client stays available to devices"
    );
    // remote control: the wire format and the device's client on every target …
    for module in ["pub mod input;", "pub mod input_client;"] {
        let at = lines
            .iter()
            .position(|l| *l == module)
            .unwrap_or_else(|| panic!("{module} missing"));
        assert!(
            !lines[at - 1].starts_with("#[cfg") && !lines[at - 2].starts_with("#[cfg"),
            "{module} stays available to devices"
        );
    }
    // … the hub side of it (switch, grants, gate, limits, sink) on the desktop only
    let input = fs::read_to_string(root().join("src/input/mod.rs")).unwrap();
    let input_lines: Vec<&str> = input.lines().map(str::trim).collect();
    for module in ["limits", "remote", "session", "sink"] {
        let decl = format!("pub mod {module};");
        let at = input_lines
            .iter()
            .position(|l| *l == decl)
            .unwrap_or_else(|| panic!("{decl} missing"));
        assert_eq!(input_lines[at - 1], gate, "input::{module} must be gated");
    }
    let at = input_lines
        .iter()
        .position(|l| *l == "pub mod wire;")
        .expect("wire module");
    assert!(!input_lines[at - 1].starts_with("#[cfg"));
    let at = lines
        .iter()
        .position(|l| *l == "pub mod noise;")
        .expect("noise module");
    assert!(
        lines[at - 1] != gate && !lines[at - 1].starts_with("#[cfg"),
        "noise stays available to clients"
    );
}

#[test]
fn secret_types_have_no_clone_serialize_or_display() {
    let noise = fs::read_to_string(root().join("src/noise/mod.rs")).unwrap();
    for ty in ["StaticKey", "Psk", "Sas", "Transport"] {
        for derive in noise.lines().filter(|l| l.contains("#[derive(")) {
            assert!(!derive.contains("Serialize"), "{derive}");
        }
        assert!(
            !noise.contains(&format!("impl fmt::Display for {ty}")),
            "{ty}"
        );
        assert!(!noise.contains(&format!("impl Clone for {ty}")), "{ty}");
    }
    // the derives that exist are on the public key, the mode and the error enums only
    for (i, line) in noise.lines().enumerate() {
        if line.contains("#[derive(") && line.contains("Clone") {
            let next = noise
                .lines()
                .skip(i + 1)
                .find(|l| l.contains("pub struct") || l.contains("pub enum"))
                .unwrap();
            assert!(
                [
                    "PublicKey",
                    "Mode",
                    "KeyError",
                    "HandshakeDrop",
                    "InitError",
                    "Refusal"
                ]
                .iter()
                .any(|t| next.contains(t)),
                "Clone derived on: {next}"
            );
        }
    }
}

/// "Never on Android" by dependency gating: the mDNS daemon is only listed under the desktop
/// target table, never in the plain `[dependencies]`.
#[test]
fn mdns_is_a_desktop_only_dependency() {
    let m = fs::read_to_string(root().join("Cargo.toml")).unwrap();
    let mut table = String::new();
    for line in m.lines() {
        let t = line.trim();
        if t.starts_with('[') {
            table = t.to_owned();
        } else if t.starts_with("mdns-sd") {
            assert_eq!(
                table,
                "[target.'cfg(not(any(target_os = \"android\", target_os = \"ios\")))'.dependencies]",
                "mdns-sd must be gated"
            );
        }
    }
    assert!(m.contains("mdns-sd"));
}
