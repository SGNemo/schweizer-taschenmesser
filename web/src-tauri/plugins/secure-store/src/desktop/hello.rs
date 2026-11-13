//! Windows Hello key credentials (`KeyCredentialManager`) for the sealed vault key.
//!
//! The private key is created and kept by Windows Hello (in the TPM where the device has one) and is
//! only used after the person verifies (face, fingerprint, PIN). `sealed.rs` derives the wrapping key
//! from its signature, so the vault key in the Credential Manager is useless without that prompt.
//! Another process of the same Windows user can still ask Hello for a signature, but only through the
//! same visible prompt (launch review V2; decision in docs/decisions/distribution.md).
//!
//! All calls block until the person answers; callers run them on a blocking thread.

use std::{thread, time::Duration};

use windows::{
    core::{w, Array, HSTRING, PCWSTR},
    Security::{
        Credentials::{KeyCredentialCreationOption, KeyCredentialManager, KeyCredentialStatus},
        Cryptography::CryptographicBuffer,
    },
    Win32::UI::WindowsAndMessaging::{FindWindowW, SetForegroundWindow},
};

use super::sealed::{Ask, HelloKeys};
use crate::{Error, Result};

pub fn available() -> bool {
    KeyCredentialManager::IsSupportedAsync()
        .and_then(|op| op.get())
        .unwrap_or(false)
}

/// The Windows side of [`HelloKeys`].
pub struct WindowsHello;

impl HelloKeys for WindowsHello {
    fn create(&self, key: &str) -> Result<Ask<()>> {
        let op = KeyCredentialManager::RequestCreateAsync(
            &HSTRING::from(key),
            KeyCredentialCreationOption::ReplaceExisting,
        )
        .map_err(err)?;
        raise_prompt();
        let result = op.get().map_err(err)?;
        answer(result.Status().map_err(err)?)
    }

    fn sign(&self, key: &str, data: &[u8]) -> Result<Ask<Vec<u8>>> {
        let opened = KeyCredentialManager::OpenAsync(&HSTRING::from(key))
            .and_then(|op| op.get())
            .map_err(err)?;
        match answer(opened.Status().map_err(err)?)? {
            Ask::Done(()) => {}
            Ask::Cancelled => return Ok(Ask::Cancelled),
            Ask::Missing => return Ok(Ask::Missing),
        }
        let buffer = CryptographicBuffer::CreateFromByteArray(data).map_err(err)?;
        let op = opened
            .Credential()
            .and_then(|c| c.RequestSignAsync(&buffer))
            .map_err(err)?;
        raise_prompt();
        let signed = op.get().map_err(err)?;
        match answer(signed.Status().map_err(err)?)? {
            Ask::Done(()) => {}
            Ask::Cancelled => return Ok(Ask::Cancelled),
            Ask::Missing => return Ok(Ask::Missing),
        }
        let mut out = Array::<u8>::new();
        CryptographicBuffer::CopyToByteArray(&signed.Result().map_err(err)?, &mut out)
            .map_err(err)?;
        Ok(Ask::Done(out.to_vec()))
    }

    fn delete(&self, key: &str) {
        let _ = KeyCredentialManager::DeleteAsync(&HSTRING::from(key)).and_then(|op| op.get());
    }
}

fn answer(status: KeyCredentialStatus) -> Result<Ask<()>> {
    match status {
        KeyCredentialStatus::Success => Ok(Ask::Done(())),
        KeyCredentialStatus::UserCanceled | KeyCredentialStatus::UserPrefersPassword => {
            Ok(Ask::Cancelled)
        }
        KeyCredentialStatus::NotFound => Ok(Ask::Missing),
        other => Err(Error::Biometric(format!(
            "Windows Hello status {}",
            other.0
        ))),
    }
}

fn err(e: windows::core::Error) -> Error {
    Error::Biometric(e.message())
}

/// `KeyCredentialManager` has no "for window" variant: from a desktop app its prompt can open behind
/// the main window. Bring the Hello dialog to the front once it exists (best effort, ~3 s).
fn raise_prompt() {
    thread::spawn(|| {
        for _ in 0..30 {
            thread::sleep(Duration::from_millis(100));
            // SAFETY: plain Win32 calls with a static class name; no pointers are kept.
            unsafe {
                if let Ok(hwnd) = FindWindowW(w!("Credential Dialog Xaml Host"), PCWSTR::null()) {
                    if !hwnd.is_invalid() {
                        let _ = SetForegroundWindow(hwnd);
                        return;
                    }
                }
            }
        }
    });
}
