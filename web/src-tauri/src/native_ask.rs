//! The native yes/no question for anything that gives a device more (remote-control grants, the
//! master switch, device exchange, pairing). F1 (launch review 2026-11): the safe answer is the
//! default button, so one stray Enter never allows anything, and only the exact "allow" button
//! counts – Escape, closing the window or any other result is a no.

use tauri_plugin_dialog::{MessageDialogButtons, MessageDialogResult};

/// Buttons with "cancel" first: the first button is the default one (Enter).
pub fn buttons(allow: &str, cancel: &str) -> MessageDialogButtons {
    MessageDialogButtons::OkCancelCustom(cancel.into(), allow.into())
}

/// Whether the answer was the "allow" button and nothing else.
pub fn allowed(result: &MessageDialogResult, allow: &str) -> bool {
    matches!(result, MessageDialogResult::Custom(answer) if answer == allow)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_is_the_default_button() {
        let MessageDialogButtons::OkCancelCustom(first, second) = buttons("Erlauben", "Abbrechen")
        else {
            panic!("two custom buttons")
        };
        assert_eq!(first, "Abbrechen", "the first button is the default one");
        assert_eq!(second, "Erlauben");
    }

    #[test]
    fn only_the_allow_button_allows() {
        let allow = "Erlauben";
        assert!(allowed(&MessageDialogResult::Custom(allow.into()), allow));
        for no in [
            MessageDialogResult::Custom("Abbrechen".into()),
            MessageDialogResult::Cancel,
            MessageDialogResult::Ok,
            MessageDialogResult::Yes,
            MessageDialogResult::No,
        ] {
            assert!(!allowed(&no, allow), "{no:?}");
        }
    }
}
