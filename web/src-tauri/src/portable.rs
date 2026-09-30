//! Self-update of the portable Windows build (a single `Nemo-Portable.exe`; the legacy name
//! `Taschenmesser-Portable.exe` is still accepted, see `PORTABLE_ASSETS`).
//!
//! `tauri-plugin-updater` cannot install a raw executable, so it only checks, downloads and verifies
//! (minisign, mandatory). This module adds the two pieces around it:
//! * `verify_payload` – a second, independent signature check of the bytes we are about to write
//!   over the running program (defence in depth, and testable without the plugin);
//! * `swap` – replaces the running executable: write `<exe>.new`, rename the running exe to
//!   `<exe>.old` (Windows allows renaming a running image), move `.new` into place; every failure
//!   after the first rename restores the original. `cleanup` removes leftovers at the next start.

#![cfg_attr(not(windows), allow(dead_code))]

use std::fmt;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use base64::Engine;
use minisign_verify::{PublicKey, Signature};

/// Why an update could not be applied. The code (see `code`) is what the UI maps to a German text.
#[derive(Debug, PartialEq, Eq)]
pub enum SwapError {
    /// The folder of the executable cannot be written (read-only medium, no permission).
    FolderNotWritable(String),
    /// A rename failed; the previous executable has been restored.
    Failed(String),
    /// The payload is not a Windows executable.
    NotAnExecutable,
}

impl SwapError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::FolderNotWritable(_) => "folder-not-writable",
            Self::Failed(_) => "swap-failed",
            Self::NotAnExecutable => "not-an-executable",
        }
    }
}

impl fmt::Display for SwapError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::FolderNotWritable(d) | Self::Failed(d) => write!(f, "{}: {d}", self.code()),
            Self::NotAnExecutable => write!(f, "{}", self.code()),
        }
    }
}

/// File system operations the swap needs; a trait so tests can make single steps fail.
pub trait Fs {
    fn write(&self, path: &Path, bytes: &[u8]) -> io::Result<()>;
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()>;
    fn remove(&self, path: &Path) -> io::Result<()>;
}

pub struct RealFs;

impl Fs for RealFs {
    fn write(&self, path: &Path, bytes: &[u8]) -> io::Result<()> {
        use std::io::Write;
        let mut file = std::fs::File::create(path)?;
        file.write_all(bytes)?;
        file.sync_all()
    }
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
        std::fs::rename(from, to)
    }
    fn remove(&self, path: &Path) -> io::Result<()> {
        std::fs::remove_file(path)
    }
}

/// `<exe>.new` / `<exe>.old` next to the executable.
pub fn sibling(exe: &Path, suffix: &str) -> PathBuf {
    let mut name = exe.file_name().unwrap_or_default().to_os_string();
    name.push(".");
    name.push(suffix);
    exe.with_file_name(name)
}

/// A Windows executable starts with the DOS header magic. Catches an HTML error page or an empty body.
pub fn looks_like_executable(bytes: &[u8]) -> bool {
    bytes.len() >= 2 && &bytes[..2] == b"MZ"
}

/// Verifies `bytes` against a minisign signature (base64 of the `.sig` file, as in `latest.json`) with
/// the base64 minisign public key from `plugins.updater.pubkey`.
pub fn verify_payload(bytes: &[u8], signature_b64: &str, pubkey_b64: &str) -> Result<(), String> {
    let decode = |input: &str| -> Result<String, String> {
        let raw = base64::engine::general_purpose::STANDARD
            .decode(input.trim())
            .map_err(|e| format!("invalid base64: {e}"))?;
        String::from_utf8(raw).map_err(|e| format!("invalid utf-8: {e}"))
    };
    let public_key = PublicKey::decode(&decode(pubkey_b64)?).map_err(|e| e.to_string())?;
    let signature = Signature::decode(&decode(signature_b64)?).map_err(|e| e.to_string())?;
    public_key
        .verify(bytes, &signature, true)
        .map_err(|e| format!("signature does not match: {e}"))
}

/// Replaces `exe` by `bytes`. On any failure the previous executable is in place again.
pub fn swap(fs: &dyn Fs, exe: &Path, bytes: &[u8]) -> Result<(), SwapError> {
    if !looks_like_executable(bytes) {
        return Err(SwapError::NotAnExecutable);
    }
    let new = sibling(exe, "new");
    let old = sibling(exe, "old");

    if let Err(e) = fs.write(&new, bytes) {
        let _ = fs.remove(&new);
        return Err(SwapError::FolderNotWritable(e.to_string()));
    }
    // A leftover of an earlier update may still be there.
    let _ = fs.remove(&old);

    if let Err(e) = fs.rename(exe, &old) {
        let _ = fs.remove(&new);
        return Err(SwapError::FolderNotWritable(e.to_string()));
    }
    if let Err(e) = fs.rename(&new, exe) {
        // Put the original back; only then report the failure.
        let restored = fs.rename(&old, exe);
        let _ = fs.remove(&new);
        return Err(SwapError::Failed(match restored {
            Ok(()) => e.to_string(),
            Err(r) => format!("{e}; restoring the previous version failed too: {r}"),
        }));
    }
    Ok(())
}

