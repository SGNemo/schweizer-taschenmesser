//! Autostart: what starts with Windows for this account, and switching it on or off the way Task
//! Manager and Windows' settings do it.
//!
//! **Read:** the user's Run key, the two machine Run keys and the user's startup folder.
//! **Switch (the user's own entries only):** one `REG_BINARY` value below
//! `HKCU\…\Explorer\StartupApproved\{Run,StartupFolder}`, named like the entry. The Run value and
//! the shortcut file are never edited or removed, so taking a switch back is always exact: the
//! approval value from before is put in place again (or removed when there was none).
//!
//! Machine-wide entries are shown and never written; there is no code path that could, because
//! the registry seam has no write function for the machine hive.
//!
//! The webview only ever names an entry by its `id`; [`set_enabled`] lists again and looks the id
//! up, so no key or value name comes from outside.

use crate::journal::{ChangeError, Journal, JournalError, Kind, Undo};
use crate::reg::{valid_name, RegError, Registry, Value};
use serde::Serialize;
use std::path::Path;

/// The Run key, relative to its hive (same path below `HKCU` and `HKLM`).
pub const RUN: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
/// Run key of 32-bit programs on 64-bit Windows (machine hive).
pub const RUN_WOW: &str = r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run";
/// Where Windows keeps "this entry is switched off" (same path below `HKCU` and `HKLM`).
pub const APPROVED_RUN: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
pub const APPROVED_RUN32: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run32";
pub const APPROVED_FOLDER: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder";

/// More entries than this are not listed (no real PC comes close).
const MAX_ITEMS: usize = 500;
/// `REG_SZ`.
const TYPE_SZ: u32 = 1;
/// `REG_EXPAND_SZ`.
const TYPE_EXPAND_SZ: u32 = 2;
/// Seconds between 1601-01-01 (FILETIME) and 1970-01-01 (Unix).
const FILETIME_UNIX_OFFSET: i64 = 11_644_473_600;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Scope {
    /// Starts for this account; can be switched here.
    User,
    /// Starts for every account of the PC; shown only.
    Machine,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Source {
    Run,
    Folder,
}

/// One program that starts with Windows.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    /// Stable name of the entry for [`set_enabled`]: `run:<value name>`, `folder:<file name>`,
    /// `machine:<value name>`, `machine32:<value name>`.
    pub id: String,
    /// The entry's name: the Run value's name, or the shortcut's name without its ending.
    pub name: String,
    /// The command line, or the file name in the startup folder. For display only.
    pub command: String,
    /// Best guess at the program: the file name of the executable without its ending.
    pub program: String,
    pub scope: Scope,
    pub source: Source,
    pub enabled: bool,
    /// Can be switched here (the user's own entries).
    pub switchable: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub enum StartupError {
    /// No entry with this id (any more).
    UnknownEntry,
    /// A machine-wide entry: changed in Windows' settings, not here.
    ReadOnly,
    Journal(JournalError),
    Reg(RegError),
}

impl StartupError {
    pub fn code(&self) -> &'static str {
        match self {
            StartupError::UnknownEntry => "unknown-entry",
            StartupError::ReadOnly => "read-only",
            StartupError::Journal(e) => e.code(),
            StartupError::Reg(e) => e.code(),
        }
    }
}

/// Whether an approval value means "starts". Windows' rule: the first byte even = on, odd = off;
/// no value = on. Anything that is not a binary value with at least one byte counts as on, like
/// an entry Windows has never seen in Task Manager.
pub fn approved(value: Option<&Value>) -> bool {
    match value.and_then(Value::as_binary).and_then(|b| b.first()) {
        Some(first) => first % 2 == 0,
        None => true,
    }
}

