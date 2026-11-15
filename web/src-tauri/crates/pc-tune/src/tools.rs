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
    /// "Optimise drives" (defragment / TRIM and its schedule).
    OptimizeDrives,
    /// Settings → System → Power.
    PowerSettings,
}

impl Tool {
    pub const ALL: [Tool; 7] = [
        Tool::StorageSettings,
        Tool::DiskCleanup,
        Tool::RecycleBin,
        Tool::StartupApps,
        Tool::SystemProtection,
        Tool::OptimizeDrives,
        Tool::PowerSettings,
    ];

    pub fn code(self) -> &'static str {
        match self {
            Tool::StorageSettings => "storageSettings",
            Tool::DiskCleanup => "diskCleanup",
            Tool::RecycleBin => "recycleBin",
            Tool::StartupApps => "startupApps",
            Tool::SystemProtection => "systemProtection",
            Tool::OptimizeDrives => "optimizeDrives",
            Tool::PowerSettings => "powerSettings",
        }
    }

    pub fn from_code(code: &str) -> Option<Tool> {
        Tool::ALL.into_iter().find(|t| t.code() == code)
    }

    /// Program and fixed arguments. `explorer.exe` resolves `ms-settings:` and `shell:` addresses.
    pub fn command(self) -> (&'static str, &'static [&'static str]) {
        match self {
            Tool::StorageSettings => ("explorer.exe", &["ms-settings:storagesense"]),
            Tool::DiskCleanup => ("cleanmgr.exe", &[]),
            Tool::RecycleBin => ("explorer.exe", &["shell:RecycleBinFolder"]),
            Tool::StartupApps => ("explorer.exe", &["ms-settings:startupapps"]),
            Tool::SystemProtection => ("SystemPropertiesProtection.exe", &[]),
            Tool::OptimizeDrives => ("dfrgui.exe", &[]),
            Tool::PowerSettings => ("explorer.exe", &["ms-settings:powersleep"]),
        }
    }

    /// Opens the tool. Errors on other systems and when Windows cannot start it.
    pub fn open(self) -> std::io::Result<()> {
        #[cfg(windows)]
        {
            let (program, args) = self.command();
            std::process::Command::new(program)
                .args(args)
                .spawn()
                .map(|_| ())
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
            let (program, args) = t.command();
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
