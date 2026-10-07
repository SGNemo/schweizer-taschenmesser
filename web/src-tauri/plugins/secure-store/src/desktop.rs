//! Desktop: `keyring` (Credential Manager on Windows) for secrets; Windows Hello as the consent gate
//! in front of the sealed vault key. Elsewhere the biometric gate reports `unsupported`.

use base64::{engine::general_purpose::STANDARD, Engine};
use keyring::{Entry, Error as KeyringError};
use serde::de::DeserializeOwned;
use std::sync::OnceLock;
#[cfg(windows)]
use tauri::Manager;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::{models::*, Error, Result};

#[cfg(windows)]
mod hello;

/// Sealed vault keys are filed apart from ordinary secrets.
const BIO_PREFIX: &str = "bio:";

/// Credential Manager service name: the app identifier, so the Dev-Preview (identifier + `.dev`)
/// never reads or overwrites the secrets of the stable app. For the stable app the identifier is
/// exactly `SERVICE`, i.e. nothing changes for existing entries.
static SERVICE_NAME: OnceLock<String> = OnceLock::new();

fn service() -> &'static str {
    SERVICE_NAME.get().map(String::as_str).unwrap_or(SERVICE)
}

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> Result<SecureStore<R>> {
    let _ = SERVICE_NAME.set(app.config().identifier.clone());
    Ok(SecureStore(app.clone()))
}

pub struct SecureStore<R: Runtime>(AppHandle<R>);

fn entry(name: &str) -> Result<Entry> {
    validate_name(name).map_err(Error::Invalid)?;
    Entry::new(service(), name).map_err(|e| Error::Keystore(e.to_string()))
}

fn read(name: &str) -> Result<Option<String>> {
    match entry(name)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(e) => Err(Error::Keystore(e.to_string())),
    }
}

fn remove(name: &str) -> Result<()> {
    match entry(name)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(e) => Err(Error::Keystore(e.to_string())),
    }
}

/// Is the OS keystore usable at all? (A headless Linux box may have none.)
fn keystore_works() -> bool {
    const PROBE: &str = "probe";
    let Ok(e) = entry(PROBE) else { return false };
    let ok = e.set_password("ok").is_ok() && e.get_password().is_ok();
    let _ = e.delete_credential();
    ok
}

impl<R: Runtime> SecureStore<R> {
    pub fn available(&self) -> Result<AvailableResponse> {
        Ok(AvailableResponse {
            keystore: keystore_works(),
            biometric: biometric_available(),
        })
    }

    pub fn set(&self, request: SetRequest) -> Result<()> {
        validate_value(&request.value).map_err(Error::Invalid)?;
        entry(&request.name)?
            .set_password(&request.value)
            .map_err(|e| Error::Keystore(e.to_string()))
    }

    pub fn get(&self, request: NameRequest) -> Result<ValueResponse> {
        Ok(ValueResponse {
            value: read(&request.name)?,
        })
    }

    pub fn delete(&self, request: NameRequest) -> Result<()> {
        remove(&request.name)
    }

    pub async fn biometric_seal(&self, request: SealRequest) -> Result<()> {
        if !biometric_available() {
            return Err(Error::Unsupported);
        }
        // The secret must be valid base64 (it is the raw vault key); store it as given.
        STANDARD
            .decode(&request.secret)
            .map_err(|_| Error::Invalid("secret is not base64".into()))?;
        validate_value(&request.secret).map_err(Error::Invalid)?;
        let name = format!("{BIO_PREFIX}{}", request.name);
        entry(&name)?
            .set_password(&request.secret)
            .map_err(|e| Error::Keystore(e.to_string()))
    }

    pub async fn biometric_unseal(&self, request: UnsealRequest) -> Result<UnsealResponse> {
        if !biometric_available() {
            return Err(Error::Unsupported);
        }
        let name = format!("{BIO_PREFIX}{}", request.name);
        if read(&name)?.is_none() {
            return Ok(UnsealResponse {
                status: "missing".into(),
                secret: None,
            });
        }
        if !self.verify_user(&request.title, &request.subtitle).await? {
            return Ok(UnsealResponse {
                status: "cancelled".into(),
                secret: None,
            });
        }
        Ok(UnsealResponse {
            status: "ok".into(),
            secret: read(&name)?,
        })
    }

    pub fn biometric_has(&self, request: NameRequest) -> Result<HasResponse> {
        Ok(HasResponse {
            present: read(&format!("{BIO_PREFIX}{}", request.name))?.is_some(),
        })
    }

    pub fn biometric_delete(&self, request: NameRequest) -> Result<()> {
        remove(&format!("{BIO_PREFIX}{}", request.name))
    }

    /// Screenshot protection exists on Android only.
    pub fn set_secure_window(&self, _request: SecureWindowRequest) -> Result<()> {
        Err(Error::Unsupported)
    }

    #[cfg(windows)]
    async fn verify_user(&self, title: &str, subtitle: &str) -> Result<bool> {
        let hwnd = self
            .0
            .get_webview_window("main")
            .and_then(|w| w.hwnd().ok())
            .map(|h| h.0 as isize)
            .ok_or_else(|| Error::Biometric("no main window".into()))?;
        let message = format!("{title} – {subtitle}");
        tauri::async_runtime::spawn_blocking(move || hello::verify(hwnd, &message))
            .await
            .map_err(|e| Error::Biometric(e.to_string()))?
            .map_err(Error::Biometric)
    }

    #[cfg(not(windows))]
    async fn verify_user(&self, _title: &str, _subtitle: &str) -> Result<bool> {
        let _ = &self.0;
        Err(Error::Unsupported)
    }
}

#[cfg(windows)]
fn biometric_available() -> bool {
    hello::available()
}

#[cfg(not(windows))]
fn biometric_available() -> bool {
    false
}
