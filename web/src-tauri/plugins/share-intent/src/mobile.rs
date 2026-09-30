use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{models::*, Result};

const ANDROID_PACKAGE: &str = "io.github.sgnemo.taschenmesser.shareintent";

/// Registers the Kotlin plugin class (`ShareIntentPlugin`).
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<ShareIntent<R>> {
    let handle = api.register_android_plugin(ANDROID_PACKAGE, "ShareIntentPlugin")?;
    Ok(ShareIntent(handle))
}

pub struct ShareIntent<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> ShareIntent<R> {
    pub fn take_pending(&self) -> Result<Option<SharedContent>> {
        let shared: SharedContent = self.0.run_mobile_plugin("takePending", ())?;
        Ok((!shared.is_empty()).then_some(shared))
    }
}
