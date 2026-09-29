//! OS-level protection for the few things that must not sit in plain app storage:
//!
//! - a **keystore** for small secrets (AI provider keys): Windows Credential Manager (macOS Keychain /
//!   Linux keyring for development) and the Android Keystore,
//! - a **biometric gate** for the password vault's data key: Windows Hello consent (desktop) and
//!   `BiometricPrompt` with a Keystore key that requires user authentication (Android),
//! - **screenshot protection** (`FLAG_SECURE`) on Android.
//!
//! The commands are thin; the policy (what is stored, migration from the WebCrypto store, when the
//! vault asks for the master password) lives in the tested TypeScript side.

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
use desktop::SecureStore;
#[cfg(target_os = "android")]
use mobile::SecureStore;

/// Access to the plugin from `App`, `AppHandle` and `Window`.
pub trait SecureStoreExt<R: Runtime> {
    fn secure_store(&self) -> &SecureStore<R>;
}

impl<R: Runtime, T: Manager<R>> SecureStoreExt<R> for T {
    fn secure_store(&self) -> &SecureStore<R> {
        self.state::<SecureStore<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("secure-store")
        .invoke_handler(tauri::generate_handler![
            commands::available,
            commands::set,
            commands::get,
            commands::delete,
            commands::biometric_seal,
            commands::biometric_unseal,
            commands::biometric_has,
            commands::biometric_delete,
            commands::set_secure_window
        ])
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            let store = mobile::init(app, api)?;
            #[cfg(not(target_os = "android"))]
            let store = desktop::init(app, api)?;
            app.manage(store);
            Ok(())
        })
        .build()
}
