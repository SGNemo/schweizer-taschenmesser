use serde::de::DeserializeOwned;
use serde_json::Value;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{models::*, Result};

const ANDROID_PACKAGE: &str = "io.github.sgnemo.taschenmesser.screenmode";

/// Registers the Kotlin plugin class (`ScreenModePlugin`).
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<ScreenMode<R>> {
    let handle = api.register_android_plugin(ANDROID_PACKAGE, "ScreenModePlugin")?;
    Ok(ScreenMode(handle))
}

pub struct ScreenMode<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> ScreenMode<R> {
    pub fn set_immersive(&self, request: EnabledRequest) -> Result<()> {
        self.0
            .run_mobile_plugin::<Value>("setImmersive", request)
            .map(drop)
            .map_err(Into::into)
    }

    pub fn set_keep_awake(&self, request: EnabledRequest) -> Result<()> {
        self.0
            .run_mobile_plugin::<Value>("setKeepAwake", request)
            .map(drop)
            .map_err(Into::into)
    }
}
