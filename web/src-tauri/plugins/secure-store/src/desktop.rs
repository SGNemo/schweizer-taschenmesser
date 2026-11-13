//! Desktop: `keyring` (Credential Manager on Windows) for secrets; the sealed vault key is wrapped
//! under a Windows Hello key (`desktop/sealed.rs`, `desktop/hello.rs`). Elsewhere the biometric gate
//! reports `unsupported`.

use keyring::{Entry, Error as KeyringError};
use serde::de::DeserializeOwned;
use std::sync::OnceLock;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::{models::*, Error, Result};

#[cfg(windows)]
mod hello;
// Used by the Windows build and the tests; elsewhere the biometric commands stop at `unsupported`.
#[cfg_attr(not(windows), allow(dead_code))]
mod sealed;

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

    /// The value is read inside Rust and dropped here (not wiped, like `get`); only the yes/no leaves.
    pub fn has(&self, request: NameRequest) -> Result<HasResponse> {
        Ok(HasResponse {
            present: is_present(read(&request.name)?.as_deref()),
        })
    }

    pub fn delete(&self, request: NameRequest) -> Result<()> {
        remove(&request.name)
    }

    pub async fn biometric_seal(&self, request: SealRequest) -> Result<()> {
        if !biometric_available() {
            return Err(Error::Unsupported);
        }
        // Checked before any prompt; the wrapped form is small, the raw secret must fit as well.
        validate_value(&request.secret).map_err(Error::Invalid)?;
        let name = request.name;
        let secret = zeroize::Zeroizing::new(request.secret);
        with_hello(move |hello| {
            let slot = KeyringSlot::bio(&name);
            sealed::seal(hello, &slot, &hello_key(&name), &slot.0, &secret)
        })
        .await
    }

    pub async fn biometric_unseal(&self, request: UnsealRequest) -> Result<UnsealResponse> {
        if !biometric_available() {
            return Err(Error::Unsupported);
        }
        let name = request.name;
        let unsealed = with_hello(move |hello| {
            let slot = KeyringSlot::bio(&name);
            sealed::unseal(hello, &slot, &hello_key(&name), &slot.0)
        })
        .await?;
        let (status, secret) = match unsealed {
            sealed::Unsealed::Ok(secret) => ("ok", Some(secret.to_string())),
            sealed::Unsealed::Cancelled => ("cancelled", None),
            sealed::Unsealed::Missing => ("missing", None),
            sealed::Unsealed::Invalidated => ("invalidated", None),
        };
        Ok(UnsealResponse {
            status: status.into(),
            secret,
        })
    }

    pub fn biometric_has(&self, request: NameRequest) -> Result<HasResponse> {
        Ok(HasResponse {
            present: read(&format!("{BIO_PREFIX}{}", request.name))?.is_some(),
        })
    }

    pub fn biometric_delete(&self, request: NameRequest) -> Result<()> {
        remove(&format!("{BIO_PREFIX}{}", request.name))?;
        #[cfg(windows)]
        sealed::HelloKeys::delete(&hello::WindowsHello, &hello_key(&request.name));
        Ok(())
    }

    /// The phone's "prove you are there" prompt; no desktop caller exists.
    pub async fn confirm_user(&self, _request: ConfirmRequest) -> Result<ConfirmResponse> {
        Err(Error::Unsupported)
    }

    /// Screenshot protection exists on Android only.
    pub fn set_secure_window(&self, _request: SecureWindowRequest) -> Result<()> {
        Err(Error::Unsupported)
    }
}

/// The keyring entry `bio:<name>` that holds the wrapped vault key.
struct KeyringSlot(String);

impl KeyringSlot {
    fn bio(name: &str) -> Self {
        Self(format!("{BIO_PREFIX}{name}"))
    }
}

impl sealed::Slot for KeyringSlot {
    fn read(&self) -> Result<Option<String>> {
        read(&self.0)
    }
    fn write(&self, value: &str) -> Result<()> {
        validate_value(value).map_err(Error::Invalid)?;
        entry(&self.0)?
            .set_password(value)
            .map_err(|e| Error::Keystore(e.to_string()))
    }
    fn remove(&self) -> Result<()> {
        remove(&self.0)
    }
}

/// Name of the Hello key credential: per app identifier (the Dev-Preview gets its own) and seal name.
fn hello_key(name: &str) -> String {
    format!("{}/{name}", service())
}

/// Hello calls block until the person answers: run them (and the keyring calls between) off the
/// async runtime.
#[cfg(windows)]
async fn with_hello<T: Send + 'static>(
    f: impl FnOnce(&dyn sealed::HelloKeys) -> Result<T> + Send + 'static,
) -> Result<T> {
    tauri::async_runtime::spawn_blocking(move || f(&hello::WindowsHello))
        .await
        .map_err(|e| Error::Biometric(e.to_string()))?
}

#[cfg(not(windows))]
async fn with_hello<T: Send + 'static>(
    _f: impl FnOnce(&dyn sealed::HelloKeys) -> Result<T> + Send + 'static,
) -> Result<T> {
    Err(Error::Unsupported)
}

#[cfg(windows)]
fn biometric_available() -> bool {
    hello::available()
}

#[cfg(not(windows))]
fn biometric_available() -> bool {
    false
}
