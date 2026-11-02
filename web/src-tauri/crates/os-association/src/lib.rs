//! Two small jobs for the optional `magnet:` / `.torrent` association (desktop):
//!
//! 1. [`launch_target`] decides which argument of a start (or of a second start handed to the
//!    running instance) is a magnet link or a `.torrent` file worth forwarding. Everything else is
//!    ignored. The result only pre-fills the add dialog; nothing is started from it.
//! 2. [`plan`] / [`apply`] register or remove the app as a *possible* handler for Windows under the
//!    current user (`HKCU` only, no admin rights). It never takes over an existing default: the
//!    user picks Nemo in Windows' default-apps settings. Removing deletes exactly the keys added.

use std::path::Path;

/// A `.torrent` file larger than this is not forwarded (real ones are a few hundred KB).
pub const MAX_TORRENT_FILE: u64 = 10 * 1024 * 1024;
const MAX_MAGNET: usize = 8192;

/// The first argument (after the program name) that is a magnet link or an existing `.torrent`
/// file within the size limit.
pub fn launch_target(args: &[String]) -> Option<String> {
    args.iter().skip(1).find_map(|a| accept(a))
}

fn accept(arg: &str) -> Option<String> {
    let lower = arg.to_ascii_lowercase();
    if lower.starts_with("magnet:?") {
        return (arg.len() <= MAX_MAGNET && !arg.chars().any(char::is_control))
            .then(|| arg.to_string());
    }
    if lower.ends_with(".torrent") {
        let meta = std::fs::metadata(Path::new(arg)).ok()?;
        return (meta.is_file() && meta.len() <= MAX_TORRENT_FILE).then(|| arg.to_string());
    }
    None
}

/// One registry change under `HKEY_CURRENT_USER`.
#[derive(Debug, PartialEq, Eq, Clone)]
pub enum RegOp {
    /// `name` = `None` sets the key's default value.
    Set {
        key: String,
        name: Option<String>,
        value: String,
    },
    DeleteKey {
        key: String,
    },
}

#[derive(Debug, PartialEq, Eq)]
pub enum PlanError {
    /// `id` must be letters and digits only; `exe` must not contain quotes or control characters.
    Invalid,
}

fn set(key: &str, name: Option<&str>, value: &str) -> RegOp {
    RegOp::Set {
        key: key.to_string(),
        name: name.map(str::to_string),
        value: value.to_string(),
    }
}

/// The registry changes for `enable` (register) or its exact inverse. `id` names this app
/// ("Nemo", "NemoDev"), `exe` is the program that gets the address or file path as `%1`.
pub fn plan(id: &str, exe: &str, enable: bool) -> Result<Vec<RegOp>, PlanError> {
    if id.is_empty()
        || !id.chars().all(|c| c.is_ascii_alphanumeric())
        || exe.is_empty()
        || exe.chars().any(|c| c == '"' || c.is_control())
    {
        return Err(PlanError::Invalid);
    }
    let magnet = format!(r"Software\Classes\{id}.Magnet");
    let torrent = format!(r"Software\Classes\{id}.Torrent");
    let caps = format!(r"Software\{id}\Capabilities");
    if !enable {
        return Ok(vec![
            RegOp::DeleteKey { key: magnet },
            RegOp::DeleteKey { key: torrent },
            RegOp::DeleteKey {
                key: format!(r"Software\{id}"),
            },
            // Only our own value of the shared key, never the key.
            RegOp::DeleteKey {
                key: format!(r"Software\RegisteredApplications\{id}"),
            },
        ]);
    }
    let command = format!("\"{exe}\" \"%1\"");
    Ok(vec![
        set(&magnet, None, "Magnet link"),
        set(&magnet, Some("URL Protocol"), ""),
        set(&format!(r"{magnet}\shell\open\command"), None, &command),
        set(&torrent, None, "Torrent file"),
        set(&format!(r"{torrent}\shell\open\command"), None, &command),
        set(&caps, Some("ApplicationName"), "Nemo"),
        set(
            &caps,
            Some("ApplicationDescription"),
            "Nemo download manager",
        ),
        set(
            &format!(r"{caps}\URLAssociations"),
            Some("magnet"),
            &format!("{id}.Magnet"),
        ),
        set(
            &format!(r"{caps}\FileAssociations"),
            Some(".torrent"),
            &format!("{id}.Torrent"),
        ),
        set(r"Software\RegisteredApplications", Some(id), &caps),
    ])
}

