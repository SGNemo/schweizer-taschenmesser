//! Windows: the app is a single portable executable, so nothing installs the WebView2 runtime for it.
//! Without the runtime Tauri would fail while creating the window; instead we check for it first and
//! explain the problem (German message box with the download page) rather than exiting silently.

/// Microsoft's download page for the WebView2 runtime ("Evergreen Bootstrapper").
#[cfg_attr(not(windows), allow(dead_code))]
pub const DOWNLOAD_URL: &str = "https://developer.microsoft.com/microsoft-edge/webview2/";

/// The client id of the Evergreen runtime in the EdgeUpdate registry hive.
#[cfg_attr(not(windows), allow(dead_code))]
const CLIENT_KEY: &str =
    r"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";

#[cfg_attr(not(windows), allow(dead_code))]
const CLIENT_KEY_WOW64: &str =
    r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";

/// The `pv` value holds the installed version; it is missing or `0.0.0.0` when the runtime is absent.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn is_usable_version(pv: Option<&str>) -> bool {
    match pv.map(str::trim) {
        Some(v) if !v.is_empty() => {
            v != "0.0.0.0" && v.chars().next().is_some_and(|c| c.is_ascii_digit())
        }
        _ => false,
    }
}

#[cfg_attr(not(windows), allow(dead_code))]
pub const MESSAGE_TITLE: &str = "Nemo – WebView2 fehlt";
#[cfg_attr(not(windows), allow(dead_code))]
pub const MESSAGE_TEXT: &str = "Nemo braucht die Microsoft-Komponente „WebView2“, die auf diesem Computer nicht gefunden wurde.\n\nKlicke auf „OK“, um die Download-Seite zu öffnen. Installiere dort die „Evergreen Bootstrapper“-Version und starte Nemo danach erneut.";

#[cfg(windows)]
mod imp {
    use super::*;
    use windows::core::{w, HSTRING};
    use windows::Win32::Foundation::ERROR_SUCCESS;
    use windows::Win32::System::Registry::{
        RegGetValueW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ,
    };
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, IDOK, MB_ICONERROR, MB_OKCANCEL, SW_SHOWNORMAL,
    };

    fn read_pv(root: HKEY, subkey: &str) -> Option<String> {
        let subkey = HSTRING::from(subkey);
        let mut buffer = [0u16; 64];
        let mut bytes = (buffer.len() * 2) as u32;
        // SAFETY: `buffer` is valid for `bytes` bytes; the API writes at most that many.
        let status = unsafe {
            RegGetValueW(
                root,
                &subkey,
                w!("pv"),
                RRF_RT_REG_SZ,
                None,
                Some(buffer.as_mut_ptr().cast()),
                Some(&mut bytes),
            )
        };
        if status != ERROR_SUCCESS {
            return None;
        }
        let chars = (bytes as usize / 2).saturating_sub(1).min(buffer.len());
        Some(String::from_utf16_lossy(&buffer[..chars]))
    }

    fn runtime_installed() -> bool {
        // 64-bit machine-wide installs live under WOW6432Node; per-user installs under HKCU.
        let places = [
            (HKEY_LOCAL_MACHINE, CLIENT_KEY_WOW64),
            (HKEY_LOCAL_MACHINE, CLIENT_KEY),
            (HKEY_CURRENT_USER, CLIENT_KEY),
        ];
        places
            .into_iter()
            .any(|(root, key)| is_usable_version(read_pv(root, key).as_deref()))
    }

    /// `true` = the runtime is there (or we cannot tell – then Tauri decides itself).
    pub fn ensure_runtime() -> bool {
        if runtime_installed() {
            return true;
        }
        // SAFETY: plain Win32 calls with valid, NUL-terminated wide strings.
        unsafe {
            let answer = MessageBoxW(
                None,
                &HSTRING::from(MESSAGE_TEXT),
                &HSTRING::from(MESSAGE_TITLE),
                MB_OKCANCEL | MB_ICONERROR,
            );
            if answer == IDOK {
                ShellExecuteW(
                    None,
                    w!("open"),
                    &HSTRING::from(DOWNLOAD_URL),
                    None,
                    None,
                    SW_SHOWNORMAL,
                );
            }
        }
        false
    }
}

#[cfg(windows)]
pub use imp::ensure_runtime;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognises_installed_and_missing_runtimes() {
        assert!(is_usable_version(Some("131.0.2903.112")));
        assert!(is_usable_version(Some(" 120.0.1 ")));
        assert!(!is_usable_version(Some("0.0.0.0")));
        assert!(!is_usable_version(Some("")));
        assert!(!is_usable_version(Some("   ")));
        assert!(!is_usable_version(Some("n/a")));
        assert!(!is_usable_version(None));
    }

    #[test]
    fn the_message_points_to_the_download_page() {
        assert!(DOWNLOAD_URL.starts_with("https://"));
        assert!(MESSAGE_TEXT.contains("WebView2"));
    }
}
