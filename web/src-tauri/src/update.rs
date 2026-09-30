//! Desktop self-update on top of `tauri-plugin-updater`. The plugin verifies every download with the
//! minisign public key from `tauri.conf.json` (`plugins.updater.pubkey`) – there is no way to
//! install an unsigned or wrongly signed payload. What we add is a runtime-selectable manifest
//! (stable vs. beta channel) that is restricted to this repository's GitHub releases.
//!
//! **Windows is a portable executable**, which the plugin cannot install (it only launches NSIS/MSI
//! installers). There the plugin checks the manifest entry `windows-x86_64-portable` and downloads +
//! verifies the file; `portable.rs` re-checks the signature and swaps the running executable.

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

/// Manifest key and asset name of the portable Windows build.
#[cfg_attr(not(windows), allow(dead_code))]
const PORTABLE_TARGET: &str = "windows-x86_64-portable";
#[cfg_attr(not(windows), allow(dead_code))]
const PORTABLE_ASSET: &str = "Taschenmesser-Portable.exe";

/// The executable may only be downloaded from a release of this repository (defence in depth: the
/// minisign signature must match as well).
#[cfg_attr(not(windows), allow(dead_code))]
pub fn is_portable_asset_url(url: &Url) -> bool {
    url.scheme() == "https"
        && url.host_str() == Some(HOST)
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
        && url.query().is_none()
        && url.fragment().is_none()
        && url
            .path()
            .starts_with(&format!("{RELEASES_PREFIX}download/"))
        && url.path().ends_with(&format!("/{PORTABLE_ASSET}"))
        && !url
            .path()
            .split('/')
            .any(|segment| segment == ".." || segment == ".")
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
    let builder = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| e.to_string())?;
    #[cfg(windows)]
    let builder = builder.target(PORTABLE_TARGET);
    let update = builder
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    #[cfg(windows)]
    if let Some(u) = &update {
        if !is_portable_asset_url(&u.download_url) {
            return Err("update download is not a release asset of this repository".into());
        }
    }
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
    let on_chunk = move |chunk_length: usize, content_length: Option<u64>| {
        if !started {
            started = true;
            let _ = progress.send(DownloadEvent::Started { content_length });
        }
        let _ = progress.send(DownloadEvent::Progress { chunk_length });
    };
    let on_finished = move || {
        let _ = on_event.send(DownloadEvent::Finished);
    };

    #[cfg(windows)]
    {
        // The plugin verifies the signature while downloading; the portable swap checks it again.
        let bytes = update
            .download(on_chunk, on_finished)
            .await
            .map_err(|e| e.to_string())?;
        install_portable(&app, &update, &bytes)
    }
    #[cfg(not(windows))]
    {
        update
            .download_and_install(on_chunk, on_finished)
            .await
            .map_err(|e| e.to_string())?;
        app.restart()
    }
}

/// Signature re-check, swap of the running executable, start of the new one, exit of this process.
#[cfg(windows)]
fn install_portable(app: &AppHandle, update: &Update, bytes: &[u8]) -> Result<(), String> {
    use crate::portable::{self, RealFs};

    let pubkey = app
        .config()
        .plugins
        .0
        .get("updater")
        .and_then(|v| v.get("pubkey"))
        .and_then(|v| v.as_str())
        .ok_or("no updater public key configured")?;
    portable::verify_payload(bytes, &update.signature, pubkey)
        .map_err(|e| format!("signature-invalid: {e}"))?;

    let exe = std::env::current_exe().map_err(|e| format!("swap-failed: {e}"))?;
    portable::swap(&RealFs, &exe, bytes).map_err(|e| e.to_string())?;

    if let Err(e) = std::process::Command::new(&exe)
        .arg(portable::UPDATED_FLAG)
        .spawn()
    {
        let _ = portable::rollback(&RealFs, &exe);
        return Err(format!("start-failed: {e}"));
    }
    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{is_portable_asset_url, validate_endpoint, Url};

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

    #[test]
    fn only_portable_release_assets_of_this_repository_are_downloaded() {
        let ok = format!("{OK}/download/v1.2.0/Taschenmesser-Portable.exe");
        assert!(is_portable_asset_url(&Url::parse(&ok).unwrap()));
        for bad in [
            format!("{OK}/download/v1.2.0/Taschenmesser-Setup.exe"),
            format!("{OK}/download/v1.2.0/Taschenmesser-Portable.exe?x=1"),
            format!("{OK}/download/../../evil/Taschenmesser-Portable.exe"),
            "http://github.com/SGNemo/schweizer-taschenmesser/releases/download/v1/Taschenmesser-Portable.exe".into(),
            "https://evil.example/SGNemo/schweizer-taschenmesser/releases/download/v1/Taschenmesser-Portable.exe".into(),
            "https://github.com/other/repo/releases/download/v1/Taschenmesser-Portable.exe".into(),
            "https://github.com/SGNemo/schweizer-taschenmesser/archive/Taschenmesser-Portable.exe".into(),
        ] {
            let url = Url::parse(&bad).unwrap();
            assert!(!is_portable_asset_url(&url), "{bad}");
        }
    }
}
