//! Power: sleep, hibernate, sign out, restart, shut down – and switching the displays off.
//!
//! Called by the shell only when its countdown at the PC has run out (`src/remote_power.rs`), never
//! straight from the network, and never from a Tauri command. API calls only, no simulated input:
//!
//! * shut down and restart ask Windows the normal way (`ExitWindowsEx` **without** `EWX_FORCE`):
//!   a program with unsaved work can still ask, or stop it, exactly as when the person shuts down
//!   by hand. That is why the shutdown privilege is switched on for this process first – the one
//!   privilege these calls need, nothing else;
//! * sign out is `ExitWindowsEx(EWX_LOGOFF)`, likewise never forced;
//! * sleep and hibernate are `SetSuspendState`, never forced;
//! * monitor off posts `SC_MONITORPOWER` to the top-level windows (`PostMessageW`, which does not
//!   wait for any of them) – the one window message of this crate. It carries no key; any touch
//!   at the PC wakes the displays.
//!
//! Nothing is logged. Not Windows: nothing happens, every call says `false`.

/// The power actions this crate can carry out. A fixed list.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PowerAction {
    Sleep,
    Hibernate,
    SignOut,
    Restart,
    ShutDown,
}

/// Asks Windows to do it. `false`: not Windows, or Windows refused at once (a program may still
/// stop a shutdown later – that is not seen here).
pub fn act(action: PowerAction) -> bool {
    imp::act(action)
}

/// Whether this PC can hibernate (switched on in its power settings).
pub fn hibernate_available() -> bool {
    imp::hibernate_available()
}

/// Switches the displays off. Called on the media worker thread (Windows only: elsewhere there is
/// no worker system).
#[cfg(windows)]
pub(crate) fn monitor_off() -> bool {
    imp::monitor_off()
}

#[cfg(not(windows))]
mod imp {
    use super::PowerAction;

    pub fn act(_action: PowerAction) -> bool {
        false
    }

    pub fn hibernate_available() -> bool {
        false
    }
}

#[cfg(windows)]
mod imp {
    use super::PowerAction;
    use windows::Win32::Foundation::{CloseHandle, HANDLE, LPARAM, LUID, WPARAM};
    use windows::Win32::Security::{
        AdjustTokenPrivileges, LookupPrivilegeValueW, LUID_AND_ATTRIBUTES, SE_PRIVILEGE_ENABLED,
        SE_SHUTDOWN_NAME, TOKEN_ADJUST_PRIVILEGES, TOKEN_PRIVILEGES, TOKEN_QUERY,
    };
    use windows::Win32::System::Power::{IsPwrHibernateAllowed, SetSuspendState};
    use windows::Win32::System::Shutdown::{
        ExitWindowsEx, EWX_LOGOFF, EWX_POWEROFF, EWX_REBOOT, EWX_SHUTDOWN,
        SHTDN_REASON_FLAG_PLANNED, SHTDN_REASON_MAJOR_OTHER,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
    use windows::Win32::UI::WindowsAndMessaging::{
        PostMessageW, HWND_BROADCAST, SC_MONITORPOWER, WM_SYSCOMMAND,
    };

    /// `SC_MONITORPOWER`'s argument for "off".
    const MONITOR_OFF: isize = 2;

    pub fn act(action: PowerAction) -> bool {
        let reason = SHTDN_REASON_MAJOR_OTHER | SHTDN_REASON_FLAG_PLANNED;
        match action {
            // SAFETY: plain calls without pointers; "force" and "no wake events" are both off.
            PowerAction::Sleep => unsafe { SetSuspendState(false, false, false) },
            // SAFETY: as above.
            PowerAction::Hibernate => unsafe { SetSuspendState(true, false, false) },
            // SAFETY: a plain call; never `EWX_FORCE`, so programs with unsaved work still ask.
            PowerAction::SignOut => unsafe { ExitWindowsEx(EWX_LOGOFF, reason) }.is_ok(),
            PowerAction::Restart => {
                // SAFETY: as above, after the shutdown privilege of this process was switched on.
                shutdown_privilege() && unsafe { ExitWindowsEx(EWX_REBOOT, reason) }.is_ok()
            }
            PowerAction::ShutDown => {
                // SAFETY: as above.
                shutdown_privilege()
                    && unsafe { ExitWindowsEx(EWX_SHUTDOWN | EWX_POWEROFF, reason) }.is_ok()
            }
        }
    }

    pub fn hibernate_available() -> bool {
        // SAFETY: takes no arguments, only reads the power settings.
        unsafe { IsPwrHibernateAllowed() }
    }

    pub fn monitor_off() -> bool {
        // SAFETY: posts one system command with integer arguments; it does not wait for any
        // window, so a hung program cannot hold the caller.
        unsafe {
            PostMessageW(
                Some(HWND_BROADCAST),
                WM_SYSCOMMAND,
                WPARAM(SC_MONITORPOWER as usize),
                LPARAM(MONITOR_OFF),
            )
        }
        .is_ok()
    }

    /// Switches on the one privilege shut down and restart need, for this process only.
    fn shutdown_privilege() -> bool {
        let mut token = HANDLE::default();
        // SAFETY: opens this process's own token for adjusting; the handle is closed below.
        if unsafe {
            OpenProcessToken(
                GetCurrentProcess(),
                TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY,
                &mut token,
            )
        }
        .is_err()
        {
            return false;
        }
        let mut luid = LUID::default();
        // SAFETY: looks up a constant privilege name into a local value.
        let found = unsafe { LookupPrivilegeValueW(None, SE_SHUTDOWN_NAME, &mut luid) }.is_ok();
        let privileges = TOKEN_PRIVILEGES {
            PrivilegeCount: 1,
            Privileges: [LUID_AND_ATTRIBUTES {
                Luid: luid,
                Attributes: SE_PRIVILEGE_ENABLED,
            }],
        };
        // SAFETY: the token is open for adjusting; the new state is a local value of the size
        // given; no previous state is asked for.
        let adjusted = found
            && unsafe { AdjustTokenPrivileges(token, false, Some(&privileges), 0, None, None) }
                .is_ok();
        // SAFETY: closes the token opened above, once.
        let _ = unsafe { CloseHandle(token) };
        adjusted
    }
}
