use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{models::*, Result};

const ANDROID_PACKAGE: &str = "io.github.sgnemo.taschenmesser.lanwatch";

/// Registers the Kotlin plugin class (`LanWatchPlugin`).
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<LanWatch<R>> {
    let handle = api.register_android_plugin(ANDROID_PACKAGE, "LanWatchPlugin")?;
    Ok(LanWatch(handle))
}

pub struct LanWatch<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> LanWatch<R> {
    pub fn wifi_state(&self) -> Result<WifiState> {
        let state: WifiState = self.0.run_mobile_plugin("wifiState", ())?;
        Ok(state)
    }

    /// Blocks for up to `timeout_ms` (capped): call it from a blocking task.
    pub fn discover(&self, timeout_ms: u64) -> Result<Vec<Service>> {
        let found: Discovered = self.0.run_mobile_plugin(
            "discover",
            DiscoverArgs {
                timeout_ms: timeout_ms.min(MAX_SEARCH_MS),
            },
        )?;
        Ok(found.services)
    }
}
