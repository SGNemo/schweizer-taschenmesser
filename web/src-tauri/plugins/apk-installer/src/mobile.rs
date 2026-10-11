use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{models::*, validate, Error, Result};

const ANDROID_PACKAGE: &str = "io.github.sgnemo.taschenmesser.apkinstaller";

/// Registers the Kotlin plugin class (`ApkInstallerPlugin`).
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<ApkInstaller<R>> {
    let handle = api.register_android_plugin(ANDROID_PACKAGE, "ApkInstallerPlugin")?;
    Ok(ApkInstaller(handle))
}

pub struct ApkInstaller<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> ApkInstaller<R> {
    pub fn can_install(&self) -> Result<CanInstallResponse> {
        self.0
            .run_mobile_plugin("canInstall", ())
            .map_err(Into::into)
    }
    pub fn download(&self, request: DownloadRequest) -> Result<DownloadResponse> {
        // Same check as the command, for callers that reach the plugin through `ApkInstallerExt`.
        validate::check_download(&request.url, request.sha256.as_deref())
            .map_err(Error::InvalidRequest)?;
        self.0
            .run_mobile_plugin("download", request)
            .map_err(Into::into)
    }
    pub fn download_progress(&self) -> Result<ProgressResponse> {
        self.0
            .run_mobile_plugin("downloadProgress", ())
            .map_err(Into::into)
    }
    pub fn install(&self, request: InstallRequest) -> Result<InstallResponse> {
        self.0
            .run_mobile_plugin("install", request)
            .map_err(Into::into)
    }
}
