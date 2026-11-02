//! Desktop windows have no system bars to hide and need no keep-awake from the shell.

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::{models::*, Result};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> Result<ScreenMode<R>> {
    Ok(ScreenMode(app.clone()))
}

pub struct ScreenMode<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> ScreenMode<R> {
    pub fn set_immersive(&self, _request: EnabledRequest) -> Result<()> {
        Ok(())
    }

    pub fn set_keep_awake(&self, _request: EnabledRequest) -> Result<()> {
        Ok(())
    }
}
