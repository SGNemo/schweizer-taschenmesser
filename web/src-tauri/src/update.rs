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
/// Tag of the rolling Dev-Preview release; only the Dev-Preview build (`dev`) may read from it.
const DEV_RELEASE_TAG: &str = "dev-preview";
/// Manifest of the rolling Dev-Preview release. Only the Dev-Preview build ever asks for it; the
/// stable build rejects it here and would refuse its download anyway (`is_release_asset_url`).
const DEV_MANIFEST_PATH: &str =
    "/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/dev-latest.json";

/// Scheme, host, port, userinfo, query, fragment and dot segments – shared by every URL check.
fn is_plain_repo_url(url: &Url) -> bool {
    url.scheme() == "https"
        && url.host_str() == Some(HOST)
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
        && url.query().is_none()
        && url.fragment().is_none()
        && url.path().starts_with(RELEASES_PREFIX)
        && !url
            .path()
            .split('/')
            .any(|segment| segment == ".." || segment == ".")
}

/// Accepts `https://github.com/SGNemo/schweizer-taschenmesser/releases/…/latest.json` and nothing
/// else; the Dev-Preview manifest only for the Dev-Preview build (`dev`).
pub fn validate_endpoint(raw: &str, dev: bool) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|e| format!("invalid update endpoint: {e}"))?;
    let path = url.path();
    let ok = is_plain_repo_url(&url)
        && (path.ends_with(&format!("/{MANIFEST_NAME}")) || (dev && path == DEV_MANIFEST_PATH));
    if ok {
        Ok(url)
    } else {
        Err("update endpoint is not a release manifest of this repository".into())
    }
}

/// Manifest key and asset name of the portable Windows build.
#[cfg_attr(not(windows), allow(dead_code))]
const PORTABLE_TARGET: &str = "windows-x86_64-portable";
/// Accepted asset names: `latest.json` still points to the legacy name (installed apps depend on
/// it), releases also carry the same signed file as `Nemo-Portable.exe`.
#[cfg_attr(not(windows), allow(dead_code))]
const PORTABLE_ASSETS: [&str; 2] = ["Nemo-Portable.exe", "Taschenmesser-Portable.exe"];
/// Only the Dev-Preview build accepts this one (and only from the `dev-preview` release).
#[cfg_attr(not(windows), allow(dead_code))]
const DEV_PORTABLE_ASSET: &str = "Nemo-Portable-dev.exe";

/// Any update payload (every desktop OS) may only be downloaded from a release of this repository;
/// the `dev-preview` release only by the Dev-Preview build. Defence in depth: the minisign
/// signature must match as well.
pub fn is_release_asset_url(url: &Url, dev: bool) -> bool {
    let download_prefix = format!("{RELEASES_PREFIX}download/");
    is_plain_repo_url(url)
        && url.path().starts_with(&download_prefix)
        && (dev
            || !url
                .path()
                .starts_with(&format!("{download_prefix}{DEV_RELEASE_TAG}/")))
}

/// Windows: on top of `is_release_asset_url` the asset must be one of the portable executables.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn is_portable_asset_url(url: &Url, dev: bool) -> bool {
    is_release_asset_url(url, dev)
        && (PORTABLE_ASSETS
            .iter()
            .any(|asset| url.path().ends_with(&format!("/{asset}")))
            || (dev
                && url.path()
                    == format!("{RELEASES_PREFIX}download/{DEV_RELEASE_TAG}/{DEV_PORTABLE_ASSET}")))
}

