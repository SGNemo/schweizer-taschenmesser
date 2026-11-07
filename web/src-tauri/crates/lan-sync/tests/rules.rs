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
            (p.strip_prefix(root()).unwrap().display().to_string(), kept)
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
    for module in ["pairing", "trust", "endpoint", "hub", "transport"] {
        let decl = format!("pub mod {module};");
        let at = lines
            .iter()
            .position(|l| *l == decl)
            .unwrap_or_else(|| panic!("{decl} missing"));
        assert!(
            at > 0 && lines[at - 1] == gate,
            "{module} must carry the mobile cfg gate"
        );
    }
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
