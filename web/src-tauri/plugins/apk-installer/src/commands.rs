use tauri::{command, AppHandle, Runtime};

use crate::{models::*, ApkInstallerExt, Result};

#[command]
pub(crate) async fn can_install<R: Runtime>(app: AppHandle<R>) -> Result<CanInstallResponse> {
    app.apk_installer().can_install()
}

#[command]
pub(crate) async fn download<R: Runtime>(
    app: AppHandle<R>,
    request: DownloadRequest,
) -> Result<DownloadResponse> {
    app.apk_installer().download(request)
}

#[command]
pub(crate) async fn download_progress<R: Runtime>(app: AppHandle<R>) -> Result<ProgressResponse> {
    app.apk_installer().download_progress()
}

#[command]
pub(crate) async fn install<R: Runtime>(
    app: AppHandle<R>,
    request: InstallRequest,
) -> Result<InstallResponse> {
    app.apk_installer().install(request)
}
