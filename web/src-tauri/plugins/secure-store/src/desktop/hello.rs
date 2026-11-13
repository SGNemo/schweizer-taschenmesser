//! Windows Hello key credentials (`KeyCredentialManager`) for the sealed vault key.
//!
//! The private key is created and kept by Windows Hello (in the TPM where the device has one) and is
//! only used after the person verifies (face, fingerprint, PIN). `sealed.rs` derives the wrapping key
//! from its signature, so the vault key in the Credential Manager is useless without that prompt.
//! Limits (launch review V2; decision in docs/decisions/distribution.md):
//! - another process of the same Windows user can still ask Hello for a signature, but only through
//!   the visible prompt, and that prompt is generic (Windows shows no app text; the `title`/`subtitle`
//!   of the request are not used here), so the person cannot tell it from ours;
//! - such a process can delete the Hello key without a prompt: biometric unlock then reports
//!   `invalidated`, the master password still opens the vault;
//! - the binding assumes deterministic signatures (RSA PKCS#1 v1.5, what Hello uses); only the hand
//!   test KS-14 (second unlock after enabling) checks this on a real device.
//!
//! All calls block until the person answers; callers run them on a blocking thread.

use std::{thread, time::Duration};

use windows::{
    core::{w, Array, HSTRING, PCWSTR},
    Security::{
        Credentials::{
            KeyCredential, KeyCredentialCreationOption, KeyCredentialManager, KeyCredentialStatus,
        },
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
    fn create_and_sign(&self, key: &str, data: &[u8]) -> Result<Ask<Vec<u8>>> {
        let op = KeyCredentialManager::RequestCreateAsync(
            &HSTRING::from(key),
            KeyCredentialCreationOption::ReplaceExisting,
        )
        .map_err(err)?;
        raise_prompt();
        let created = op.get().map_err(err)?;
        match answer(created.Status().map_err(err)?)? {
            Ask::Done(()) => sign_with(&created.Credential().map_err(err)?, data),
            Ask::Cancelled => Ok(Ask::Cancelled),
            Ask::Missing => Ok(Ask::Missing),
        }
    }

    fn sign(&self, key: &str, data: &[u8]) -> Result<Ask<Vec<u8>>> {
        let opened = KeyCredentialManager::OpenAsync(&HSTRING::from(key))
            .and_then(|op| op.get())
            .map_err(err)?;
        match answer(opened.Status().map_err(err)?)? {
            Ask::Done(()) => sign_with(&opened.Credential().map_err(err)?, data),
            Ask::Cancelled => Ok(Ask::Cancelled),
            Ask::Missing => Ok(Ask::Missing),
        }
    }

    fn delete(&self, key: &str) {
        let _ = KeyCredentialManager::DeleteAsync(&HSTRING::from(key)).and_then(|op| op.get());
    }
}

/// Signs with an already opened or just created key: one prompt, no second lookup.
fn sign_with(credential: &KeyCredential, data: &[u8]) -> Result<Ask<Vec<u8>>> {
    let buffer = CryptographicBuffer::CreateFromByteArray(data).map_err(err)?;
    let op = credential.RequestSignAsync(&buffer).map_err(err)?;
    raise_prompt();
    let signed = op.get().map_err(err)?;
    match answer(signed.Status().map_err(err)?)? {
        Ask::Done(()) => {}
        Ask::Cancelled => return Ok(Ask::Cancelled),
        Ask::Missing => return Ok(Ask::Missing),
    }
    let mut out = Array::<u8>::new();
    CryptographicBuffer::CopyToByteArray(&signed.Result().map_err(err)?, &mut out).map_err(err)?;
    Ok(Ask::Done(out.to_vec()))
}

fn answer(status: KeyCredentialStatus) -> Result<Ask<()>> {
    match status {
        KeyCredentialStatus::Success => Ok(Ask::Done(())),
        // Locked out for now (too many wrong PINs, TPM lockout): like a cancel, the seal stays
        // valid; an error would make the app say "no longer valid" and ask to re-enable.
        KeyCredentialStatus::UserCanceled
        | KeyCredentialStatus::UserPrefersPassword
        | KeyCredentialStatus::SecurityDeviceLocked => Ok(Ask::Cancelled),
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
/// the main window. Bring the Hello dialog to the front once it exists (best effort, up to 10 s; the
/// class name is not documented and matches any Hello dialog on the desktop, so this only ever
/// raises a window, it never decides anything).
fn raise_prompt() {
    thread::spawn(|| {
        for _ in 0..100 {
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
