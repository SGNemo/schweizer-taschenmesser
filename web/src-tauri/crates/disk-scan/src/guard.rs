//! The block list: paths that must never be offered for deletion, checked in Rust before a plan
//! is made and again right before anything is touched (the UI check is only a convenience).
//!
//! Paths are compared as *text segments*, not with `std::path`, so the rules behave the same on
//! every OS and are unit-testable with Windows-looking paths. Real paths go through
//! `fs::canonicalize` first: that resolves `..`, symlinks, junctions and 8.3 short names, so a
//! protected folder cannot be reached through an alias.

use std::path::{Path, PathBuf};

/// Why an entry may not be deleted. `code()` is what the UI maps to a German text.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Denied {
    /// The path is gone or cannot be resolved (also: it was swapped after the scan).
    Missing,
    DriveRoot,
    SystemFolder,
    UserProfile,
    AppData,
    SystemFile,
    /// The app's own folder or data.
    OwnApp,
    /// A folder or file of a program that is running right now.
    RunningProgram,
    /// The root of the scan itself.
    ScanRoot,
    /// An aggregate ("smaller files") or unknown node: there is no path to delete.
    NotAnEntry,
}

impl Denied {
    pub fn code(self) -> &'static str {
        match self {
            Denied::Missing => "missing",
            Denied::DriveRoot => "drive-root",
            Denied::SystemFolder => "system-folder",
            Denied::UserProfile => "user-profile",
            Denied::AppData => "app-data",
            Denied::SystemFile => "system-file",
            Denied::OwnApp => "own-app",
            Denied::RunningProgram => "running-program",
            Denied::ScanRoot => "scan-root",
            Denied::NotAnEntry => "not-an-entry",
        }
    }
}

/// A path split into a prefix (`c:`, `\\server\share`, or empty on Unix) and its segments, with
/// `.`/`..` resolved and (optionally) lower-cased.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Norm {
    prefix: String,
    segs: Vec<String>,
}

impl Norm {
    pub fn parse(raw: &str, case_insensitive: bool) -> Norm {
        let mut s = raw.to_string();
        // `\\?\C:\x` and `\\.\C:\x` are the same as `C:\x`; `\\?\UNC\srv\share` is `\\srv\share`.
        if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
            s = format!(r"\\{rest}");
        } else if let Some(rest) = s.strip_prefix(r"\\?\").or_else(|| s.strip_prefix(r"\\.\")) {
            s = rest.to_string();
        }
        if case_insensitive {
            s = s.to_lowercase();
        }
        let b = s.as_bytes();
        let (prefix, rest) = if b.len() >= 2 && b[1] == b':' && b[0].is_ascii_alphabetic() {
            (s[..2].to_string(), &s[2..])
        } else if s.starts_with(r"\\") || s.starts_with("//") {
            let mut it = s[2..].splitn(3, ['\\', '/']);
            let server = it.next().unwrap_or("");
            let share = it.next().unwrap_or("");
            let rest = it.next().unwrap_or("");
            (format!(r"\\{server}\{share}"), rest)
        } else {
            (String::new(), &s[..])
        };
        let mut segs: Vec<String> = Vec::new();
        for part in rest.split(['\\', '/']) {
            match part {
                "" | "." => {}
                ".." => {
                    segs.pop();
                }
                p => segs.push(p.to_string()),
            }
        }
        Norm { prefix, segs }
    }

    /// `self` is `other` or lies inside it.
    pub fn starts_with_norm(&self, other: &Norm) -> bool {
        self.within(other)
    }

    fn is_root(&self) -> bool {
        self.segs.is_empty()
    }

    /// `self` is `other` or lies inside it.
    fn within(&self, other: &Norm) -> bool {
        self.prefix == other.prefix && self.segs.starts_with(&other.segs)
    }
}

struct Protect {
    norm: Norm,
    /// A whole tree (everything inside is protected) or only the folder itself.
    tree: bool,
    reason: Denied,
}

