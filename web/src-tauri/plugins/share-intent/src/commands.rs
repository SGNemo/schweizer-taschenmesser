use tauri::{command, AppHandle, Runtime};

use crate::{models::*, Result, ShareIntentExt};

/// The text or link shared with the app since the last call, or `None`. Returns each share once.
#[command]
pub(crate) async fn take_pending<R: Runtime>(app: AppHandle<R>) -> Result<Option<SharedContent>> {
    app.share_intent().take_pending()
}
