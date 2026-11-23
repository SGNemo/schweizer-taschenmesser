//! The native yes/no question for anything that gives a device more (remote-control grants, the
//! master switch, device exchange, pairing). F1 (launch review 2026-11): one stray key never
//! allows anything, and only the exact "allow" button counts – Escape, closing the window or any
//! other result is a no.
//!
//! * Windows (where the hub, remote control and exchange ask): `rfd` directly, buttons
//!   [cancel, allow]. The first custom button is the TaskDialog's default (Enter = cancel); Escape
//!   and the close button give `Cancel`; only `Custom(allow)` allows.
//! * Elsewhere: tauri-plugin-dialog with [allow, cancel]. The plugin turns every `Cancel` (Escape,
//!   close) into `Custom(<second label>)`, so the second slot must be cancel; the OS picks the
//!   default button there.

use tauri::{AppHandle, Manager as _};

/// Asks at the PC and waits. Runs on a command thread, never the main thread; the page cannot
/// answer it. `warning`: the serious icon.
pub fn ask(
    app: &AppHandle,
    title: &str,
    text: String,
    warning: bool,
    allow: &str,
    cancel: &str,
) -> bool {
    #[cfg(windows)]
    {
        use rfd::{MessageDialog, MessageLevel};
        let mut dialog = MessageDialog::new()
            .set_title(title)
            .set_description(text)
            .set_level(if warning {
                MessageLevel::Warning
            } else {
                MessageLevel::Info
            })
            .set_buttons(windows_buttons(allow, cancel));
        if let Some(window) = app.get_webview_window("main") {
            dialog = dialog.set_parent(&window);
        }
        windows_allowed(&dialog.show(), allow)
    }
    #[cfg(not(windows))]
    {
        use tauri_plugin_dialog::{DialogExt as _, MessageDialogKind};
        let kind = if warning {
            MessageDialogKind::Warning
        } else {
            MessageDialogKind::Info
        };
        let mut dialog = app
            .dialog()
            .message(text)
            .title(title)
            .kind(kind)
            .buttons(plugin_buttons(allow, cancel));
        if let Some(window) = app.get_webview_window("main") {
            dialog = dialog.parent(&window);
        }
        plugin_allowed(&dialog.blocking_show_with_result(), allow)
    }
}

/// Windows: cancel first, so it is the default button.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn windows_buttons(allow: &str, cancel: &str) -> rfd::MessageButtons {
    rfd::MessageButtons::OkCancelCustom(cancel.into(), allow.into())
}

#[cfg_attr(not(windows), allow(dead_code))]
pub fn windows_allowed(result: &rfd::MessageDialogResult, allow: &str) -> bool {
    matches!(result, rfd::MessageDialogResult::Custom(answer) if answer == allow)
}

/// The plugin: allow first – its `Cancel` mapping lands on the second label.
#[cfg_attr(windows, allow(dead_code))]
pub fn plugin_buttons(allow: &str, cancel: &str) -> tauri_plugin_dialog::MessageDialogButtons {
    tauri_plugin_dialog::MessageDialogButtons::OkCancelCustom(allow.into(), cancel.into())
}

#[cfg_attr(windows, allow(dead_code))]
pub fn plugin_allowed(result: &tauri_plugin_dialog::MessageDialogResult, allow: &str) -> bool {
    matches!(result, tauri_plugin_dialog::MessageDialogResult::Custom(answer) if answer == allow)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri_plugin_dialog::{MessageDialogButtons, MessageDialogResult};

    const ALLOW: &str = "Erlauben";
    const CANCEL: &str = "Abbrechen";

    #[test]
    fn windows_cancel_is_the_default_and_escape_is_a_no() {
        let rfd::MessageButtons::OkCancelCustom(first, second) = windows_buttons(ALLOW, CANCEL)
        else {
            panic!("two custom buttons")
        };
        assert_eq!((first.as_str(), second.as_str()), (CANCEL, ALLOW));
        assert!(windows_allowed(
            &rfd::MessageDialogResult::Custom(ALLOW.into()),
            ALLOW
        ));
        for no in [
            rfd::MessageDialogResult::Custom(CANCEL.into()), // Enter: the default button
            rfd::MessageDialogResult::Cancel,                // Escape, close, a failed dialog
            rfd::MessageDialogResult::Ok,
            rfd::MessageDialogResult::Yes,
            rfd::MessageDialogResult::No,
        ] {
            assert!(!windows_allowed(&no, ALLOW), "{no:?}");
        }
    }

    /// What tauri-plugin-dialog 2.8 does with rfd's result (`desktop.rs`, `show_message_dialog`).
    fn plugin_maps(
        result: rfd::MessageDialogResult,
        buttons: &MessageDialogButtons,
    ) -> MessageDialogResult {
        match (result, buttons) {
            (rfd::MessageDialogResult::Ok, MessageDialogButtons::OkCancelCustom(ok, _)) => {
                MessageDialogResult::Custom(ok.clone())
            }
            (rfd::MessageDialogResult::Cancel, MessageDialogButtons::OkCancelCustom(_, cancel)) => {
                MessageDialogResult::Custom(cancel.clone())
            }
            (other, _) => other.into(),
        }
    }

    #[test]
    fn with_the_plugin_escape_and_closing_are_a_no() {
        let buttons = plugin_buttons(ALLOW, CANCEL);
        let escape = plugin_maps(rfd::MessageDialogResult::Cancel, &buttons);
        assert!(!plugin_allowed(&escape, ALLOW), "Escape/close: {escape:?}");
        let ok = plugin_maps(rfd::MessageDialogResult::Ok, &buttons);
        assert!(plugin_allowed(&ok, ALLOW), "the allow button");
        assert!(!plugin_allowed(&MessageDialogResult::Cancel, ALLOW));
    }
}
