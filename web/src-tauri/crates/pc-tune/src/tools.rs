//! Windows' own tools the page can open (never run with arguments from the webview): the fixed
//! list below is all there is. What they do, including any UAC prompt, is Windows' business.

/// A tool of Windows itself. `code()` is the name the webview sends.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tool {
    /// Settings → System → Storage (Storage Sense, temporary files incl. update leftovers).
    StorageSettings,
    /// The classic Disk Cleanup (`cleanmgr.exe`).
    DiskCleanup,
    /// The recycle bin in Explorer (restore or empty it there).
    RecycleBin,
    /// Settings → Apps → Startup.
    StartupApps,
    /// "System protection" (create a restore point; Windows asks for admin rights itself).
    SystemProtection,
    /// Settings → System → Power.
    PowerSettings,
}

impl Tool {
    pub const ALL: [Tool; 6] = [
        Tool::StorageSettings,
        Tool::DiskCleanup,
        Tool::RecycleBin,
        Tool::StartupApps,
        Tool::SystemProtection,
        Tool::PowerSettings,
    ];

    pub fn code(self) -> &'static str {
        match self {
            Tool::StorageSettings => "storageSettings",
            Tool::DiskCleanup => "diskCleanup",
            Tool::RecycleBin => "recycleBin",
            Tool::StartupApps => "startupApps",
            Tool::SystemProtection => "systemProtection",
            Tool::PowerSettings => "powerSettings",
        }
    }

    pub fn from_code(code: &str) -> Option<Tool> {
        Tool::ALL.into_iter().find(|t| t.code() == code)
    }

    /// Where the program lives, its file name and its fixed arguments. `explorer.exe` (in the
    /// Windows folder) resolves `ms-settings:` and `shell:` addresses; the others are in System32.
    pub fn command(self) -> (Home, &'static str, &'static [&'static str]) {
        match self {
            Tool::StorageSettings => (Home::Windows, "explorer.exe", &["ms-settings:storagesense"]),
            Tool::DiskCleanup => (Home::System32, "cleanmgr.exe", &[]),
            Tool::RecycleBin => (Home::Windows, "explorer.exe", &["shell:RecycleBinFolder"]),
            Tool::StartupApps => (Home::Windows, "explorer.exe", &["ms-settings:startupapps"]),
            Tool::SystemProtection => (Home::System32, "SystemPropertiesProtection.exe", &[]),
            Tool::PowerSettings => (Home::Windows, "explorer.exe", &["ms-settings:powersleep"]),
        }
    }

    /// Opens the tool by its **full path** below the Windows folder (never by bare name: Windows
    /// would look next to the app's own exe first, where anyone could have put a file of that
    /// name), through the shell: a tool that needs administrator rights then shows Windows' own
    /// prompt, the app itself never runs elevated. Errors on other systems and when Windows
    /// cannot start it.
    pub fn open(self) -> std::io::Result<()> {
        #[cfg(windows)]
        {
            let (home, program, args) = self.command();
            let dir = imp::dir_of(home).ok_or_else(|| {
                std::io::Error::new(std::io::ErrorKind::NotFound, "no windows folder")
            })?;
            imp::shell_open(&dir.join(program), args.first().copied())
        }
        #[cfg(not(windows))]
        {
            Err(std::io::Error::new(
                std::io::ErrorKind::Unsupported,
                "windows only",
            ))
        }
    }
}

/// Full path of one of Windows' own programs (`taskmgr.exe` in `System32`, …), asked from Windows.
/// For callers that start such a program themselves: never by bare name, see [`Tool::open`].
/// `program` is a plain file name (no folder parts). `None` on other systems and when Windows does
/// not name the folder.
pub fn system_program(home: Home, program: &str) -> Option<std::path::PathBuf> {
    #[cfg(windows)]
    {
        imp::dir_of(home).map(|dir| dir.join(program))
    }
    #[cfg(not(windows))]
    {
        let _ = (home, program);
        None
    }
}

