use tauri::{command, AppHandle, Runtime};

use crate::{models::WifiState, LanWatchExt, Result};

/// Whether a Wi-Fi network is connected right now ("Jetzt abgleichen" on the phone needs one).
#[command]
pub(crate) async fn wifi_state<R: Runtime>(app: AppHandle<R>) -> Result<WifiState> {
    app.lan_watch().wifi_state()
}
