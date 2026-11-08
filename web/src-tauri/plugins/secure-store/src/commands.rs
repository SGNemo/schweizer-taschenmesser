use tauri::{command, AppHandle, Runtime};

use crate::{models::*, Error, Result, SecureStoreExt};

/// The webview never reaches Rust-only entries (`RUST_ONLY_PREFIX`).
fn webview_name(name: &str) -> Result<()> {
    validate_webview_name(name).map_err(Error::Invalid)
}

#[command]
pub(crate) async fn available<R: Runtime>(app: AppHandle<R>) -> Result<AvailableResponse> {
    app.secure_store().available()
}

#[command]
pub(crate) async fn set<R: Runtime>(app: AppHandle<R>, request: SetRequest) -> Result<()> {
    webview_name(&request.name)?;
    app.secure_store().set(request)
}

#[command]
pub(crate) async fn get<R: Runtime>(
    app: AppHandle<R>,
    request: NameRequest,
) -> Result<ValueResponse> {
    webview_name(&request.name)?;
    app.secure_store().get(request)
}

#[command]
pub(crate) async fn delete<R: Runtime>(app: AppHandle<R>, request: NameRequest) -> Result<()> {
    webview_name(&request.name)?;
    app.secure_store().delete(request)
}

#[command]
pub(crate) async fn biometric_seal<R: Runtime>(
    app: AppHandle<R>,
    request: SealRequest,
) -> Result<()> {
    webview_name(&request.name)?;
    app.secure_store().biometric_seal(request).await
}

#[command]
pub(crate) async fn biometric_unseal<R: Runtime>(
    app: AppHandle<R>,
    request: UnsealRequest,
) -> Result<UnsealResponse> {
    webview_name(&request.name)?;
    app.secure_store().biometric_unseal(request).await
}

#[command]
pub(crate) async fn biometric_has<R: Runtime>(
    app: AppHandle<R>,
    request: NameRequest,
) -> Result<HasResponse> {
    webview_name(&request.name)?;
    app.secure_store().biometric_has(request)
}

#[command]
pub(crate) async fn biometric_delete<R: Runtime>(
    app: AppHandle<R>,
    request: NameRequest,
) -> Result<()> {
    webview_name(&request.name)?;
    app.secure_store().biometric_delete(request)
}

#[command]
pub(crate) async fn set_secure_window<R: Runtime>(
    app: AppHandle<R>,
    request: SecureWindowRequest,
) -> Result<()> {
    app.secure_store().set_secure_window(request)
}
