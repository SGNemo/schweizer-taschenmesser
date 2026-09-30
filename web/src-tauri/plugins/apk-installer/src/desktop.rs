use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::{models::*, Error, Result};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> Result<ApkInstaller<R>> {
    Ok(ApkInstaller(app.clone()))
}

/// Desktop stub: every command reports `unsupported`.
#[allow(dead_code)]
pub struct ApkInstaller<R: Runtime>(AppHandle<R>);

impl<R: Runtime> ApkInstaller<R> {
    pub fn can_install(&self) -> Result<CanInstallResponse> {
        Err(Error::Unsupported)
    }
    pub fn download(&self, _request: DownloadRequest) -> Result<DownloadResponse> {
        Err(Error::Unsupported)
    }
    pub fn download_progress(&self) -> Result<ProgressResponse> {
        Err(Error::Unsupported)
    }
    pub fn install(&self, _request: InstallRequest) -> Result<InstallResponse> {
        Err(Error::Unsupported)
    }
}
