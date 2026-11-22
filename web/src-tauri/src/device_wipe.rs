//! "Alle Daten auf diesem Gerät löschen", native part: what the app keeps outside the web view's
//! database. The web app calls `device_wipe` once, before it deletes its database
//! (`web/src/core/reset/device.ts`); only the `main` web view may call it, and it takes no path:
//! every folder comes from the app's own data folder.
//!
//! Every step runs even when an earlier one failed; the answer names the steps that failed (and
//! what was kept on purpose), never a path or a value.
//!
//! Desktop: the home-network hub first (listener and sessions down, `lan-sync/` and both keystore
//! entries gone – an earlier paired phone is no longer trusted, whoever uses the PC next finds no
//! `hub.db` or data key; no hub starts until a minute after the wipe), the device side of a pairing with
//! another PC, the Local API (its tokens), the extension's host registration, the downloads list,
//! the torrent engine and its state, the built-in browser's profile, the PC-care journal (only when
//! nothing can be undone any more), `logs/panic.log`, and the local AI models when the user
//! ticked them. Android: the pairing with the PC
//! (`lan-client:` entries; the PC is told once if it is reachable) and the exchange inbox.

use serde::Serialize;
use std::path::Path;

#[derive(Debug, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WipeReport {
    /// Steps that did not finish (ids as in `DeviceWipeStep`, `web/src/core/platform/deviceWipe.ts`).
    pub failed: Vec<&'static str>,
    /// Steps that left something on purpose (`pc-care`: changes that can still be undone).
    pub kept: Vec<&'static str>,
}

impl WipeReport {
    fn step(&mut self, id: &'static str, result: Result<(), String>) {
        if result.is_err() {
            self.failed.push(id);
        }
    }
}

/// Removes a file; one that is not there counts as removed.
pub(crate) fn remove_file(path: &Path) -> Result<(), String> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("io".to_owned()),
    }
}

/// Removes a folder with everything in it; one that is not there counts as removed.
pub(crate) fn remove_dir(path: &Path) -> Result<(), String> {
    match std::fs::remove_dir_all(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("io".to_owned()),
    }
}

#[cfg(desktop)]
pub(crate) mod desktop {
    use super::*;
    use tauri::{AppHandle, Manager as _, Webview};

    #[tauri::command]
    pub async fn device_wipe(
        app: AppHandle,
        webview: Webview,
        models: bool,
    ) -> Result<WipeReport, String> {
        if webview.label() != "main" {
            return Err("forbidden".into());
        }
        // A step that panics still ends the hub hold (a minute, not the hour of a running wipe).
        let handle = app.clone();
        let failed = move || {
            crate::lan_sync::wipe_finished(&handle);
            "internal".to_owned()
        };
        // The hub first (blocking, off the async runtime): it is what a paired phone talks to.
        let (app, mut report) = tauri::async_runtime::spawn_blocking(move || {
            let mut report = WipeReport::default();
            pairings(&app, &mut report);
            (app, report)
        })
        .await
        .map_err(|_| failed.clone()())?;
        report.step("torrent", crate::torrent::wipe(&app).await);
        tauri::async_runtime::spawn_blocking(move || {
            files(&app, models, &mut report);
            // the page deletes its database next: no hub for another minute from here
            crate::lan_sync::wipe_finished(&app);
            report
        })
        .await
        .map_err(|_| failed())
    }

    /// Everything another device or program can reach this PC through.
    fn pairings(app: &AppHandle, report: &mut WipeReport) {
        let dir = crate::lan_sync::lan_dir_path(app);
        report.step(
            "lan-hub",
            crate::lan_sync::wipe_hub(&crate::lan_sync::AppHub(app), dir.as_deref())
                .map_err(|_| "failed".to_owned()),
        );
        report.step("lan-client", crate::lan_client::unpair_now(app));
        // its tokens belong to the previous owner
        report.step(
            "local-api",
            crate::local_api::local_api_stop(app.state::<crate::local_api::LocalApi>()),
        );
        report.step("native-messaging", crate::vault_bridge::wipe(app));
    }

    fn files(app: &AppHandle, models: bool, report: &mut WipeReport) {
        report.step("downloads", crate::downloads::wipe(app));
        report.step("browser", browser(app));
        match app.state::<crate::optimize::PcCare>().wipe(app) {
            Ok(crate::optimize::JournalWipe::Removed) => {}
            Ok(crate::optimize::JournalWipe::KeptForUndo) => report.kept.push("pc-care"),
            Err(_) => report.failed.push("pc-care"),
        }
        report.step("panic-log", panic_log(app));
        if models {
            app.state::<crate::local_llm::LocalLlm>().release();
            report.step(
                "models",
                crate::local_llm::models_dir(app).map_or(Ok(()), |d| remove_dir(&d)),
            );
        }
    }

    /// The tabs' processes let go of the profile files a moment after the tabs closed (WebView2
    /// clears asynchronously): try again for up to 3 s.
    fn browser(app: &AppHandle) -> Result<(), String> {
        let state = app.state::<crate::browser::BrowserState>();
        let mut result = crate::browser::clear_all(app, &state);
        for _ in 0..10 {
            if result.is_ok() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(300));
            result = crate::browser::clear_all(app, &state);
        }
        result
    }

    fn panic_log(app: &AppHandle) -> Result<(), String> {
        let Some(dir) = crate::capture::app_data_folder(app) else {
            return Ok(());
        };
        let logs = dir.join("logs");
        remove_file(&logs.join("panic.log"))?;
        remove_file(&logs.join("panic.log.1"))
    }
}

// The steps are compiled in tests too, so the phone's part is type-checked on every desktop CI run;
// the command itself exists only on the phone (one `device_wipe` per build).
#[cfg(any(mobile, test))]
#[cfg_attr(test, allow(dead_code))]
pub(crate) mod mobile {
    use super::*;
    use tauri::{AppHandle, Runtime};

    #[cfg(mobile)]
    #[tauri::command]
    pub async fn device_wipe<R: Runtime>(
        app: AppHandle<R>,
        webview: tauri::Webview<R>,
        models: bool,
    ) -> Result<WipeReport, String> {
        let _ = models; // no local models on the phone
        if webview.label() != "main" {
            return Err("forbidden".into());
        }
        tauri::async_runtime::spawn_blocking(move || steps(&app))
            .await
            .map_err(|_| "internal".to_owned())
    }

    /// Blocking: the pairing with the PC (told once if reachable), then the exchange inbox.
    pub(crate) fn steps<R: Runtime>(app: &AppHandle<R>) -> WipeReport {
        let mut report = WipeReport::default();
        report.step("lan-client", crate::lan_client::unpair_now(app));
        report.step("exchange-inbox", crate::exchange_client::wipe(app));
        report
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_failed_step_is_named_and_the_rest_still_counts() {
        let mut r = WipeReport::default();
        r.step("lan-hub", Err("x".into()));
        r.step("downloads", Ok(()));
        r.step("panic-log", Err("x".into()));
        assert_eq!(r.failed, ["lan-hub", "panic-log"]);
    }

    #[test]
    fn missing_files_and_folders_count_as_removed() {
        let d = std::env::temp_dir().join(format!("nemo-device-wipe-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        assert_eq!(remove_dir(&d), Ok(()));
        assert_eq!(remove_file(&d.join("x.json")), Ok(()));
        std::fs::create_dir_all(d.join("sub")).unwrap();
        std::fs::write(d.join("sub").join("a"), b"x").unwrap();
        assert_eq!(remove_dir(&d), Ok(()));
        assert!(!d.exists());
    }
}