/// The approval value to write: 12 bytes, `02` + zeros for on, `03` + the time it was switched
/// off (FILETIME in bytes 4..12) for off.
pub fn approval_bytes(enabled: bool, unix_secs: i64) -> [u8; 12] {
    let mut out = [0u8; 12];
    if enabled {
        out[0] = 2;
    } else {
        out[0] = 3;
        let filetime = (unix_secs.saturating_add(FILETIME_UNIX_OFFSET).max(0) as u64)
            .saturating_mul(10_000_000);
        out[4..].copy_from_slice(&filetime.to_le_bytes());
    }
    out
}

/// The text of a Run value (`REG_SZ` or `REG_EXPAND_SZ`); other types are not commands.
fn command_text(value: &Value) -> Option<String> {
    match value {
        Value::Sz(s) => Some(s.clone()),
        // An expandable string, or a plain one that is not stored in the usual form (kept raw
        // by the registry seam so that it can be restored byte for byte).
        Value::Raw { ty, data } if *ty == TYPE_EXPAND_SZ || *ty == TYPE_SZ => {
            let units: Vec<u16> = data
                .chunks_exact(2)
                .map(|c| u16::from_le_bytes([c[0], c[1]]))
                .collect();
            let end = units.iter().position(|&u| u == 0).unwrap_or(units.len());
            Some(String::from_utf16_lossy(&units[..end]))
        }
        _ => None,
    }
}

/// File name without directories and without its ending.
fn file_stem(path: &str) -> &str {
    let file = path.rsplit(['\\', '/']).next().unwrap_or(path);
    match file.rfind('.') {
        Some(dot) if dot > 0 => &file[..dot],
        _ => file,
    }
}

/// Best guess at the program of a command line: the executable's file name without its ending.
/// Handles quoted paths, paths with spaces and arguments; empty when nothing can be told.
pub fn program_name(command: &str) -> String {
    let cmd = command.trim();
    let path = if let Some(rest) = cmd.strip_prefix('"') {
        rest.split('"').next().unwrap_or(rest)
    } else {
        // Unquoted: a path may hold spaces, so cut after the first program ending that is
        // followed by a space or the end; without one, the first word is the program.
        let lower = cmd.to_ascii_lowercase();
        let cut = [".exe", ".com", ".bat", ".cmd", ".lnk", ".msc", ".vbs"]
            .iter()
            .filter_map(|ext| {
                lower
                    .match_indices(ext)
                    .map(|(i, _)| i + ext.len())
                    .find(|&end| {
                        lower[end..]
                            .chars()
                            .next()
                            .map_or(true, |c| c.is_whitespace() || c == ',')
                    })
            })
            .min();
        match cut {
            Some(end) => &cmd[..end],
            None => cmd.split_whitespace().next().unwrap_or(""),
        }
    };
    file_stem(path.trim()).trim().to_string()
}

/// File names in the startup folder, sorted; `desktop.ini` (Explorer's own) and folders are not
/// programs. A missing or unreadable folder is an empty list.
pub fn folder_files(dir: &Path) -> Vec<String> {
    let mut out: Vec<String> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.file_type().map(|t| !t.is_dir()).unwrap_or(false))
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|n| !n.eq_ignore_ascii_case("desktop.ini") && !n.eq_ignore_ascii_case("thumbs.db"))
        .collect();
    out.sort_by_key(|n| n.to_lowercase());
    out.truncate(MAX_ITEMS);
    out
}

/// The state to show for an approval value as read. One that exists but cannot be read is shown
/// as on (display only); [`set_enabled`] reads it again and refuses to change it.
fn shown(read: Result<Option<Value>, RegError>) -> bool {
    approved(read.ok().flatten().as_ref())
}

/// A name an approval value can be filed under so that Windows finds it: one the registry seam
/// accepts and that was read without loss (a name with a broken character comes back with the
/// replacement mark and would never match the real entry).
fn switchable_name(name: &str) -> bool {
    valid_name(name) && !name.contains('\u{FFFD}')
}

/// The approval key of a switchable entry.
fn approval_key(source: Source) -> &'static str {
    match source {
        Source::Run => APPROVED_RUN,
        Source::Folder => APPROVED_FOLDER,
    }
}

