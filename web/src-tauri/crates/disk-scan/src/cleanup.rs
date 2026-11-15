//! Clean-up suggestions ("Aufräumen"): well-known places whose content is safe to remove (temp
//! files, browser caches, crash reports) plus old downloads, each with a rule that picks the
//! entries directly inside the place.
//!
//! Read only, like the rest of this crate: a suggestion is a list of node ids of an ordinary scan
//! tree, and deleting goes through the one existing way (`plan` → block list → recycle bin, see
//! `delete.rs`). Places the block list protects (`C:\Windows\SoftwareDistribution` for update
//! leftovers, `$Recycle.Bin`) are deliberately not here; Windows' own tools handle them.

use crate::scan::ScanOptions;
use crate::tree::{NodeKind, NodeView};
use serde::Serialize;
use std::path::{Path, PathBuf};

/// Kind of clean-up place. `code()` is what the UI maps to its text.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CleanupKind {
    /// The user's temp folder.
    Temp,
    /// A browser's disk cache (one place per profile).
    BrowserCache,
    /// Crash dumps and Windows error reports of the user's programs.
    CrashReports,
    /// Old files in the Downloads folder (the user's own data: never preselected).
    OldDownloads,
}

impl CleanupKind {
    pub fn code(self) -> &'static str {
        match self {
            CleanupKind::Temp => "temp",
            CleanupKind::BrowserCache => "browserCache",
            CleanupKind::CrashReports => "crashReports",
            CleanupKind::OldDownloads => "oldDownloads",
        }
    }

    /// Which entries of the place are suggested, and whether they start ticked.
    pub fn rule(self) -> Rule {
        match self {
            // Windows' own Disk Cleanup also leaves temp files of the last 7 days alone: a
            // running installer or program may still need them.
            CleanupKind::Temp => Rule {
                min_age_days: 7,
                preselect: true,
            },
            CleanupKind::BrowserCache => Rule {
                min_age_days: 0,
                preselect: true,
            },
            CleanupKind::CrashReports => Rule {
                min_age_days: 0,
                preselect: true,
            },
            CleanupKind::OldDownloads => Rule {
                min_age_days: 90,
                preselect: false,
            },
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rule {
    /// Only entries whose newest change is at least this old.
    pub min_age_days: u32,
    /// Whether the UI ticks the entries by default.
    pub preselect: bool,
}

/// One place on this machine that the clean-up scans.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CleanupRoot {
    pub kind: CleanupKind,
    /// Short source name for the UI: the browser (`chrome`, `edge`, `brave`, `firefox`), or empty.
    pub source: &'static str,
    pub path: PathBuf,
    /// Executable names (lower case) that hold the place's files open while they run.
    pub busy_when: &'static [&'static str],
}

/// Most entries one suggestion offers (the delete plan takes at most 5000 node ids).
pub const MAX_CANDIDATES: usize = 5000;

/// Scan options for a clean-up place: every file is its own entry (no "small files" bucket, which
/// could not be deleted). The depth stays the default, so a folder's size counts everything a
/// deletion would remove (the "large" second confirmation depends on it).
pub fn cleanup_scan_options() -> ScanOptions {
    ScanOptions {
        min_file_bytes: 0,
        access_tracked: Some(false),
        ..ScanOptions::default()
    }
}

/// The entries of a place (the direct children of its root, as `Tree::children(root, 1, 0)`
/// returns them) that `rule` suggests, biggest first, at most [`MAX_CANDIDATES`]. `now` is Unix
/// seconds. Aggregates and empty entries are never suggested.
pub fn select(children: &[NodeView], rule: Rule, now: i64) -> Vec<NodeView> {
    let limit = now - i64::from(rule.min_age_days) * 86_400;
    let mut out: Vec<NodeView> = children
        .iter()
        .filter(|n| n.kind != NodeKind::Small)
        .filter(|n| n.bytes > 0 || n.files > 0)
        .filter(|n| rule.min_age_days == 0 || (n.modified > 0 && n.modified <= limit))
        .cloned()
        .collect();
    out.sort_by(|a, b| b.bytes.cmp(&a.bytes).then(a.id.cmp(&b.id)));
    out.truncate(MAX_CANDIDATES);
    out
}

/// Whether one of `busy_when` is among the running programs (full executable paths).
pub fn is_busy(busy_when: &[&str], running: &[String]) -> bool {
    if busy_when.is_empty() {
        return false;
    }
    running.iter().any(|exe| {
        let name = exe
            .rsplit(['\\', '/'])
            .next()
            .unwrap_or("")
            .to_ascii_lowercase();
        busy_when.contains(&name.as_str())
    })
}

/// Browser profile folders below a Chromium "User Data" folder: `Default` and `Profile N`.
pub fn chromium_profiles(user_data: &Path) -> Vec<PathBuf> {
    let Ok(rd) = std::fs::read_dir(user_data) else {
        return Vec::new();
    };
    let mut v: Vec<PathBuf> = rd
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .filter(|e| {
            let n = e.file_name().to_string_lossy().into_owned();
            n == "Default" || n.starts_with("Profile ")
        })
        .map(|e| e.path())
        .collect();
    v.sort();
    v
}