/// Undoes a `swap` whose new executable could not be started: the previous version is renamed back.
pub fn rollback(fs: &dyn Fs, exe: &Path) -> Result<(), SwapError> {
    let old = sibling(exe, "old");
    fs.rename(&old, exe)
        .map_err(|e| SwapError::Failed(format!("rollback failed: {e}")))
}

/// Removes update leftovers next to the executable (best effort; a still-running old image stays locked).
pub fn cleanup(fs: &dyn Fs, exe: &Path) {
    for suffix in ["old", "new"] {
        let path = sibling(exe, suffix);
        if path.exists() {
            let _ = fs.remove(&path);
        }
    }
}

/// Argument the previous version passes when it starts the new executable.
pub const UPDATED_FLAG: &str = "--updated";

/// Portable mode: a folder `data/` next to the executable holds the WebView2 profile (USB stick).
/// Without it the profile lives in the user's local app data, shared with a formerly installed version.
pub fn data_dir(exe: &Path) -> Option<PathBuf> {
    let dir = exe.parent()?.join("data");
    dir.is_dir().then_some(dir)
}

/// Housekeeping at program start: after an update wait for the previous process, then remove leftovers.
pub fn startup(exe: &Path, args: &[String]) {
    if args.iter().any(|a| a == UPDATED_FLAG) {
        wait_for_previous_instance(&RealFs, exe, Duration::from_secs(15));
    }
    cleanup(&RealFs, exe);
}