/// The per-OS download check `check_update` applies to the manifest's download URL.
fn is_accepted_download_url(url: &Url, dev: bool) -> bool {
    #[cfg(windows)]
    {
        is_portable_asset_url(url, dev)
    }
    #[cfg(not(windows))]
    {
        is_release_asset_url(url, dev)
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
    let dev = crate::portable::is_dev_identifier(&app.config().identifier);
    let url = validate_endpoint(&endpoint, dev)?;
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
    if let Some(u) = &update {
        if !is_accepted_download_url(&u.download_url, dev) {
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
    use super::{is_portable_asset_url, is_release_asset_url, validate_endpoint, Url};

    const OK: &str = "https://github.com/SGNemo/schweizer-taschenmesser/releases";

    #[test]
    fn accepts_stable_and_versioned_manifests() {
        for dev in [false, true] {
            assert!(validate_endpoint(&format!("{OK}/latest/download/latest.json"), dev).is_ok());
            assert!(
                validate_endpoint(&format!("{OK}/download/v1.2.0-beta.1/latest.json"), dev).is_ok()
            );
        }
    }

    #[test]
    fn accepts_the_dev_preview_manifest_only_at_its_fixed_path_and_only_for_the_dev_build() {
        let dev_manifest = format!("{OK}/download/dev-preview/dev-latest.json");
        assert!(validate_endpoint(&dev_manifest, true).is_ok());
        assert!(validate_endpoint(&dev_manifest, false).is_err());
        for bad in [
            format!("{OK}/latest/download/dev-latest.json"),
            format!("{OK}/download/v1.2.0/dev-latest.json"),
            format!("{OK}/download/dev-preview/other.json"),
            format!("{OK}/download/dev-preview/dev-latest.json?x=1"),
        ] {
            assert!(validate_endpoint(&bad, true).is_err(), "{bad}");
            assert!(validate_endpoint(&bad, false).is_err(), "{bad}");
        }
    }

    #[test]
    fn release_assets_of_this_repository_are_accepted_on_every_desktop_os() {
        for name in ["Nemo.AppImage", "Nemo_1.2.0_amd64.deb", "Nemo.app.tar.gz"] {
            let url = Url::parse(&format!("{OK}/download/v1.2.0/{name}")).unwrap();
            assert!(is_release_asset_url(&url, false), "{name}");
            assert!(is_release_asset_url(&url, true), "{name}");
        }
        // The rolling dev release feeds the Dev-Preview build only.
        let dev = Url::parse(&format!("{OK}/download/dev-preview/Nemo-dev.AppImage")).unwrap();
        assert!(is_release_asset_url(&dev, true));
        assert!(!is_release_asset_url(&dev, false));
        for bad in [
            format!("{OK}/latest/download/Nemo.AppImage"),
            format!("{OK}/download/v1.2.0/Nemo.AppImage?x=1"),
            format!("{OK}/download/v1.2.0/Nemo.AppImage#f"),
            format!("{OK}/download/../../evil/Nemo.AppImage"),
            "https://user:pw@github.com/SGNemo/schweizer-taschenmesser/releases/download/v1/Nemo.AppImage".into(),
            "https://github.com:8443/SGNemo/schweizer-taschenmesser/releases/download/v1/Nemo.AppImage".into(),
            "http://github.com/SGNemo/schweizer-taschenmesser/releases/download/v1/Nemo.AppImage".into(),
            "https://evil.example/SGNemo/schweizer-taschenmesser/releases/download/v1/Nemo.AppImage".into(),
            "https://github.com/other/repo/releases/download/v1/Nemo.AppImage".into(),
            "https://github.com/SGNemo/schweizer-taschenmesser/archive/Nemo.AppImage".into(),
        ] {
            let url = Url::parse(&bad).unwrap();
            assert!(!is_release_asset_url(&url, false), "{bad}");
            assert!(!is_release_asset_url(&url, true), "{bad}");
        }
    }

    #[test]
    fn the_dev_exe_is_only_accepted_by_the_dev_build_from_the_dev_release() {
        let dev = Url::parse(&format!("{OK}/download/dev-preview/Nemo-Portable-dev.exe")).unwrap();
        assert!(is_portable_asset_url(&dev, true));
        assert!(!is_portable_asset_url(&dev, false));
        let elsewhere = Url::parse(&format!("{OK}/download/v1.2.0/Nemo-Portable-dev.exe")).unwrap();
        assert!(!is_portable_asset_url(&elsewhere, true));
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
            assert!(validate_endpoint(bad, false).is_err(), "{bad}");
            assert!(validate_endpoint(bad, true).is_err(), "{bad}");
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
            assert!(validate_endpoint(bad, false).is_err(), "{bad}");
            assert!(validate_endpoint(bad, true).is_err(), "{bad}");
        }
    }

    #[test]
    fn only_portable_release_assets_of_this_repository_are_downloaded() {
        let ok = format!("{OK}/download/v1.2.0/Taschenmesser-Portable.exe");
        assert!(is_portable_asset_url(&Url::parse(&ok).unwrap(), false));
        let nemo = format!("{OK}/download/v1.2.0/Nemo-Portable.exe");
        assert!(is_portable_asset_url(&Url::parse(&nemo).unwrap(), false));
        for bad in [
            format!("{OK}/download/v1.2.0/Nemo-Setup.exe"),
            format!("{OK}/download/v1.2.0/Taschenmesser-Setup.exe"),
            format!("{OK}/download/v1.2.0/Taschenmesser-Portable.exe?x=1"),
            format!("{OK}/download/../../evil/Taschenmesser-Portable.exe"),
            "http://github.com/SGNemo/schweizer-taschenmesser/releases/download/v1/Taschenmesser-Portable.exe".into(),
            "https://evil.example/SGNemo/schweizer-taschenmesser/releases/download/v1/Taschenmesser-Portable.exe".into(),
            "https://github.com/other/repo/releases/download/v1/Taschenmesser-Portable.exe".into(),
            "https://github.com/SGNemo/schweizer-taschenmesser/archive/Taschenmesser-Portable.exe".into(),
        ] {
            let url = Url::parse(&bad).unwrap();
            assert!(!is_portable_asset_url(&url, false), "{bad}");
            assert!(!is_portable_asset_url(&url, true), "{bad}");
        }
    }
}
