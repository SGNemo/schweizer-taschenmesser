use tauri::{command, AppHandle, Runtime};

use crate::{models::*, Result, ScreenModeExt};

/// Hides (or shows again) the Android status and navigation bars.
#[command]
pub(crate) async fn set_immersive<R: Runtime>(
    app: AppHandle<R>,
    request: EnabledRequest,
) -> Result<()> {
    app.screen_mode().set_immersive(request)
}

/// Keeps the screen on (or lets it time out again).
#[command]
pub(crate) async fn set_keep_awake<R: Runtime>(
    app: AppHandle<R>,
    request: EnabledRequest,
) -> Result<()> {
    app.screen_mode().set_keep_awake(request)
}