/// An entry with the registry value name its approval lives under.
struct Found {
    item: Item,
    value_name: String,
}

fn find_all(reg: &dyn Registry, startup_folder: Option<&Path>) -> Vec<Found> {
    let mut out = Vec::new();

    for (name, value) in reg.list(RUN) {
        let Some(command) = command_text(&value) else {
            continue;
        };
        // The key's unnamed default value is left out on purpose: it has no name to show or
        // to file an approval under.
        if name.is_empty() {
            continue;
        }
        out.push(Found {
            item: Item {
                id: format!("run:{name}"),
                name: name.clone(),
                program: program_name(&command),
                command,
                scope: Scope::User,
                source: Source::Run,
                enabled: shown(reg.get(APPROVED_RUN, &name)),
                switchable: switchable_name(&name),
            },
            value_name: name,
        });
    }

    if let Some(dir) = startup_folder {
        for file in folder_files(dir) {
            let stem = file_stem(&file).to_string();
            out.push(Found {
                item: Item {
                    id: format!("folder:{file}"),
                    name: stem.clone(),
                    program: stem,
                    command: file.clone(),
                    scope: Scope::User,
                    source: Source::Folder,
                    enabled: shown(reg.get(APPROVED_FOLDER, &file)),
                    switchable: switchable_name(&file),
                },
                value_name: file,
            });
        }
    }

    for (prefix, run, approval) in [
        ("machine", RUN, APPROVED_RUN),
        ("machine32", RUN_WOW, APPROVED_RUN32),
    ] {
        for (name, value) in reg.machine_list(run) {
            let Some(command) = command_text(&value) else {
                continue;
            };
            if name.is_empty() {
                continue;
            }
            // Windows keeps the switch of a machine-wide entry in the machine hive.
            let enabled = shown(reg.machine_get(approval, &name));
            out.push(Found {
                item: Item {
                    id: format!("{prefix}:{name}"),
                    name: name.clone(),
                    program: program_name(&command),
                    command,
                    scope: Scope::Machine,
                    source: Source::Run,
                    enabled,
                    switchable: false,
                },
                value_name: name,
            });
        }
    }

    out.truncate(MAX_ITEMS);
    out
}

/// Everything that starts with Windows for this account: the user's entries first, each group by
/// name. `startup_folder` is the user's startup folder (`None`: not looked at).
pub fn list(reg: &dyn Registry, startup_folder: Option<&Path>) -> Vec<Item> {
    let mut items: Vec<Item> = find_all(reg, startup_folder)
        .into_iter()
        .map(|f| f.item)
        .collect();
    items.sort_by_key(|i| (i.scope == Scope::Machine, i.name.to_lowercase()));
    items
}

/// Switches one of the user's entries on or off and notes it in the journal with the approval
/// value from before. Returns the journal entry's id, or `None` when the entry already was in
/// that state (nothing written, nothing noted). Refused with `unreadable`, without a write or a
/// note, when the approval value exists but cannot be read. `at` is now in Unix seconds.
pub fn set_enabled(
    reg: &dyn Registry,
    journal: &mut Journal,
    startup_folder: Option<&Path>,
    id: &str,
    enabled: bool,
    at: i64,
) -> Result<Option<u64>, StartupError> {
    let found = find_all(reg, startup_folder)
        .into_iter()
        .find(|f| f.item.id == id)
        .ok_or(StartupError::UnknownEntry)?;
    if !found.item.switchable {
        return Err(StartupError::ReadOnly);
    }
    let key = approval_key(found.item.source);
    let name = found.value_name.as_str();
    // The value from before is what the way back needs: when it cannot be read exactly, nothing
    // is changed (the listing is for display only and never the source of an undo value).
    let previous = reg.get(key, name).map_err(StartupError::Reg)?;
    if approved(previous.as_ref()) == enabled {
        return Ok(None);
    }
    let value = Value::binary(&approval_bytes(enabled, at));
    journal
        .change(
            at,
            Kind::Startup,
            &found.item.id,
            &found.item.name,
            Some(enabled),
            vec![Undo::Reg {
                key: key.to_string(),
                name: name.to_string(),
                previous,
                written: Some(value.clone()),
            }],
            || reg.set(key, name, &value),
        )
        .map(Some)
        .map_err(|e| match e {
            ChangeError::Journal(j) => StartupError::Journal(j),
            ChangeError::Apply(r) => StartupError::Reg(r),
        })
}

