//! Windows Hello / "user consent verification": asks the user to verify (fingerprint, face, PIN)
//! before the sealed vault key is read from the Credential Manager.
//!
//! This is a *consent gate*, not a cryptographic binding: code running as the same Windows user could
//! read the credential without the prompt. It keeps other people at an unlocked PC out of the vault;
//! the master password remains the real protection (documented in CLAUDE.md).

use windows_future::IAsyncOperation;
use windows::{
    core::{factory, HSTRING},
    Security::Credentials::UI::{
        UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
    },
    Win32::{Foundation::HWND, System::WinRT::IUserConsentVerifierInterop},
};

pub fn available() -> bool {
    UserConsentVerifier::CheckAvailabilityAsync()
        .and_then(|op| op.get())
        .map(|a| a == UserConsentVerifierAvailability::Available)
        .unwrap_or(false)
}

/// `Ok(true)` verified, `Ok(false)` cancelled/failed by the user.
pub fn verify(hwnd: isize, message: &str) -> Result<bool, String> {
    let interop = factory::<UserConsentVerifier, IUserConsentVerifierInterop>()
        .map_err(|e| e.to_string())?;
    // SAFETY: `hwnd` is the handle of our own main window; `message` outlives the call.
    let op: IAsyncOperation<UserConsentVerificationResult> = unsafe {
        interop
            .RequestVerificationForWindowAsync(HWND(hwnd as _), &HSTRING::from(message))
            .map_err(|e| e.to_string())?
    };
    let result = op.get().map_err(|e| e.to_string())?;
    Ok(result == UserConsentVerificationResult::Verified)
}