pub struct Guard {
    case_insensitive: bool,
    windows_rules: bool,
    protects: Vec<Protect>,
    running: Vec<Norm>,
}

const SYSTEM_TREES: &[&str] = &[
    "windows",
    "program files",
    "program files (x86)",
    "programdata",
    "system volume information",
    "$recycle.bin",
];
const SYSTEM_FILES: &[&str] = &["pagefile.sys", "hiberfil.sys", "swapfile.sys"];

impl Guard {
    /// `windows_rules` adds the name-based Windows rules on every drive (`X:\Windows`, `X:\Users`,
    /// `X:\pagefile.sys` …); the paths handed to `protect_*` come on top.
    pub fn new(case_insensitive: bool, windows_rules: bool) -> Guard {
        Guard {
            case_insensitive,
            windows_rules,
            protects: Vec::new(),
            running: Vec::new(),
        }
    }

    fn norm(&self, p: &str) -> Norm {
        Norm::parse(p, self.case_insensitive)
    }

    /// Protects a folder and everything in it (and every folder above it).
    pub fn protect_tree(&mut self, path: &str, reason: Denied) {
        let norm = self.norm(path);
        self.protects.push(Protect {
            norm,
            tree: true,
            reason,
        });
    }

    /// Protects only this folder itself (and every folder above it), not its contents.
    pub fn protect_exact(&mut self, path: &str, reason: Denied) {
        let norm = self.norm(path);
        self.protects.push(Protect {
            norm,
            tree: false,
            reason,
        });
    }

    /// Executable files of running programs (refresh right before every check that matters).
    pub fn set_running(&mut self, exes: &[String]) {
        self.running = exes.iter().map(|e| self.norm(e)).collect();
    }

    /// Decides for an already normalised path.
    pub fn check_norm(&self, n: &Norm) -> Result<(), Denied> {
        if n.is_root() {
            return Err(Denied::DriveRoot);
        }
        if self.windows_rules && !n.prefix.is_empty() {
            let first = n.segs[0].as_str();
            if SYSTEM_TREES.contains(&first) {
                return Err(Denied::SystemFolder);
            }
            if n.segs.len() == 1
                && (SYSTEM_FILES.contains(&first) || first.starts_with("dumpstack.log"))
            {
                return Err(Denied::SystemFile);
            }
            if first == "users" {
                // `Users` itself, every profile root, and `AppData` with its three roots.
                if n.segs.len() <= 2 {
                    return Err(Denied::UserProfile);
                }
                if n.segs[2] == "appdata" && n.segs.len() <= 4 {
                    return Err(Denied::AppData);
                }
            }
        }
        for p in &self.protects {
            let hit = if p.tree {
                n.within(&p.norm) || p.norm.within(n)
            } else {
                n.prefix == p.norm.prefix && p.norm.within(n)
            };
            if hit {
                return Err(p.reason);
            }
        }
        // A running program's file, or any folder that contains one.
        if self.running.iter().any(|exe| exe.within(n)) {
            return Err(Denied::RunningProgram);
        }
        Ok(())
    }

    /// Text-only check (tests, and paths that no longer exist).
    pub fn check_str(&self, path: &str) -> Result<(), Denied> {
        self.check_norm(&self.norm(path))
    }

