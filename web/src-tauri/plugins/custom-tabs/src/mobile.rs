use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{models::OpenRequest, validate, Error, Result};

const ANDROID_PACKAGE: &str = "io.github.sgnemo.taschenmesser.customtabs";

/// Registers the Kotlin plugin class (`CustomTabsPlugin`).
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<CustomTabs<R>> {
    let handle = api.register_android_plugin(ANDROID_PACKAGE, "CustomTabsPlugin")?;
    Ok(CustomTabs(handle))
}

pub struct CustomTabs<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> CustomTabs<R> {
    pub fn open(&self, request: OpenRequest) -> Result<()> {
        // Same check as the command, for callers that reach the plugin through `CustomTabsExt`.
        validate::check_url(&request.url).map_err(Error::InvalidRequest)?;
        self.0
            .run_mobile_plugin("open", request)
            .map_err(Into::into)
    }
}
