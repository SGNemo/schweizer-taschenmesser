//! Optional `magnet:` / `.torrent` association (desktop): forwards the address or file a start of
//! the app was given to the Nemo page, and (only on the user's click) registers the app with
//! Windows as a possible handler. The page only pre-fills the add dialog with it; nothing starts.

use std::sync::Mutex;

use ::os_association::{apply, is_registered, launch_target};
use tauri::{command, AppHandle, Emitter as _, Manager as _, State, Webview};

const MAIN: &str = "main";

#[derive(Default)]
pub struct Launch {
    pending: Mutex<Option<String>>,
}

fn ensure_main(webview: &Webview) -> Result<(), String> {
    if webview.label() == MAIN {
        Ok(())
    } else {
        Err("forbidden".into())
    }
}

/// Remembers the first magnet link / `.torrent` file among `args` and tells the page to pick it up.
pub fn remember(app: &AppHandle, args: &[String]) {
    let Some(target) = launch_target(args) else {
        return;
    };
    if let Some(state) = app.try_state::<Launch>() {
        *state.pending.lock().unwrap_or_else(|e| e.into_inner()) = Some(target);
    }
    // The payload is empty on purpose: the page fetches the value with `launch_take_pending`.
    let _ = app.emit_to(MAIN, "launch-open", ());
}

/// Registry id of this installation ("NemoDev" for the Dev-Preview flavour).
fn app_id(app: &AppHandle) -> &'static str {
    if crate::portable::is_dev_identifier(&app.config().identifier) {
        "NemoDev"
    } else {
        "Nemo"
    }
}

#[command]
pub fn launch_take_pending(
    webview: Webview,
    state: State<'_, Launch>,
) -> Result<Option<String>, String> {
    ensure_main(&webview)?;
    Ok(state
        .pending
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take())
}

#[command]
pub fn association_status(webview: Webview, app: AppHandle) -> Result<bool, String> {
    ensure_main(&webview)?;
    Ok(is_registered(app_id(&app)))
}

#[command]
pub fn association_set(webview: Webview, app: AppHandle, enabled: bool) -> Result<(), String> {
    ensure_main(&webview)?;
    let exe = std::env::current_exe().map_err(|_| "exe".to_string())?;
    apply(app_id(&app), &exe.to_string_lossy(), enabled).map_err(|e| match e {
        ::os_association::Error::Unsupported => "unsupported".to_string(),
        ::os_association::Error::Invalid => "invalid".to_string(),
        ::os_association::Error::Failed => "failed".to_string(),
    })
}