/// A place may be scanned when it is a real folder: not a symlink or junction (which could lead
/// the scan, and then a deletion, into a folder that is not a cache at all).
pub fn is_real_dir(path: &Path) -> bool {
    std::fs::symlink_metadata(path).is_ok_and(|m| m.is_dir() && !m.file_type().is_symlink())
}

/// The clean-up places that exist on this machine.
pub fn cleanup_roots() -> Vec<CleanupRoot> {
    imp::cleanup_roots()
        .into_iter()
        .filter(|r| is_real_dir(&r.path))
        .collect()
}

#[cfg(windows)]
mod imp {
    use super::*;
    use windows::core::{GUID, PWSTR};
    use windows::Win32::System::Com::CoTaskMemFree;
    use windows::Win32::UI::Shell::{
        FOLDERID_Downloads, FOLDERID_LocalAppData, SHGetKnownFolderPath, KF_FLAG_DEFAULT,
    };

    fn known(id: &GUID) -> Option<PathBuf> {
        // SAFETY: on success the shell returns a NUL-terminated string that we copy and then free
        // with CoTaskMemFree exactly once.
        unsafe {
            let p: PWSTR = SHGetKnownFolderPath(id, KF_FLAG_DEFAULT, None).ok()?;
            let s = p.to_string().ok();
            CoTaskMemFree(Some(p.0 as *const _));
            s.map(PathBuf::from)
        }
    }