/// The startup folder of the current user (`shell:Startup`).
#[cfg(windows)]
pub fn system_folder() -> Option<std::path::PathBuf> {
    use windows::core::PWSTR;
    use windows::Win32::System::Com::CoTaskMemFree;
    use windows::Win32::UI::Shell::{FOLDERID_Startup, SHGetKnownFolderPath, KF_FLAG_DEFAULT};
    // SAFETY: on success the shell returns a NUL-terminated string that we copy and then free
    // with CoTaskMemFree exactly once.
    unsafe {
        let p: PWSTR = SHGetKnownFolderPath(&FOLDERID_Startup, KF_FLAG_DEFAULT, None).ok()?;
        let s = p.to_string().ok();
        CoTaskMemFree(Some(p.0 as *const _));
        s.map(std::path::PathBuf::from)
    }
}

/// No startup folder on other systems.
#[cfg(not(windows))]
pub fn system_folder() -> Option<std::path::PathBuf> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::journal::apply_undo;
    use crate::reg::MemRegistry;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    static N: AtomicU64 = AtomicU64::new(0);

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "pc-tune-startup-{tag}-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn journal(dir: &Path) -> Journal {
        Journal::open(&dir.join("journal.json")).unwrap().0
    }

    fn got(reg: &MemRegistry, key: &str, name: &str) -> Option<Value> {
        reg.get(key, name).unwrap()
    }

    fn sz(s: &str) -> Value {
        Value::Sz(s.to_string())
    }

    /// 2025-06-15 00:00:00 UTC.
    const AT: i64 = 1_749_945_600;

    fn undo(reg: &MemRegistry, j: &mut Journal, id: u64) {
        let steps = j.undo_steps(id).unwrap();
        apply_undo(reg, &steps, |_, _| Err(RegError::Unsupported)).unwrap();
        j.mark_undone(id).unwrap();
    }

    #[test]
    fn the_first_byte_decides_and_a_missing_or_odd_value_means_on() {
        for (bytes, on) in [
            (&[2u8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0][..], true),
            (&[6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], true),
            (&[3, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8], false),
            (&[7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], false),
            // Short values: the first byte still decides.
            (&[3], false),
            (&[2, 0], true),
            (&[], true),
        ] {
            assert_eq!(approved(Some(&Value::binary(bytes))), on, "{bytes:?}");
        }
        assert!(approved(None));
        // Not a binary value: Windows never wrote this, so it does not switch anything off.
        assert!(approved(Some(&Value::Dword(3))));
        assert!(approved(Some(&sz("3"))));
    }

    #[test]
    fn written_values_look_like_task_managers() {
        assert_eq!(
            approval_bytes(true, AT),
            [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        );
        let off = approval_bytes(false, AT);
        assert_eq!(off[..4], [3, 0, 0, 0]);
        // FILETIME of 2025-06-15 00:00:00 UTC: 100-ns steps since 1601.
        let filetime = u64::from_le_bytes(off[4..].try_into().unwrap());
        assert_eq!(filetime, 133_944_192_000_000_000);
        assert!(!approved(Some(&Value::binary(&off))));
        // Unix 0 is 1601 + the offset, and a time before 1601 does not wrap.
        assert_eq!(
            u64::from_le_bytes(approval_bytes(false, 0)[4..].try_into().unwrap()),
            116_444_736_000_000_000
        );
        assert_eq!(approval_bytes(false, i64::MIN)[4..], [0; 8]);
    }

    #[test]
    fn the_program_is_the_executable_without_path_ending_and_arguments() {
        for (command, program) in [
            (
                r#""C:\Program Files\Spotify\Spotify.exe" --autostart --minimized"#,
                "Spotify",
            ),
            (
                r"C:\Windows\System32\SecurityHealthSystray.exe",
                "SecurityHealthSystray",
            ),
            (r"C:\Program Files\Some App\app.exe /background", "app"),
            (
                r"C:\Users\x\AppData\Local\Microsoft\Teams\Update.exe --processStart Teams.exe",
                "Update",
            ),
            (r#"rundll32.exe "C:\x\y.dll",Entry"#, "rundll32"),
            (r"rundll32 C:\x\y.dll,Entry", "rundll32"),
            (r"%windir%\system32\tool.EXE -s", "tool"),
            ("\"C:/Tools/sync.cmd\"", "sync"),
            ("  notepad  ", "notepad"),
            ("\"unterminated quote.exe", "unterminated quote"),
            ("Ärger Öl.lnk", "Ärger Öl"),
            ("", ""),
            ("   ", ""),
        ] {
            assert_eq!(program_name(command), program, "{command}");
        }
    }

    #[test]
    fn the_startup_folder_lists_files_but_not_desktop_ini_or_folders() {
        let dir = temp_dir("folder");
        for f in [
            "Zeta.lnk",
            "alpha.lnk",
            "desktop.ini",
            "Desktop.INI.bak",
            "tool.exe",
        ] {
            std::fs::write(dir.join(f), b"x").unwrap();
        }
        std::fs::create_dir(dir.join("Ordner")).unwrap();
        assert_eq!(
            folder_files(&dir),
            ["alpha.lnk", "Desktop.INI.bak", "tool.exe", "Zeta.lnk"]
        );
        assert!(folder_files(&dir.join("missing")).is_empty());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    fn seeded(dir: &Path) -> MemRegistry {
        let reg = MemRegistry::new();
        reg.set(RUN, "Spotify", &sz(r#""C:\Apps\Spotify.exe" --autostart"#))
            .unwrap();
        reg.set(RUN, "cloud", &sz(r"C:\Apps\Cloud\cloud.exe /background"))
            .unwrap();
        // Switched off in Task Manager at some point.
        reg.set(
            APPROVED_RUN,
            "cloud",
            &Value::binary(&[3, 0, 0, 0, 9, 9, 9, 9, 9, 9, 9, 1]),
        )
        .unwrap();
        // REG_EXPAND_SZ is a command too; a number is not.
        let expand: Vec<u8> = "%LOCALAPPDATA%\\chat\\chat.exe\0"
            .encode_utf16()
            .flat_map(|u| u.to_le_bytes())
            .collect();
        reg.set(
            RUN,
            "Chat",
            &Value::Raw {
                ty: 2,
                data: expand,
            },
        )
        .unwrap();
        reg.set(RUN, "NotACommand", &Value::Dword(1)).unwrap();
        reg.seed_machine(
            RUN,
            "SecurityHealth",
            sz(r"C:\Windows\System32\SecurityHealthSystray.exe"),
        );
        reg.seed_machine(
            RUN_WOW,
            "Updater",
            sz(r#""C:\Program Files (x86)\U\up.exe" /c"#),
        );
        reg.seed_machine(RUN_WOW, "OldTool", sz(r"C:\old\tool.exe"));
        reg.seed_machine(
            APPROVED_RUN32,
            "Updater",
            Value::binary(&[3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        );
        std::fs::write(dir.join("Notizen.lnk"), b"x").unwrap();
        std::fs::write(dir.join("desktop.ini"), b"x").unwrap();
        reg
    }

    #[test]
    fn the_list_merges_run_keys_folder_and_approval() {
        let dir = temp_dir("list");
        let reg = seeded(&dir);
        // A value of this account under a machine-wide entry's name does not switch that entry:
        // Windows keeps the switch of a machine-wide entry in the machine hive.
        reg.set(
            APPROVED_RUN32,
            "OldTool",
            &Value::binary(&[7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        )
        .unwrap();
        let items = list(&reg, Some(&dir));
        let brief: Vec<(&str, bool, bool)> = items
            .iter()
            .map(|i| (i.id.as_str(), i.enabled, i.switchable))
            .collect();
        assert_eq!(
            brief,
            [
                ("run:Chat", true, true),
                ("run:cloud", false, true),
                ("folder:Notizen.lnk", true, true),
                ("run:Spotify", true, true),
                ("machine32:OldTool", true, false),
                ("machine:SecurityHealth", true, false),
                ("machine32:Updater", false, false),
            ]
        );
        let spotify = items.iter().find(|i| i.id == "run:Spotify").unwrap();
        assert_eq!(spotify.program, "Spotify");
        assert_eq!(spotify.command, r#""C:\Apps\Spotify.exe" --autostart"#);
        assert_eq!((spotify.scope, spotify.source), (Scope::User, Source::Run));
        let chat = items.iter().find(|i| i.id == "run:Chat").unwrap();
        assert_eq!(chat.command, r"%LOCALAPPDATA%\chat\chat.exe");
        let note = items.iter().find(|i| i.id == "folder:Notizen.lnk").unwrap();
        assert_eq!(
            (note.name.as_str(), note.command.as_str()),
            ("Notizen", "Notizen.lnk")
        );
        assert_eq!(note.source, Source::Folder);
        // Without a folder only the registry is read.
        assert_eq!(list(&reg, None).len(), 6);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_wire_format_is_camel_case() {
        let dir = temp_dir("wire");
        let reg = seeded(&dir);
        let items = list(&reg, None);
        let json = serde_json::to_value(items.last().unwrap()).unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "id": "machine32:Updater",
                "name": "Updater",
                "command": "\"C:\\Program Files (x86)\\U\\up.exe\" /c",
                "program": "up",
                "scope": "machine",
                "source": "run",
                "enabled": false,
                "switchable": false,
            })
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn off_on_and_undo_restore_exactly_what_was_there() {
        let dir = temp_dir("toggle");
        let reg = seeded(&dir);
        let mut j = journal(&dir);
        let run_before = reg.list(RUN);

        // Spotify has no approval value: off writes one, undo removes it again.
        let off = set_enabled(&reg, &mut j, Some(&dir), "run:Spotify", false, AT)
            .unwrap()
            .unwrap();
        assert_eq!(
            got(&reg, APPROVED_RUN, "Spotify"),
            Some(Value::binary(&approval_bytes(false, AT)))
        );
        assert!(
            !list(&reg, Some(&dir))
                .iter()
                .find(|i| i.id == "run:Spotify")
                .unwrap()
                .enabled
        );
        let view = &j.views()[0];
        assert_eq!(
            (view.kind, view.subject.as_str()),
            (Kind::Startup, "run:Spotify")
        );
        assert_eq!(
            (view.label.as_str(), view.on, view.can_undo),
            ("Spotify", Some(false), true)
        );

        // On again writes Task Manager's "on" value.
        let on = set_enabled(&reg, &mut j, Some(&dir), "run:Spotify", true, AT + 60)
            .unwrap()
            .unwrap();
        assert_eq!(
            got(&reg, APPROVED_RUN, "Spotify"),
            Some(Value::binary(&[2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
        );
        // Newest first: the older change waits for the newer one.
        assert_eq!(j.undo_steps(off), Err(JournalError::NewerChange));
        undo(&reg, &mut j, on);
        assert_eq!(
            got(&reg, APPROVED_RUN, "Spotify"),
            Some(Value::binary(&approval_bytes(false, AT)))
        );
        undo(&reg, &mut j, off);
        assert_eq!(got(&reg, APPROVED_RUN, "Spotify"), None);

        // "cloud" was off with Task Manager's own bytes: on, then undo, gives those bytes back.
        let before = got(&reg, APPROVED_RUN, "cloud");
        let id = set_enabled(&reg, &mut j, Some(&dir), "run:cloud", true, AT)
            .unwrap()
            .unwrap();
        assert!(
            list(&reg, None)
                .iter()
                .find(|i| i.id == "run:cloud")
                .unwrap()
                .enabled
        );
        undo(&reg, &mut j, id);
        assert_eq!(got(&reg, APPROVED_RUN, "cloud"), before);

        // The Run key itself was never touched.
        assert_eq!(reg.list(RUN), run_before);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_shortcut_in_the_startup_folder_is_switched_by_its_file_name_and_stays_in_place() {
        let dir = temp_dir("shortcut");
        let reg = seeded(&dir);
        let mut j = journal(&dir);
        let id = set_enabled(&reg, &mut j, Some(&dir), "folder:Notizen.lnk", false, AT)
            .unwrap()
            .unwrap();
        assert!(!approved(
            got(&reg, APPROVED_FOLDER, "Notizen.lnk").as_ref()
        ));
        assert!(dir.join("Notizen.lnk").exists());
        undo(&reg, &mut j, id);
        assert_eq!(got(&reg, APPROVED_FOLDER, "Notizen.lnk"), None);
        // Without the folder the entry is unknown.
        assert_eq!(
            set_enabled(&reg, &mut j, None, "folder:Notizen.lnk", false, AT),
            Err(StartupError::UnknownEntry)
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn switching_to_the_state_it_already_has_writes_and_notes_nothing() {
        let dir = temp_dir("same");
        let reg = seeded(&dir);
        let mut j = journal(&dir);
        let before = reg.user_len();
        assert_eq!(
            set_enabled(&reg, &mut j, Some(&dir), "run:Spotify", true, AT),
            Ok(None)
        );
        assert_eq!(
            set_enabled(&reg, &mut j, Some(&dir), "run:cloud", false, AT),
            Ok(None)
        );
        assert_eq!(reg.user_len(), before);
        assert!(j.views().is_empty());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn machine_entries_are_never_written() {
        let dir = temp_dir("machine");
        let reg = seeded(&dir);
        let mut j = journal(&dir);
        let before = reg.user_len();
        for id in [
            "machine:SecurityHealth",
            "machine32:Updater",
            "machine32:OldTool",
        ] {
            for enabled in [false, true] {
                assert_eq!(
                    set_enabled(&reg, &mut j, Some(&dir), id, enabled, AT),
                    Err(StartupError::ReadOnly),
                    "{id}"
                );
            }
        }
        assert_eq!(reg.user_len(), before);
        assert!(j.views().is_empty());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn unknown_ids_are_refused() {
        let dir = temp_dir("unknown");
        let reg = seeded(&dir);
        let mut j = journal(&dir);
        let before = reg.user_len();
        for id in [
            "",
            "Spotify",
            "run:",
            "run:spotify ",
            "run:NotACommand",
            "run:SecurityHealth",
            "folder:desktop.ini",
            r"folder:..\Notizen.lnk",
            r"run:..\..\Policies\x",
            r"Software\Microsoft\Windows\CurrentVersion\Run\Spotify",
        ] {
            assert_eq!(
                set_enabled(&reg, &mut j, Some(&dir), id, false, AT),
                Err(StartupError::UnknownEntry),
                "{id:?}"
            );
        }
        assert_eq!(reg.user_len(), before);
        assert!(j.views().is_empty());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn odd_names_stay_value_names_below_the_approval_key() {
        let dir = temp_dir("odd");
        let reg = MemRegistry::new();
        let mut j = journal(&dir);
        let odd = r"..\..\Policies\System: “Ä” / 100% *?";
        reg.set(RUN, odd, &sz("a.exe")).unwrap();
        let id = format!("run:{odd}");
        set_enabled(&reg, &mut j, None, &id, false, AT)
            .unwrap()
            .unwrap();
        // Exactly one new value, under the fixed key, named like the entry.
        assert_eq!(reg.user_len(), 2);
        assert_eq!(reg.list(APPROVED_RUN).len(), 1);
        assert!(!approved(got(&reg, APPROVED_RUN, odd).as_ref()));
        assert!(!list(&reg, None)[0].enabled);

        // A name the registry seam would refuse is shown, but not offered as a switch.
        assert!(!valid_name(&"x".repeat(300)));
        assert!(!valid_name("a\u{7}b"));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn an_unreadable_approval_value_refuses_the_switch_and_writes_nothing() {
        let dir = temp_dir("unreadable");
        let reg = seeded(&dir);
        let mut j = journal(&dir);
        let before = reg.user_len();
        let cloud = got(&reg, APPROVED_RUN, "cloud");
        reg.fail_reads.store(true, Ordering::Relaxed);
        // The list still shows the entries (display only) ...
        assert!(list(&reg, Some(&dir)).iter().any(|i| i.id == "run:cloud"));
        // ... but no switch goes through, in either direction.
        for (id, enabled) in [
            ("run:Spotify", false),
            ("run:Spotify", true),
            ("run:cloud", true),
            ("run:cloud", false),
            ("folder:Notizen.lnk", false),
        ] {
            assert_eq!(
                set_enabled(&reg, &mut j, Some(&dir), id, enabled, AT),
                Err(StartupError::Reg(RegError::Unreadable)),
                "{id} {enabled}"
            );
        }
        reg.fail_reads.store(false, Ordering::Relaxed);
        assert_eq!(reg.user_len(), before);
        assert_eq!(got(&reg, APPROVED_RUN, "cloud"), cloud);
        assert_eq!(got(&reg, APPROVED_RUN, "Spotify"), None);
        assert!(j.views().is_empty());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_failed_write_leaves_no_journal_entry() {
        let dir = temp_dir("fail");
        let reg = seeded(&dir);
        let mut j = journal(&dir);
        reg.fail_writes.store(true, Ordering::Relaxed);
        assert_eq!(
            set_enabled(&reg, &mut j, Some(&dir), "run:Spotify", false, AT),
            Err(StartupError::Reg(RegError::Failed))
        );
        assert!(j.views().is_empty());
        assert!(j.originals(Kind::Startup).is_empty());
        reg.fail_writes.store(false, Ordering::Relaxed);
        assert_eq!(got(&reg, APPROVED_RUN, "Spotify"), None);
        assert!(
            list(&reg, None)
                .iter()
                .find(|i| i.id == "run:Spotify")
                .unwrap()
                .enabled
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn nothing_is_switched_when_the_journal_cannot_be_saved() {
        let dir = temp_dir("nojournal");
        let reg = seeded(&dir);
        // After opening, the journal's "folder" turns out to be a file: saving fails.
        let mut j = Journal::open(&dir.join("blocker").join("journal.json"))
            .unwrap()
            .0;
        std::fs::write(dir.join("blocker"), b"x").unwrap();
        let before = reg.user_len();
        assert_eq!(
            set_enabled(&reg, &mut j, Some(&dir), "run:Spotify", false, AT),
            Err(StartupError::Journal(JournalError::NotSaved))
        );
        assert_eq!(reg.user_len(), before);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn error_codes_are_short_and_stable() {
        assert_eq!(StartupError::UnknownEntry.code(), "unknown-entry");
        assert_eq!(StartupError::ReadOnly.code(), "read-only");
        assert_eq!(StartupError::Reg(RegError::Failed).code(), "failed");
        assert_eq!(
            StartupError::Journal(JournalError::NotSaved).code(),
            "not-saved"
        );
    }
}
