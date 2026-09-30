//! OS facts the block list and the clean-up helpers need: protected folders, running programs,
//! drive kind of a path, and the well-known places that are safe to clean.

use crate::drives::DriveKind;
use crate::guard::{Denied, Guard};
use serde::Serialize;
use std::path::{Path, PathBuf};

/// A place the clean-up helpers offer to scan (all of them inside the user's own data).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Place {
    /// `temp`, `chrome`, `edge`, `firefox`, `downloads`, `cache`.
    pub id: &'static str,
    pub path: String,
}

/// Folders and executables the guard protects on this machine, plus the app's own directories.
pub fn system_guard(app_dirs: &[PathBuf]) -> Guard {
    let mut g = imp::base_guard();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            g.protect_tree(&dir.to_string_lossy(), Denied::OwnApp);
        }
    }
    for d in app_dirs {
        g.protect_tree(&d.to_string_lossy(), Denied::OwnApp);
    }
    g.set_running(&running_programs());
    g
}

/// Full paths of the executables of all running processes (best effort, no admin rights).
pub fn running_programs() -> Vec<String> {
    imp::running_programs()
}

/// What kind of drive `path` is on; `Unknown` when it cannot be told.
pub fn drive_kind_of(path: &Path) -> DriveKind {
    imp::drive_kind_of(path)
}

/// Well-known cache and temp folders that exist on this machine.
pub fn known_places() -> Vec<Place> {
    imp::known_places()
        .into_iter()
        .filter(|p| Path::new(&p.path).is_dir())
        .collect()
}

#[cfg(windows)]
mod imp {
    use super::*;
    use windows::core::{GUID, PCWSTR, PWSTR};
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::Storage::FileSystem::GetDriveTypeW;
    use windows::Win32::System::Com::CoTaskMemFree;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::Shell::{
        FOLDERID_Downloads, FOLDERID_LocalAppData, FOLDERID_LocalAppDataLow, FOLDERID_Profile,
        FOLDERID_ProgramData, FOLDERID_ProgramFiles, FOLDERID_ProgramFilesX86,
        FOLDERID_RoamingAppData, FOLDERID_UserProfiles, FOLDERID_Windows, SHGetKnownFolderPath,
        KF_FLAG_DEFAULT,
    };

    /// Known-folder lookup (the real location, not an environment variable a user could change).
    fn known(id: &GUID) -> Option<String> {
        // SAFETY: on success the shell returns a NUL-terminated string that we copy and then free
        // with CoTaskMemFree exactly once.
        unsafe {
            let p: PWSTR = SHGetKnownFolderPath(id, KF_FLAG_DEFAULT, None).ok()?;
            let s = p.to_string().ok();
            CoTaskMemFree(Some(p.0 as *const _));
            s
        }
    }

    pub fn base_guard() -> Guard {
        let mut g = Guard::new(true, true);
        for id in [
            &FOLDERID_Windows,
            &FOLDERID_ProgramFiles,
            &FOLDERID_ProgramFilesX86,
            &FOLDERID_ProgramData,
        ] {
            if let Some(p) = known(id) {
                g.protect_tree(&p, Denied::SystemFolder);
            }
        }
        for (id, reason) in [
            (&FOLDERID_UserProfiles, Denied::UserProfile),
            (&FOLDERID_Profile, Denied::UserProfile),
            (&FOLDERID_RoamingAppData, Denied::AppData),
            (&FOLDERID_LocalAppData, Denied::AppData),
            (&FOLDERID_LocalAppDataLow, Denied::AppData),
        ] {
            if let Some(p) = known(id) {
                g.protect_exact(&p, reason);
            }
        }
        // `...\AppData` itself (the parent of Roaming/Local), wherever the profile lives.
        if let Some(p) = known(&FOLDERID_RoamingAppData) {
            if let Some(parent) = Path::new(&p).parent() {
                g.protect_exact(&parent.to_string_lossy(), Denied::AppData);
            }
        }
        g
    }

