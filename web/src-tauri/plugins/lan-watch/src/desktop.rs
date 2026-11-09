//! No Wi-Fi watch and no search on the desktop (the desktop app is the hub; a second PC as client
//! keeps its last address).

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::{models::*, Result};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> Result<LanWatch<R>> {
    Ok(LanWatch(app.clone()))
}

pub struct LanWatch<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> LanWatch<R> {
    pub fn wifi_state(&self) -> Result<WifiState> {
        Ok(WifiState::default())
    }

    pub fn discover(&self, _timeout_ms: u64) -> Result<Vec<Service>> {
        Ok(Vec::new())
    }
}