    /// Real check: resolves the path first (`..`, symlinks, junctions, 8.3 names), then applies
    /// the rules to the *resolved* location. Returns the resolved path to delete.
    pub fn check_path(&self, path: &Path) -> Result<PathBuf, Denied> {
        let resolved = std::fs::canonicalize(path).map_err(|_| Denied::Missing)?;
        self.check_norm(&self.norm(&resolved.to_string_lossy()))?;
        Ok(resolved)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn win() -> Guard {
        let mut g = Guard::new(true, true);
        g.protect_tree(r"C:\Program Files\Taschenmesser", Denied::OwnApp);
        g.protect_tree(
            r"C:\Users\Alice\AppData\Roaming\io.github.sgnemo.taschenmesser",
            Denied::OwnApp,
        );
        g.set_running(&[r"D:\Tools\Editor\editor.exe".to_string()]);
        g
    }

    #[test]
    fn drive_roots_are_blocked() {
        let g = win();
        for p in [r"C:\", "c:", r"D:\", r"\\?\C:\", r"\\server\share", "/"] {
            assert_eq!(g.check_str(p), Err(Denied::DriveRoot), "{p}");
        }
    }

    #[test]
    fn system_folders_are_blocked_with_their_contents() {
        let g = win();
        for p in [
            r"C:\Windows",
            r"C:\Windows\System32\drivers",
            r"C:\Program Files",
            r"C:\Program Files\Something\bin",
            r"C:\Program Files (x86)\Old",
            r"C:\ProgramData",
            r"C:\ProgramData\Vendor\cache",
            r"C:\System Volume Information",
            r"C:\$Recycle.Bin\S-1-5-21",
            r"D:\Windows",
        ] {
            assert_eq!(g.check_str(p), Err(Denied::SystemFolder), "{p}");
        }
    }

    #[test]
    fn paging_and_hibernation_files_are_blocked_on_a_drive_root() {
        let g = win();
        for p in [
            r"C:\pagefile.sys",
            r"C:\hiberfil.sys",
            r"C:\swapfile.sys",
            r"C:\DumpStack.log.tmp",
        ] {
            assert_eq!(g.check_str(p), Err(Denied::SystemFile), "{p}");
        }
        // The same names deeper down are ordinary files.
        assert_eq!(g.check_str(r"C:\Daten\pagefile.sys"), Ok(()));
    }

    #[test]
    fn users_profiles_and_appdata_roots_are_blocked_but_their_contents_are_not() {
        let g = win();
        assert_eq!(g.check_str(r"C:\Users"), Err(Denied::UserProfile));
        assert_eq!(g.check_str(r"C:\Users\Alice"), Err(Denied::UserProfile));
        assert_eq!(g.check_str(r"C:\Users\Bob"), Err(Denied::UserProfile));
        assert_eq!(g.check_str(r"C:\Users\Alice\AppData"), Err(Denied::AppData));
        assert_eq!(
            g.check_str(r"C:\Users\Alice\AppData\Local"),
            Err(Denied::AppData)
        );
        assert_eq!(
            g.check_str(r"C:\Users\Alice\AppData\Roaming"),
            Err(Denied::AppData)
        );
        assert_eq!(
            g.check_str(r"C:\Users\Alice\AppData\LocalLow"),
            Err(Denied::AppData)
        );
        // Clean-up targets below them stay possible.
        assert_eq!(
            g.check_str(r"C:\Users\Alice\AppData\Local\Temp\old"),
            Ok(())
        );
        assert_eq!(g.check_str(r"C:\Users\Alice\Downloads\setup.exe"), Ok(()));
        assert_eq!(g.check_str(r"C:\Users\Alice\Documents"), Ok(()));
    }

    #[test]
    fn dot_dot_and_case_and_verbatim_prefixes_do_not_get_around_it() {
        let g = win();
        for p in [
            r"C:\Users\Alice\Downloads\..\..\..\Windows",
            r"c:\WINDOWS\system32",
            r"C:\wInDoWs",
            r"\\?\C:\Windows",
            r"\\?\c:\PROGRAM FILES",
            r"C:/Windows/System32",
            r"C:\Temp\..\Windows\.\System32",
            r"C:\Users\Alice\..",
        ] {
            assert!(g.check_str(p).is_err(), "{p} must be blocked");
        }
        assert_eq!(g.check_str(r"C:\Temp\..\Daten"), Ok(()));
    }

    #[test]
    fn unc_paths_keep_their_share_as_prefix() {
        let g = win();
        assert_eq!(
            g.check_str(r"\\srv\share\Windows"),
            Err(Denied::SystemFolder)
        );
        assert_eq!(g.check_str(r"\\?\UNC\srv\share\Daten\x"), Ok(()));
        assert_eq!(g.check_str(r"\\srv\share"), Err(Denied::DriveRoot));
    }

    #[test]
    fn own_app_folders_and_everything_above_them_are_blocked() {
        let g = win();
        assert_eq!(
            g.check_str(r"C:\Program Files\Taschenmesser\app.exe"),
            Err(Denied::SystemFolder)
        );
        let mut g = Guard::new(true, true);
        g.protect_tree(r"D:\Tools\Taschenmesser", Denied::OwnApp);
        assert_eq!(g.check_str(r"D:\Tools\Taschenmesser"), Err(Denied::OwnApp));
        assert_eq!(
            g.check_str(r"D:\Tools\Taschenmesser\data\x.db"),
            Err(Denied::OwnApp)
        );
        // Deleting the parent would take the app with it.
        assert_eq!(g.check_str(r"D:\Tools"), Err(Denied::OwnApp));
        assert_eq!(g.check_str(r"D:\Tools\Anderes"), Ok(()));
        assert_eq!(
            g.check_str(r"C:\Users\Alice\AppData\Roaming\io.github.sgnemo.taschenmesser\backups"),
            Ok(()),
            "not protected in this guard"
        );
    }

    #[test]
    fn app_data_of_the_app_is_blocked() {
        let g = win();
        assert_eq!(
            g.check_str(r"C:\Users\Alice\AppData\Roaming\io.github.sgnemo.taschenmesser"),
            Err(Denied::OwnApp)
        );
        assert_eq!(
            g.check_str(r"C:\Users\Alice\AppData\Roaming\IO.GITHUB.SGNEMO.TASCHENMESSER\backups"),
            Err(Denied::OwnApp)
        );
    }

    #[test]
    fn running_programs_and_their_folders_are_blocked() {
        let g = win();
        assert_eq!(
            g.check_str(r"D:\Tools\Editor\editor.exe"),
            Err(Denied::RunningProgram)
        );
        assert_eq!(g.check_str(r"D:\Tools\Editor"), Err(Denied::RunningProgram));
        assert_eq!(g.check_str(r"D:\Tools"), Err(Denied::RunningProgram));
        assert_eq!(g.check_str(r"D:\Tools\Editor\config.ini"), Ok(()));
        assert_eq!(g.check_str(r"D:\Tools\Other"), Ok(()));
    }

    #[test]
    fn ordinary_data_is_allowed() {
        let g = win();
        for p in [
            r"D:\Videos\Urlaub",
            r"C:\Temp\cache",
            r"E:\Backup\old.zip",
            r"C:\Users\Alice\Videos",
        ] {
            assert_eq!(g.check_str(p), Ok(()), "{p}");
        }
    }

    #[test]
    fn unix_rules_are_case_sensitive_and_have_no_windows_names() {
        let mut g = Guard::new(false, false);
        g.protect_tree("/usr", Denied::SystemFolder);
        g.protect_exact("/home/alice", Denied::UserProfile);
        assert_eq!(g.check_str("/"), Err(Denied::DriveRoot));
        assert_eq!(g.check_str("/usr/lib"), Err(Denied::SystemFolder));
        assert_eq!(g.check_str("/home/alice"), Err(Denied::UserProfile));
        assert_eq!(g.check_str("/home"), Err(Denied::UserProfile));
        assert_eq!(g.check_str("/home/alice/Downloads"), Ok(()));
        assert_eq!(g.check_str("/mnt/Windows"), Ok(()));
        assert_eq!(g.check_str("/USR/lib"), Ok(()));
    }

    #[test]
    fn codes_are_stable() {
        assert_eq!(Denied::DriveRoot.code(), "drive-root");
        assert_eq!(Denied::RunningProgram.code(), "running-program");
    }
}
