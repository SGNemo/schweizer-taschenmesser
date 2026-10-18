//! "Is the user in a game or a presentation right now?" – one yes/no from the Windows shell's own
//! notification state (`SHQueryUserNotificationState`). No process list, no window titles, no
//! names: the app never learns *what* is running, only that Windows itself holds notifications back.

/// Raw `QUERY_USER_NOTIFICATION_STATE` values that mean "do not disturb with a loud toast":
/// 2 busy (a full-screen app), 3 Direct3D full screen (games), 4 presentation mode. Everything else
/// (not present, accepts notifications, quiet time, a Store app) is the normal case.
pub fn is_busy_state(code: i32) -> bool {
    matches!(code, 2..=4)
}

/// True while Windows reports a full-screen game, presentation or busy state; false everywhere
/// else (other systems, or when the query fails).
pub fn game_active() -> bool {
    imp::state().is_some_and(is_busy_state)
}

#[cfg(windows)]
mod imp {
    use windows::Win32::UI::Shell::SHQueryUserNotificationState;

    pub fn state() -> Option<i32> {
        // SAFETY: no arguments; the call only reads the shell's state.
        unsafe { SHQueryUserNotificationState() }.ok().map(|s| s.0)
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn state() -> Option<i32> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn busy_full_screen_and_presentation_count_as_playing() {
        for code in [2, 3, 4] {
            assert!(is_busy_state(code), "{code}");
        }
    }

    #[test]
    fn the_normal_states_do_not() {
        // not present, accepts notifications, quiet time, app, and values outside the enum
        for code in [0, 1, 5, 6, 7, 8, -1] {
            assert!(!is_busy_state(code), "{code}");
        }
    }

    #[test]
    fn off_windows_it_is_always_false() {
        #[cfg(not(windows))]
        assert!(!game_active());
    }
}
