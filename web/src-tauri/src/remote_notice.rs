//! Remote control, PC side: the quiet notice when a device starts to control mouse and keyboard
//! (`docs/rules/remote-control.md`: always visible on the PC). The tray says it for as long as it
//! lasts; this says it once, at the moment it begins.
//!
//! * Only for a session of the full level – never for a media session, whatever the grant.
//! * At most one per device in [`QUIET`]. That is counted in memory only: nothing about who
//!   controlled when is written anywhere, and a restart of the app forgets it.
//! * From Rust, with the device's name and nothing else; the page is not asked and cannot hold it
//!   back. Without a sound: none is set, and a Windows toast without one is silent (the plugin's
//!   own `silent()` is for iOS only).
//! * The tray thread looks every 250 ms. Sessions of several devices between two looks are one
//!   notice, for the latest device; a session that opens in the last moment before the hub stops
//!   is not told (it ends with the hub).
//! * No event goes to the page from here. Should the page ever listen for notification actions
//!   (it does not), the plugin would hand it a clicked notice's text, this one included.
//! * Nothing here logs. A notice the system does not show (notifications switched off in the
//!   system) is not an error; the tray stays the guarantee.

use crate::texts::{self, Lang};
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt as _;

/// No second notice for the same device within this time.
pub const QUIET: Duration = Duration::from_secs(30 * 60);
/// Devices remembered at once; the trust list is far smaller.
const REMEMBERED: usize = 64;

/// Decides when a notice is due. Pure: the count and the time come in as parameters. It starts
/// at zero like the hub's count – the hub listens before anyone looks, and a session that opened
/// in that moment has already moved the count and is told at the first look.
#[derive(Default)]
pub struct Notices {
    /// The count of full sessions last looked at.
    seen: u64,
    /// Whom a notice was shown for, and when (on the clock of [`since_start`]).
    shown: Vec<([u8; 32], Duration)>,
}

impl Notices {
    /// A hub that was stopped and started counts from zero again; what was shown is kept.
    pub fn reset(&mut self) {
        self.seen = 0;
    }

    /// `true` = show a notice for `device` now. Called with the hub's current count of full
    /// sessions and the device of the latest one.
    pub fn due(&mut self, count: u64, device: Option<[u8; 32]>, now: Duration) -> bool {
        if count == self.seen {
            return false;
        }
        self.seen = count;
        let Some(device) = device else {
            return false;
        };
        self.shown.retain(|(_, at)| now.saturating_sub(*at) < QUIET);
        if self.shown.iter().any(|(d, _)| *d == device) {
            return false;
        }
        if self.shown.len() >= REMEMBERED {
            self.shown.remove(0);
        }
        self.shown.push((device, now));
        true
    }
}

/// Time since the first look: a clock that cannot jump (only differences are used).
pub fn since_start() -> Duration {
    static START: OnceLock<Instant> = OnceLock::new();
    START.get_or_init(Instant::now).elapsed()
}

/// Shows the notice. `name` is already plain text (see `remote::shown_name`); `named` = it is
/// the device's own name, not the label of a nameless one.
pub fn show(app: &AppHandle, lang: Lang, name: &str, named: bool) {
    let (title, text) = texts::remote_notice(lang, name, named);
    let _ = app.notification().builder().title(title).body(text).show();
}

#[cfg(test)]
mod tests {
    use super::*;

    const PHONE: [u8; 32] = [1; 32];
    const TABLET: [u8; 32] = [2; 32];
    const fn min(m: u64) -> Duration {
        Duration::from_secs(m * 60)
    }

    #[test]
    fn nothing_is_told_until_the_count_moves() {
        let mut n = Notices::default();
        assert!(!n.due(0, None, min(0)));
        assert!(!n.due(0, None, min(50)));
        assert!(n.due(1, Some(PHONE), min(51)));
        assert!(!n.due(1, Some(PHONE), min(52)), "the same session again");
    }

    #[test]
    fn a_session_that_opened_before_the_first_look_is_told() {
        // the hub listens before the tray thread exists
        let mut n = Notices::default();
        assert!(n.due(1, Some(PHONE), min(0)));
    }

    #[test]
    fn one_notice_per_device_in_thirty_minutes() {
        let mut n = Notices::default();
        assert!(n.due(1, Some(PHONE), min(0)));
        assert!(!n.due(2, Some(PHONE), min(1)));
        assert!(!n.due(3, Some(PHONE), min(29)));
        // another device has its own time
        assert!(n.due(4, Some(TABLET), min(29)));
        // thirty minutes after the notice (not after the last session): told again
        assert!(n.due(5, Some(PHONE), min(30)));
        assert!(!n.due(6, Some(PHONE), min(45)));
        assert!(!n.due(7, Some(TABLET), min(58)));
        assert!(n.due(8, Some(TABLET), min(59)));
    }

    #[test]
    fn several_sessions_between_two_looks_are_one_notice_for_the_latest_device() {
        let mut n = Notices::default();
        assert!(n.due(5, Some(TABLET), min(0)));
        assert!(!n.due(5, Some(TABLET), min(0)));
    }

    #[test]
    fn a_restarted_hub_counts_anew_but_the_quiet_time_holds() {
        let mut n = Notices::default();
        assert!(n.due(1, Some(PHONE), min(0)));
        n.reset();
        assert!(!n.due(0, Some(PHONE), min(1)));
        assert!(!n.due(1, Some(PHONE), min(2)), "still the quiet time");
        assert!(n.due(2, Some(PHONE), min(31)));
    }

    #[test]
    fn what_is_remembered_has_a_bound() {
        let mut n = Notices::default();
        for i in 0..(REMEMBERED as u64 + 10) {
            let mut device = [0u8; 32];
            device[..8].copy_from_slice(&i.to_le_bytes());
            assert!(n.due(i + 1, Some(device), min(0)));
        }
        assert_eq!(n.shown.len(), REMEMBERED);
    }
}
