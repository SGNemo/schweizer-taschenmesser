//! Android "Share" target. Other apps hand text or a link to the app through `ACTION_SEND`; the
//! Kotlin side (`ShareIntentPlugin`) keeps the latest share until the web app asks for it with
//! `take_pending`, which returns it once. Everything else (what to suggest, where to save) is
//! the web app's job (`web/src/quickCapture`). On other platforms the plugin reports nothing.

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[cfg(not(target_os = "android"))]
mod desktop;
#[cfg(target_os = "android")]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};
pub use models::*;

#[cfg(not(target_os = "android"))]
use desktop::ShareIntent;
#[cfg(target_os = "android")]
use mobile::ShareIntent;

/// Access to the plugin from `App`, `AppHandle` and `Window`.
pub trait ShareIntentExt<R: Runtime> {
    fn share_intent(&self) -> &ShareIntent<R>;
}

impl<R: Runtime, T: Manager<R>> ShareIntentExt<R> for T {
    fn share_intent(&self) -> &ShareIntent<R> {
        self.state::<ShareIntent<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("share-intent")
        .invoke_handler(tauri::generate_handler![commands::take_pending])
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            let plugin = mobile::init(app, api)?;
            #[cfg(not(target_os = "android"))]
            let plugin = desktop::init(app, api)?;
            app.manage(plugin);
            Ok(())
        })
        .build()
}
