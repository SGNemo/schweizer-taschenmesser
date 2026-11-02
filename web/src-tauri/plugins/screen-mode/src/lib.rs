//! Android window modes for the cockpit: immersive (status and navigation bars hidden, a swipe
//! from the edge shows them briefly) and keep-awake (`FLAG_KEEP_SCREEN_ON`). Both are plain window
//! flags on the activity; nothing is stored and nothing is logged. The web app decides when they
//! apply (`core/platform/tauri/display.ts`). On other platforms both commands do nothing.

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
use desktop::ScreenMode;
#[cfg(target_os = "android")]
use mobile::ScreenMode;

/// Access to the plugin from `App`, `AppHandle` and `Window`.
pub trait ScreenModeExt<R: Runtime> {
    fn screen_mode(&self) -> &ScreenMode<R>;
}

impl<R: Runtime, T: Manager<R>> ScreenModeExt<R> for T {
    fn screen_mode(&self) -> &ScreenMode<R> {
        self.state::<ScreenMode<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("screen-mode")
        .invoke_handler(tauri::generate_handler![
            commands::set_immersive,
            commands::set_keep_awake
        ])
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