/// The two folders Windows' own tools live in.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Home {
    /// The Windows folder itself (`C:\Windows`).
    Windows,
    /// `C:\Windows\System32`.
    System32,
}

#[cfg(windows)]
mod imp {
    use super::Home;
    use std::path::PathBuf;
    use windows::core::PCWSTR;
    use windows::Win32::System::SystemInformation::{
        GetSystemDirectoryW, GetSystemWindowsDirectoryW,
    };
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// Starts `program` (a full path) with at most one fixed argument, the way a double click
    /// would. No command line is built from outside text.
    pub fn shell_open(program: &std::path::Path, arg: Option<&str>) -> std::io::Result<()> {
        let file = wide(&program.to_string_lossy());
        let verb = wide("open");
        let arg = arg.map(wide);
        // SAFETY: all strings are NUL-terminated locals that outlive the call; a missing
        // argument is a null pointer, which the API documents as "none".
        let rc = unsafe {
            ShellExecuteW(
                None,
                PCWSTR(verb.as_ptr()),
                PCWSTR(file.as_ptr()),
                arg.as_ref().map_or(PCWSTR::null(), |a| PCWSTR(a.as_ptr())),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            )
        };
        // The API reports success as a value above 32.
        if rc.0 as usize > 32 {
            Ok(())
        } else {
            Err(std::io::Error::other("not started"))
        }
    }

    /// Asked from Windows, not from an environment variable a user or another program could set.
    pub fn dir_of(home: Home) -> Option<PathBuf> {
        let mut buf = [0u16; 512];
        // SAFETY: the buffer is a local slice; the call writes at most its length and returns
        // the number of characters written (0 on failure, more than the length when too small).
        let n = unsafe {
            match home {
                Home::Windows => GetSystemWindowsDirectoryW(Some(&mut buf)),
                Home::System32 => GetSystemDirectoryW(Some(&mut buf)),
            }
        } as usize;
        (n > 0 && n < buf.len()).then(|| PathBuf::from(String::from_utf16_lossy(&buf[..n])))
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use crate::tools::Tool;

        #[test]
        fn the_task_manager_is_found_in_system32() {
            let path = crate::tools::system_program(Home::System32, "taskmgr.exe").expect("folder");
            assert!(path.is_absolute() && path.is_file(), "{}", path.display());
        }

        #[test]
        fn every_tool_exists_at_its_full_path() {
            for t in Tool::ALL {
                let (home, program, _) = t.command();
                let path = dir_of(home).expect("windows folder").join(program);
                assert!(path.is_absolute() && path.is_file(), "{}", path.display());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_round_trip_and_unknown_codes_are_refused() {
        for t in Tool::ALL {
            assert_eq!(Tool::from_code(t.code()), Some(t));
        }
        for bad in ["", "cmd", "explorer.exe", "storageSettings ", "../x"] {
            assert_eq!(Tool::from_code(bad), None, "{bad}");
        }
    }

    #[test]
    fn every_tool_is_a_fixed_windows_program_without_a_shell() {
        for t in Tool::ALL {
            let (home, program, args) = t.command();
            assert_eq!(home == Home::Windows, program == "explorer.exe");
            assert!(program.ends_with(".exe"), "{program}");
            assert!(!program.contains(['\\', '/', ' ']), "{program}");
            for p in ["cmd", "powershell", "pwsh", "wscript", "cscript", "reg"] {
                assert!(!program.to_ascii_lowercase().starts_with(p), "{program}");
            }
            assert!(args.len() <= 1);
            for a in args {
                assert!(
                    a.starts_with("ms-settings:") || a.starts_with("shell:"),
                    "{a}"
                );
            }
        }
    }

    #[cfg(not(windows))]
    #[test]
    fn other_systems_cannot_open_them() {
        assert!(Tool::DiskCleanup.open().is_err());
    }
}
