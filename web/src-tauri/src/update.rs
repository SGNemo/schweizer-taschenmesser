//! Desktop self-update on top of `tauri-plugin-updater`. The plugin verifies every download with the
//! minisign public key from `tauri.conf.json` (`plugins.updater.pubkey`) – there is no way to
//! install an unsigned or wrongly signed payload. What we add is a runtime-selectable manifest
//! (stable vs. beta channel) that is restricted to this repository's GitHub releases.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{ipc::Channel, AppHandle, State, Url};
use tauri_plugin_updater::{Update, UpdaterExt};

/// Update manifests may only come from release downloads of this repository.
const HOST: &str = "github.com";
const RELEASES_PREFIX: &str = "/SGNemo/schweizer-taschenmesser/releases/";
const MANIFEST_NAME: &str = "latest.json";

/// Accepts `https://github.com/SGNemo/schweizer-taschenmesser/releases/…/latest.json` and nothing else.
pub fn validate_endpoint(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|e| format!("invalid update endpoint: {e}"))?;
    let path = url.path();
    let ok = url.scheme() == "https"
        && url.host_str() == Some(HOST)
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
        && url.query().is_none()
        && url.fragment().is_none()
        && path.starts_with(RELEASES_PREFIX)
        && path.ends_with(&format!("/{MANIFEST_NAME}"))
        && !path
            .split('/')
            .any(|segment| segment == ".." || segment == ".");
    if ok {
        Ok(url)
    } else {
        Err("update endpoint is not a release manifest of this repository".into())
    }
}

/// The update found by the last `check_update`, waiting for `install_update`.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<Update>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMeta {
    version: String,
    notes: Option<String>,
    date: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum DownloadEvent {
    #[serde(rename_all = "camelCase")]
    Started {
        content_length: Option<u64>,
    },
    #[serde(rename_all = "camelCase")]
    Progress {
        chunk_length: usize,
    },
    Finished,
}

/// Looks for a newer version in the given manifest. `None` = up to date.
#[tauri::command]
pub async fn check_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
    endpoint: String,
) -> Result<Option<UpdateMeta>, String> {
    let url = validate_endpoint(&endpoint)?;
    let update = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    let meta = update.as_ref().map(|u| UpdateMeta {
        version: u.version.clone(),
        notes: u.body.clone(),
        date: u.date.map(|d| d.to_string()),
    });
    *pending.0.lock().map_err(|e| e.to_string())? = update;
    Ok(meta)
}

/// Downloads and installs the update found by `check_update`, then restarts the app.
#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
    on_event: Channel<DownloadEvent>,
) -> Result<(), String> {
    let update = pending
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .take()
        .ok_or("no update has been checked")?;
    let mut started = false;
    let progress = on_event.clone();
    update
        .download_and_install(
            move |chunk_length, content_length| {
                if !started {
                    started = true;
                    let _ = progress.send(DownloadEvent::Started { content_length });
                }
                let _ = progress.send(DownloadEvent::Progress { chunk_length });
            },
            move || {
                let _ = on_event.send(DownloadEvent::Finished);
            },
        )
        .await
        .map_err(|e| e.to_string())?;
    // The Windows installer ends the process itself; elsewhere restart into the new version.
    app.restart()
}

#[cfg(test)]
mod tests {
    use super::validate_endpoint;

    const OK: &str = "https://github.com/SGNemo/schweizer-taschenmesser/releases";

    #[test]
    fn accepts_stable_and_versioned_manifests() {
        assert!(validate_endpoint(&format!("{OK}/latest/download/latest.json")).is_ok());
        assert!(validate_endpoint(&format!("{OK}/download/v1.2.0-beta.1/latest.json")).is_ok());
    }

    #[test]
    fn rejects_other_hosts_repositories_and_schemes() {
        for bad in [
            "http://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/latest.json",
            "https://evil.example/SGNemo/schweizer-taschenmesser/releases/latest/download/latest.json",
            "https://github.com.evil.example/SGNemo/schweizer-taschenmesser/releases/download/v1/latest.json",
            "https://github.com/other/repo/releases/latest/download/latest.json",
            "https://github.com/SGNemo/schweizer-taschenmesser-fork/releases/latest/download/latest.json",
            "https://github.com/SGNemo/schweizer-taschenmesser/archive/latest.json",
            "ftp://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/latest.json",
            "not a url",
            "",
        ] {
            assert!(validate_endpoint(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn rejects_tricks_and_other_files() {
        for bad in [
            "https://user:pw@github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/latest.json",
            "https://github.com:8443/SGNemo/schweizer-taschenmesser/releases/latest/download/latest.json",
            "https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/latest.json?x=1",
            "https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/latest.json#frag",
            "https://github.com/SGNemo/schweizer-taschenmesser/releases/download/../../../evil/latest.json",
            "https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Taschenmesser-Setup.exe",
        ] {
            assert!(validate_endpoint(bad).is_err(), "{bad}");
        }
    }
}