#[derive(Debug, PartialEq, Eq)]
pub enum Error {
    Invalid,
    /// Only Windows has this registration.
    Unsupported,
    Failed,
}

impl From<PlanError> for Error {
    fn from(_: PlanError) -> Self {
        Error::Invalid
    }
}

/// Whether this app is registered (the shared value exists).
pub fn is_registered(id: &str) -> bool {
    imp::is_registered(id)
}

/// Registers (`true`) or removes (`false`) the association for this user.
pub fn apply(id: &str, exe: &str, enable: bool) -> Result<(), Error> {
    let ops = plan(id, exe, enable)?;
    imp::apply(id, &ops)
}

#[cfg(windows)]
mod imp {
    use super::{Error, RegOp};
    use std::process::Command;

    fn reg(args: &[&str]) -> bool {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: no console flash.
        Command::new("reg")
            .args(args)
            .creation_flags(0x0800_0000)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    pub fn is_registered(id: &str) -> bool {
        reg(&["query", r"HKCU\Software\RegisteredApplications", "/v", id])
    }

    pub fn apply(id: &str, ops: &[RegOp]) -> Result<(), Error> {
        for op in ops {
            match op {
                RegOp::Set { key, name, value } => {
                    let full = format!(r"HKCU\{key}");
                    let ok = match name {
                        Some(n) => reg(&["add", &full, "/v", n, "/t", "REG_SZ", "/d", value, "/f"]),
                        None => reg(&["add", &full, "/ve", "/t", "REG_SZ", "/d", value, "/f"]),
                    };
                    if !ok {
                        return Err(Error::Failed);
                    }
                }
                RegOp::DeleteKey { key }
                    if key.starts_with(r"Software\RegisteredApplications\") =>
                {
                    // A value of the shared key (`...\RegisteredApplications\<id>`), not a key.
                    let ok = !is_registered(id)
                        || reg(&[
                            "delete",
                            r"HKCU\Software\RegisteredApplications",
                            "/v",
                            id,
                            "/f",
                        ]);
                    if !ok {
                        return Err(Error::Failed);
                    }
                }
                RegOp::DeleteKey { key } => {
                    // Missing keys are fine: removing twice must not fail.
                    let full = format!(r"HKCU\{key}");
                    if reg(&["query", &full]) && !reg(&["delete", &full, "/f"]) {
                        return Err(Error::Failed);
                    }
                }
            }
        }
        Ok(())
    }
}

#[cfg(not(windows))]
mod imp {
    use super::{Error, RegOp};

    pub fn is_registered(_id: &str) -> bool {
        false
    }

    pub fn apply(_id: &str, _ops: &[RegOp]) -> Result<(), Error> {
        Err(Error::Unsupported)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    fn temp(name: &str, size: usize) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("os-assoc-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(name);
        std::fs::File::create(&path)
            .unwrap()
            .write_all(&vec![0u8; size])
            .unwrap();
        path
    }

    #[test]
    fn forwards_a_magnet_link_and_ignores_everything_else() {
        let magnet = "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=test";
        assert_eq!(
            launch_target(&args(&["nemo.exe", "--autostart", magnet])),
            Some(magnet.to_string())
        );
        assert_eq!(
            launch_target(&args(&["nemo.exe", "MAGNET:?xt=urn:btih:abc"])),
            Some("MAGNET:?xt=urn:btih:abc".to_string())
        );
        for bad in [
            "magnet:",
            "http://example.org/a.torrent",
            "--flag",
            "C:\\x.exe",
        ] {
            assert_eq!(launch_target(&args(&["nemo.exe", bad])), None, "{bad}");
        }
        // The program name itself is never an address.
        assert_eq!(launch_target(&args(&[magnet])), None);
        let long = format!("magnet:?xt={}", "a".repeat(9000));
        assert_eq!(launch_target(&args(&["nemo.exe", &long])), None);
        assert_eq!(launch_target(&args(&["nemo.exe", "magnet:?xt=a\nb"])), None);
    }

    #[test]
    fn forwards_only_existing_small_torrent_files() {
        let ok = temp("beispiel.torrent", 100);
        let big = temp("gross.TORRENT", (MAX_TORRENT_FILE + 1) as usize);
        let p = ok.to_string_lossy().to_string();
        assert_eq!(launch_target(&args(&["nemo.exe", &p])), Some(p));
        assert_eq!(
            launch_target(&args(&["nemo.exe", &big.to_string_lossy()])),
            None
        );
        assert_eq!(launch_target(&args(&["nemo.exe", "fehlt.torrent"])), None);
        let dir = ok.parent().unwrap().join("ordner.torrent");
        std::fs::create_dir_all(&dir).unwrap();
        assert_eq!(
            launch_target(&args(&["nemo.exe", &dir.to_string_lossy()])),
            None
        );
    }

    #[test]
    fn the_plan_adds_only_own_keys_and_never_a_default() {
        let ops = plan("Nemo", r"C:\Apps\Nemo\nemo.exe", true).unwrap();
        for op in &ops {
            match op {
                RegOp::Set { key, .. } => assert!(
                    key.starts_with(r"Software\Classes\Nemo.")
                        || key.starts_with(r"Software\Nemo\")
                        || key == r"Software\RegisteredApplications",
                    "{key}"
                ),
                RegOp::DeleteKey { .. } => panic!("registering must not delete"),
            }
        }
        // No UserChoice, no bare `magnet` / `.torrent` key: another default is never replaced.
        let text = format!("{ops:?}");
        assert!(!text.contains("UserChoice"));
        assert!(!text.contains(r"Classes\\magnet"));
        assert!(text.contains(r#"\"C:\\Apps\\Nemo\\nemo.exe\" \"%1\""#));
    }

    #[test]
    fn removing_deletes_exactly_what_was_added() {
        let add = plan("NemoDev", r"C:\x\nemo.exe", true).unwrap();
        let del = plan("NemoDev", r"C:\x\nemo.exe", false).unwrap();
        let top = |k: &str| k.split('\\').take(3).collect::<Vec<_>>().join("\\");
        for op in &add {
            if let RegOp::Set { key, .. } = op {
                if key == r"Software\RegisteredApplications" {
                    continue;
                }
                assert!(
                    del.iter().any(|d| matches!(d, RegOp::DeleteKey { key: k }
                        if key.starts_with(k.as_str()) || top(key) == *k)),
                    "{key} is not removed"
                );
            }
        }
        assert!(del.iter().all(|d| matches!(d, RegOp::DeleteKey { .. })));
    }

    #[test]
    fn rejects_ids_and_paths_that_could_break_out_of_the_command() {
        for id in ["", "a b", "Nemo\\x", "Nemo\""] {
            assert_eq!(plan(id, "nemo.exe", true), Err(PlanError::Invalid), "{id}");
        }
        for exe in ["", "a\"b.exe", "a\nb.exe"] {
            assert_eq!(plan("Nemo", exe, true), Err(PlanError::Invalid), "{exe}");
        }
    }

    #[cfg(not(windows))]
    #[test]
    fn other_systems_report_unsupported() {
        assert_eq!(apply("Nemo", "nemo", true), Err(Error::Unsupported));
        assert!(!is_registered("Nemo"));
    }
}
