//! Android-only self-update helper: downloads a release APK, verifies its SHA-256 and opens the
//! system package installer. Desktop builds compile a stub whose commands report `unsupported`
//! (they update through `tauri-plugin-updater`).

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
use desktop::ApkInstaller;
#[cfg(target_os = "android")]
use mobile::ApkInstaller;

/// Access to the plugin from `App`, `AppHandle` and `Window`.
pub trait ApkInstallerExt<R: Runtime> {
    fn apk_installer(&self) -> &ApkInstaller<R>;
}

impl<R: Runtime, T: Manager<R>> ApkInstallerExt<R> for T {
    fn apk_installer(&self) -> &ApkInstaller<R> {
        self.state::<ApkInstaller<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("apk-installer")
        .invoke_handler(tauri::generate_handler![
            commands::can_install,
            commands::download,
            commands::download_progress,
            commands::install
        ])
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            let apk_installer = mobile::init(app, api)?;
            #[cfg(not(target_os = "android"))]
            let apk_installer = desktop::init(app, api)?;
            app.manage(apk_installer);
            Ok(())
        })
        .build()
}
