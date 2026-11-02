use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::{models::OpenRequest, Error, Result};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> Result<CustomTabs<R>> {
    Ok(CustomTabs(app.clone()))
}

/// Desktop stub: the command reports `unsupported` (desktop has its own embedded tabs).
#[allow(dead_code)]
pub struct CustomTabs<R: Runtime>(AppHandle<R>);

impl<R: Runtime> CustomTabs<R> {
    pub fn open(&self, _request: OpenRequest) -> Result<()> {
        Err(Error::Unsupported)
    }
}
