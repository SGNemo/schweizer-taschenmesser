//! Nothing is ever shared into the desktop app.

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::{models::*, Result};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> Result<ShareIntent<R>> {
    Ok(ShareIntent(app.clone()))
}

pub struct ShareIntent<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> ShareIntent<R> {
    pub fn take_pending(&self) -> Result<Option<SharedContent>> {
        Ok(None)
    }
}