/// Started with `--updated`: the previous process is still shutting down and holds the WebView2 profile
/// and its `.old` image. Wait (max. `limit`) until the old image can be deleted, i.e. that process is gone.
pub fn wait_for_previous_instance(fs: &dyn Fs, exe: &Path, limit: Duration) {
    let old = sibling(exe, "old");
    let start = Instant::now();
    while old.exists() && start.elapsed() < limit {
        if fs.remove(&old).is_ok() {
            return;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    // Throwaway key pair created only for these tests (the private key was discarded).
    const PUBKEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDcyOEU1MEUwOTFBNkI2QTAKUldTZ3RxYVI0RkNPY2tyaHNMVmtOTnlKL2tLR3A3cTBmKzAxYnlQb1RLdmNaaDBnMjE4VjFJMVMK";
    const SIGNATURE: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVTZ3RxYVI0RkNPY3U1VjZONFlZdzJEVVU4N2ZyYm41ZkIrV25XQU1iaDFGNUhVNExIL2VvR2NPUFFUN2w1RzhwVWhQa0krM2RuNWpvNmFQSFR4M1RVVkVWeFdlTXg5TWdFPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzkwNzIwMTY0CWZpbGU6cGF5bG9hZC5iaW4KWTR6MW5XVnlWUTByN3NCanpjZmRoaGZNczl0TzZ3QWliZVRLdllnL1owYUNUVzZ0NjdZMlYzY3NnendPdTVYYzY5b3BHMDBEU3BOenVmMTZyNjFTRHc9PQo=";
    const PAYLOAD: &[u8] = b"MZ-portable-fixture-payload";
    // The key of the real releases must never verify the fixture.
    const OTHER_PUBKEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDNDREU2NEMxNEY0OTI3N0UKUldSK0owbFB3V1RlUEVQL2lDS28rdk1ud3BTdEU1bElzQjlOQWVCTUpINVZaL24yMWpuV2lDREIK";

    #[test]
    fn accepts_a_valid_signature() {
        assert!(verify_payload(PAYLOAD, SIGNATURE, PUBKEY).is_ok());
    }

    #[test]
    fn rejects_tampered_payload_wrong_key_and_garbage() {
        let mut tampered = PAYLOAD.to_vec();
        tampered[5] ^= 0x01;
        assert!(verify_payload(&tampered, SIGNATURE, PUBKEY).is_err());
        assert!(verify_payload(PAYLOAD, SIGNATURE, OTHER_PUBKEY).is_err());
        assert!(verify_payload(PAYLOAD, "", PUBKEY).is_err());
        assert!(verify_payload(PAYLOAD, "not base64!", PUBKEY).is_err());
        assert!(verify_payload(PAYLOAD, SIGNATURE, "").is_err());
    }

    fn dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("tm-portable-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn swap_replaces_the_executable_and_keeps_the_old_one() {
        let d = dir("swap");
        let exe = d.join("Taschenmesser-Portable.exe");
        std::fs::write(&exe, b"MZ-old").unwrap();
        swap(&RealFs, &exe, b"MZ-new").unwrap();
        assert_eq!(std::fs::read(&exe).unwrap(), b"MZ-new");
        assert_eq!(std::fs::read(sibling(&exe, "old")).unwrap(), b"MZ-old");
        assert!(!sibling(&exe, "new").exists());

        // Cleanup at the next start removes the leftovers.
        cleanup(&RealFs, &exe);
        assert!(!sibling(&exe, "old").exists());
        assert_eq!(std::fs::read(&exe).unwrap(), b"MZ-new");
        std::fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn rollback_restores_the_previous_executable() {
        let d = dir("rollback");
        let exe = d.join("app.exe");
        std::fs::write(&exe, b"MZ-old").unwrap();
        swap(&RealFs, &exe, b"MZ-new").unwrap();
        rollback(&RealFs, &exe).unwrap();
        assert_eq!(std::fs::read(&exe).unwrap(), b"MZ-old");
        std::fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn refuses_a_payload_that_is_not_an_executable() {
        let d = dir("html");
        let exe = d.join("app.exe");
        std::fs::write(&exe, b"MZ-old").unwrap();
        let err = swap(&RealFs, &exe, b"<html>404</html>").unwrap_err();
        assert_eq!(err, SwapError::NotAnExecutable);
        assert_eq!(std::fs::read(&exe).unwrap(), b"MZ-old");
        assert!(!sibling(&exe, "new").exists());
        std::fs::remove_dir_all(d).unwrap();
    }

    /// Lets the n-th call of one operation fail.
    struct Failing {
        fail_write: bool,
        fail_rename_at: Option<usize>,
        renames: Cell<usize>,
    }

    impl Fs for Failing {
        fn write(&self, path: &Path, bytes: &[u8]) -> io::Result<()> {
            if self.fail_write {
                Err(io::Error::new(io::ErrorKind::PermissionDenied, "read-only"))
            } else {
                RealFs.write(path, bytes)
            }
        }
        fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
            let n = self.renames.get() + 1;
            self.renames.set(n);
            if self.fail_rename_at == Some(n) {
                Err(io::Error::other("boom"))
            } else {
                RealFs.rename(from, to)
            }
        }
        fn remove(&self, path: &Path) -> io::Result<()> {
            RealFs.remove(path)
        }
    }

    fn failing(write: bool, rename_at: Option<usize>) -> Failing {
        Failing {
            fail_write: write,
            fail_rename_at: rename_at,
            renames: Cell::new(0),
        }
    }

    #[test]
    fn unwritable_folder_leaves_everything_untouched() {
        let d = dir("ro");
        let exe = d.join("app.exe");
        std::fs::write(&exe, b"MZ-old").unwrap();
        let err = swap(&failing(true, None), &exe, b"MZ-new").unwrap_err();
        assert_eq!(err.code(), "folder-not-writable");
        assert_eq!(std::fs::read(&exe).unwrap(), b"MZ-old");
        assert!(!sibling(&exe, "new").exists());
        std::fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn a_failing_second_rename_restores_the_original() {
        let d = dir("second");
        let exe = d.join("app.exe");
        std::fs::write(&exe, b"MZ-old").unwrap();
        // rename #1 exe -> .old works, #2 .new -> exe fails, #3 (.old -> exe) is the restore.
        let err = swap(&failing(false, Some(2)), &exe, b"MZ-new").unwrap_err();
        assert_eq!(err.code(), "swap-failed");
        assert_eq!(std::fs::read(&exe).unwrap(), b"MZ-old");
        assert!(!sibling(&exe, "new").exists());
        std::fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn a_failing_first_rename_is_reported_as_unwritable_and_changes_nothing() {
        let d = dir("first");
        let exe = d.join("app.exe");
        std::fs::write(&exe, b"MZ-old").unwrap();
        let err = swap(&failing(false, Some(1)), &exe, b"MZ-new").unwrap_err();
        assert_eq!(err.code(), "folder-not-writable");
        assert_eq!(std::fs::read(&exe).unwrap(), b"MZ-old");
        assert!(!sibling(&exe, "new").exists());
        std::fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn portable_mode_needs_an_existing_data_folder() {
        let d = dir("data");
        let exe = d.join("app.exe");
        assert_eq!(data_dir(&exe), None);
        std::fs::create_dir(d.join("data")).unwrap();
        assert_eq!(data_dir(&exe), Some(d.join("data")));
        // A file called `data` does not switch the mode on.
        std::fs::remove_dir(d.join("data")).unwrap();
        std::fs::write(d.join("data"), b"x").unwrap();
        assert_eq!(data_dir(&exe), None);
        std::fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn waiting_returns_at_once_without_a_leftover() {
        let d = dir("wait");
        let exe = d.join("app.exe");
        let started = Instant::now();
        wait_for_previous_instance(&RealFs, &exe, Duration::from_secs(5));
        assert!(started.elapsed() < Duration::from_secs(1));
        std::fs::remove_dir_all(d).unwrap();
    }
}
