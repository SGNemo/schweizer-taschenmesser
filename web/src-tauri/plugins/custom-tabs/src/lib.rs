//! Android-only: opens an `http(s)` address in a Chrome Custom Tab, the system browser inside the
//! app. The page runs in the browser's own process with its own cookies and settings; no script of
//! ours runs there and nothing flows back. Desktop builds compile a stub whose command reports
//! `unsupported` (they embed their own isolated tabs).

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
mod validate;

pub use error::{Error, Result};
pub use models::*;

#[cfg(not(target_os = "android"))]
use desktop::CustomTabs;
#[cfg(target_os = "android")]
use mobile::CustomTabs;

/// Access to the plugin from `App`, `AppHandle` and `Window`.
pub trait CustomTabsExt<R: Runtime> {
    fn custom_tabs(&self) -> &CustomTabs<R>;
}

impl<R: Runtime, T: Manager<R>> CustomTabsExt<R> for T {
    fn custom_tabs(&self) -> &CustomTabs<R> {
        self.state::<CustomTabs<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("custom-tabs")
        .invoke_handler(tauri::generate_handler![commands::open])
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            let custom_tabs = mobile::init(app, api)?;
            #[cfg(not(target_os = "android"))]
            let custom_tabs = desktop::init(app, api)?;
            app.manage(custom_tabs);
            Ok(())
        })
        .build()
}