    pub fn cleanup_roots() -> Vec<CleanupRoot> {
        let mut v = Vec::new();
        if let Some(local) = known(&FOLDERID_LocalAppData) {
            // The user's temp folder at its fixed place, not what `TEMP`/`TMP` say: a variable
            // pointing at a profile or a drive would turn ordinary folders into "temp files".
            v.push(CleanupRoot {
                kind: CleanupKind::Temp,
                source: "",
                path: local.join("Temp"),
                busy_when: &[],
            });
            let chromium: [(&'static str, &str, &'static [&'static str]); 3] = [
                ("chrome", r"Google\Chrome\User Data", &["chrome.exe"]),
                ("edge", r"Microsoft\Edge\User Data", &["msedge.exe"]),
                (
                    "brave",
                    r"BraveSoftware\Brave-Browser\User Data",
                    &["brave.exe"],
                ),
            ];
            for (source, dir, busy_when) in chromium {
                for profile in chromium_profiles(&local.join(dir)) {
                    v.push(CleanupRoot {
                        kind: CleanupKind::BrowserCache,
                        source,
                        path: profile.join("Cache"),
                        busy_when,
                    });
                }
            }
            if let Ok(profiles) = std::fs::read_dir(local.join(r"Mozilla\Firefox\Profiles")) {
                for p in profiles.flatten().filter(|p| is_real_dir(&p.path())) {
                    v.push(CleanupRoot {
                        kind: CleanupKind::BrowserCache,
                        source: "firefox",
                        path: p.path().join("cache2"),
                        busy_when: &["firefox.exe"],
                    });
                }
            }
            for dir in [
                r"CrashDumps",
                r"Microsoft\Windows\WER\ReportArchive",
                r"Microsoft\Windows\WER\ReportQueue",
            ] {
                v.push(CleanupRoot {
                    kind: CleanupKind::CrashReports,
                    source: "",
                    path: local.join(dir),
                    busy_when: &[],
                });
            }
        }
        if let Some(d) = known(&FOLDERID_Downloads) {
            v.push(CleanupRoot {
                kind: CleanupKind::OldDownloads,
                source: "",
                path: d,
                busy_when: &[],
            });
        }
        v
    }
}

#[cfg(not(windows))]
mod imp {
    use super::*;

    /// Linux/macOS: old downloads only. `/tmp` is shared by all users and holds sockets, and
    /// `~/.cache` holds every program's caches: none of the categories describes them truthfully.
    pub fn cleanup_roots() -> Vec<CleanupRoot> {
        let mut v = Vec::new();
        if let Ok(home) = std::env::var("HOME") {
            v.push(CleanupRoot {
                kind: CleanupKind::OldDownloads,
                source: "",
                path: PathBuf::from(home).join("Downloads"),
                busy_when: &[],
            });
        }
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kinds::{FileKind, AGE_COUNT, KIND_COUNT};

    const DAY: i64 = 86_400;
    const NOW: i64 = 1_000 * DAY;

    fn node(id: u32, kind: NodeKind, bytes: u64, age_days: i64) -> NodeView {
        NodeView {
            id,
            parent_id: Some(0),
            name: format!("n{id}"),
            kind,
            bytes,
            logical_bytes: bytes,
            files: u64::from(bytes > 0),
            modified: NOW - age_days * DAY,
            accessed: 0,
            file_kind: FileKind::Other,
            kind_bytes: [0; KIND_COUNT],
            age_bytes: [0; AGE_COUNT],
            child_count: 0,
            pending: false,
            rel_path: String::new(),
        }
    }

    #[test]
    fn temp_keeps_the_last_seven_days() {
        let kids = vec![
            node(1, NodeKind::File, 500, 1),
            node(2, NodeKind::Dir, 900, 8),
            node(3, NodeKind::File, 100, 7),
            node(4, NodeKind::File, 50, 30),
        ];
        let ids: Vec<u32> = select(&kids, CleanupKind::Temp.rule(), NOW)
            .iter()
            .map(|n| n.id)
            .collect();
        assert_eq!(ids, vec![2, 3, 4], "biggest first, the fresh file stays");
    }

    #[test]
    fn caches_take_everything_but_aggregates_and_empty_entries() {
        let kids = vec![
            node(1, NodeKind::File, 10, 0),
            node(2, NodeKind::Small, 400, 50),
            node(3, NodeKind::Dir, 0, 50),
            node(4, NodeKind::Dir, 30, 0),
        ];
        let ids: Vec<u32> = select(&kids, CleanupKind::BrowserCache.rule(), NOW)
            .iter()
            .map(|n| n.id)
            .collect();
        assert_eq!(ids, vec![4, 1]);
    }

    #[test]
    fn unknown_dates_are_never_old() {
        let mut n = node(1, NodeKind::File, 10, 0);
        n.modified = 0;
        assert!(select(&[n], CleanupKind::OldDownloads.rule(), NOW).is_empty());
    }

    #[test]
    fn downloads_are_old_after_ninety_days_and_never_preselected() {
        let rule = CleanupKind::OldDownloads.rule();
        assert!(!rule.preselect);
        let kids = vec![
            node(1, NodeKind::File, 10, 89),
            node(2, NodeKind::File, 10, 91),
        ];
        let ids: Vec<u32> = select(&kids, rule, NOW).iter().map(|n| n.id).collect();
        assert_eq!(ids, vec![2]);
        for k in [
            CleanupKind::Temp,
            CleanupKind::BrowserCache,
            CleanupKind::CrashReports,
        ] {
            assert!(k.rule().preselect, "{k:?}");
        }
    }

    #[test]
    fn the_list_is_capped() {
        let kids: Vec<NodeView> = (1..=(MAX_CANDIDATES as u32 + 10))
            .map(|i| node(i, NodeKind::File, u64::from(i), 1))
            .collect();
        let out = select(&kids, CleanupKind::BrowserCache.rule(), NOW);
        assert_eq!(out.len(), MAX_CANDIDATES);
        assert_eq!(out[0].id, MAX_CANDIDATES as u32 + 10);
    }

    #[test]
    fn busy_matches_the_executable_name_only() {
        let running = vec![
            r"C:\Program Files\Google\Chrome\Application\chrome.exe".to_string(),
            "/usr/bin/firefox-esr".to_string(),
        ];
        assert!(is_busy(&["chrome.exe"], &running));
        assert!(is_busy(
            &["CHROME.EXE".to_ascii_lowercase().as_str()],
            &running
        ));
        assert!(!is_busy(&["firefox.exe"], &running));
        assert!(!is_busy(&["msedge.exe"], &running));
        assert!(!is_busy(&[], &running));
    }

    #[test]
    fn chromium_profiles_are_default_and_numbered_ones() {
        let dir = std::env::temp_dir().join(format!("tm-cleanup-profiles-{}", std::process::id()));
        for n in [
            "Default",
            "Profile 1",
            "Profile 2",
            "System Profile",
            "Crashpad",
        ] {
            std::fs::create_dir_all(dir.join(n)).unwrap();
        }
        std::fs::write(dir.join("Local State"), b"{}").unwrap();
        let names: Vec<String> = chromium_profiles(&dir)
            .iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(names, vec!["Default", "Profile 1", "Profile 2"]);
    }

    #[test]
    fn codes_are_stable() {
        assert_eq!(CleanupKind::Temp.code(), "temp");
        assert_eq!(CleanupKind::BrowserCache.code(), "browserCache");
        assert_eq!(CleanupKind::CrashReports.code(), "crashReports");
        assert_eq!(CleanupKind::OldDownloads.code(), "oldDownloads");
    }

    #[test]
    fn scan_options_keep_every_file_as_an_entry_and_the_full_depth() {
        let o = cleanup_scan_options();
        assert_eq!(o.min_file_bytes, 0);
        assert_eq!(o.max_depth, ScanOptions::default().max_depth);
    }

    #[cfg(unix)]
    #[test]
    fn a_place_that_is_a_link_is_not_scanned() {
        let base = std::env::temp_dir().join(format!("tm-cleanup-link-{}", std::process::id()));
        let real = base.join("real");
        std::fs::create_dir_all(&real).unwrap();
        let link = base.join("Cache");
        std::os::unix::fs::symlink(&real, &link).unwrap();
        let (is_real, is_link, missing) = (
            is_real_dir(&real),
            is_real_dir(&link),
            is_real_dir(&base.join("nothing")),
        );
        let _ = std::fs::remove_dir_all(&base);
        assert!(is_real);
        assert!(!is_link, "a symlinked place must be left out");
        assert!(!missing);
    }
}
