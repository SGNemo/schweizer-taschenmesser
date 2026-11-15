//! Starting a program of the PC's own list (rule: `docs/rules/remote-control.md`, "Programs").
//!
//! Called by the shell only for a start that passed the hub's gate, with a path the shell looked
//! up in the PC's list at that moment – never a path from the network, and never from a Tauri
//! command. The shell opens the file the normal way (`ShellExecuteW` with the verb `open`), as a
//! double click would: never with arguments, never with a working directory of its own, never
//! elevated on purpose. It runs on a thread of its own, so a slow start (a shortcut to a network
//! drive) never holds the caller; whether Windows then starts it is not waited for.
//!
//! Nothing is logged. Not Windows: nothing happens, the call says `false`.

use std::path::Path;

/// Hands `path` to the shell to open. `false`: not Windows, or no thread for it.
pub fn launch(path: &Path) -> bool {
    imp::launch(path)
}

#[cfg(not(windows))]
mod imp {
    use std::path::Path;

    pub fn launch(_path: &Path) -> bool {
        false
    }
}

#[cfg(windows)]
mod imp {
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;
    use windows::core::{w, PCWSTR};
    use windows::Win32::System::Com::{
        CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
    };
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    pub fn launch(path: &Path) -> bool {
        let wide: Vec<u16> = path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        // a path with a NUL inside would open something else than it names
        if wide[..wide.len() - 1].contains(&0) {
            return false;
        }
        std::thread::Builder::new()
            .name("remote-launch".into())
            .spawn(move || open(&wide))
            .is_ok()
    }

    fn open(wide: &[u16]) {
        // SAFETY: initialises COM for this thread only (the shell may use it for a shortcut);
        // undone below when it succeeded.
        let com = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) };
        // SAFETY: `wide` is a NUL-terminated UTF-16 path that lives for the whole call; no
        // arguments and no directory (both null), no window of ours.
        let _ = unsafe {
            ShellExecuteW(
                None,
                w!("open"),
                PCWSTR(wide.as_ptr()),
                PCWSTR::null(),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            )
        };
        if com.is_ok() {
            // SAFETY: pairs the successful initialisation above, on the same thread.
            unsafe { CoUninitialize() };
        }
    }
}
