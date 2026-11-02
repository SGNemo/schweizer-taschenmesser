use tauri::{command, AppHandle, Runtime};

use crate::{models::OpenRequest, validate, CustomTabsExt, Error, Result};

#[command]
pub(crate) async fn open<R: Runtime>(app: AppHandle<R>, request: OpenRequest) -> Result<()> {
    // Checked here, before any platform code: only http(s) addresses leave the app.
    validate::check_url(&request.url).map_err(Error::InvalidRequest)?;
    app.custom_tabs().open(request)
}