    pub fn running_programs() -> Vec<String> {
        let mut out = Vec::new();
        // SAFETY: standard Toolhelp/OpenProcess usage; every handle is closed, buffers are locals
        // whose lengths are passed along.
        unsafe {
            let Ok(snap) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
                return out;
            };
            let mut entry = PROCESSENTRY32W {
                dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                ..Default::default()
            };
            let mut more = Process32FirstW(snap, &mut entry).is_ok();
            while more {
                if let Ok(h) = OpenProcess(
                    PROCESS_QUERY_LIMITED_INFORMATION,
                    false,
                    entry.th32ProcessID,
                ) {
                    let mut buf = [0u16; 1024];
                    let mut len = buf.len() as u32;
                    if QueryFullProcessImageNameW(
                        h,
                        PROCESS_NAME_FORMAT(0),
                        PWSTR(buf.as_mut_ptr()),
                        &mut len,
                    )
                    .is_ok()
                    {
                        out.push(String::from_utf16_lossy(&buf[..len as usize]));
                    }
                    let _ = CloseHandle(h);
                }
                more = Process32NextW(snap, &mut entry).is_ok();
            }
            let _ = CloseHandle(HANDLE(snap.0));
        }
        out
    }

    pub fn drive_kind_of(path: &Path) -> DriveKind {
        use std::path::Component;
        let Some(Component::Prefix(prefix)) = path.components().next() else {
            return DriveKind::Unknown;
        };
        let mut root: Vec<u16> =
            std::os::windows::ffi::OsStrExt::encode_wide(prefix.as_os_str()).collect();
        root.push(u16::from(b'\\'));
        root.push(0);
        // SAFETY: NUL-terminated wide string.
        match unsafe { GetDriveTypeW(PCWSTR(root.as_ptr())) } {
            3 => DriveKind::Fixed,
            2 => DriveKind::Removable,
            4 => DriveKind::Network,
            6 => DriveKind::Ram,
            _ => DriveKind::Unknown,
        }
    }

    pub fn known_places() -> Vec<Place> {
        let mut v = vec![Place {
            id: "temp",
            path: std::env::temp_dir().to_string_lossy().into_owned(),
        }];
        if let Some(local) = known(&FOLDERID_LocalAppData) {
            let local = PathBuf::from(local);
            v.push(Place {
                id: "chrome",
                path: local
                    .join(r"Google\Chrome\User Data\Default\Cache")
                    .to_string_lossy()
                    .into_owned(),
            });
            v.push(Place {
                id: "edge",
                path: local
                    .join(r"Microsoft\Edge\User Data\Default\Cache")
                    .to_string_lossy()
                    .into_owned(),
            });
            if let Ok(profiles) = std::fs::read_dir(local.join(r"Mozilla\Firefox\Profiles")) {
                for p in profiles.flatten() {
                    v.push(Place {
                        id: "firefox",
                        path: p.path().join("cache2").to_string_lossy().into_owned(),
                    });
                }
            }
        }
        if let Some(d) = known(&FOLDERID_Downloads) {
            v.push(Place {
                id: "downloads",
                path: d,
            });
        }
        v
    }
}

#[cfg(unix)]
mod imp {
    use super::*;

    pub fn base_guard() -> Guard {
        let mut g = Guard::new(false, false);
        for p in [
            "/usr", "/bin", "/sbin", "/lib", "/lib64", "/etc", "/boot", "/proc", "/sys", "/dev",
            "/var", "/opt",
        ] {
            g.protect_tree(p, Denied::SystemFolder);
        }
        if let Ok(home) = std::env::var("HOME") {
            g.protect_exact(&home, Denied::UserProfile);
        }
        g
    }

    pub fn running_programs() -> Vec<String> {
        let Ok(dir) = std::fs::read_dir("/proc") else {
            return Vec::new();
        };
        dir.flatten()
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .bytes()
                    .all(|b| b.is_ascii_digit())
            })
            .filter_map(|e| std::fs::read_link(e.path().join("exe")).ok())
            .map(|p| p.to_string_lossy().into_owned())
            .collect()
    }

    pub fn drive_kind_of(_path: &Path) -> DriveKind {
        DriveKind::Unknown
    }

    pub fn known_places() -> Vec<Place> {
        let mut v = vec![Place {
            id: "temp",
            path: std::env::temp_dir().to_string_lossy().into_owned(),
        }];
        if let Ok(home) = std::env::var("HOME") {
            v.push(Place {
                id: "cache",
                path: format!("{home}/.cache"),
            });
            v.push(Place {
                id: "downloads",
                path: format!("{home}/Downloads"),
            });
        }
        v
    }
}

#[cfg(not(any(windows, unix)))]
mod imp {
    use super::*;
    pub fn base_guard() -> Guard {
        Guard::new(false, false)
    }
    pub fn running_programs() -> Vec<String> {
        Vec::new()
    }
    pub fn drive_kind_of(_path: &Path) -> DriveKind {
        DriveKind::Unknown
    }
    pub fn known_places() -> Vec<Place> {
        Vec::new()
    }
}
