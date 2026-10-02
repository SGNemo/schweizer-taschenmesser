//! The native messaging host manifest and where browsers look for it.
//!
//! Brave reads its own registry key (it does not fall back to Chrome's), so one entry per browser
//! is written under HKCU. Nothing here needs administrator rights.

use serde::Serialize;
use serde_json::json;
use std::path::{Path, PathBuf};

/// Registry sub-key / host name; also what the extension passes to `connectNative`.
pub const HOST_NAME: &str = "io.github.sgnemo.taschenmesser.vault";
/// Derived from the public key in `extension/manifest.json`; the only origin allowed to connect.
pub const EXTENSION_ID: &str = "olgcnfjmihlmpgjepkfbdjcpenckemaj";

pub fn allowed_origin() -> String {
    format!("chrome-extension://{EXTENSION_ID}/")
}

/// Chromium-family browsers and the `NativeMessagingHosts` key each one reads under HKCU.
pub const BROWSER_KEYS: [(&str, &str); 4] = [
    (
        "Brave",
        r"Software\BraveSoftware\Brave-Browser\NativeMessagingHosts",
    ),
    ("Chrome", r"Software\Google\Chrome\NativeMessagingHosts"),
    ("Edge", r"Software\Microsoft\Edge\NativeMessagingHosts"),
    ("Chromium", r"Software\Chromium\NativeMessagingHosts"),
];

/// What is registered for one browser.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BrowserStatus {
    pub browser: &'static str,
    /// The key exists and points at our manifest file.
    pub registered: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Registration {
    pub browsers: Vec<BrowserStatus>,
    /// The manifest file exists and names the executable that is running now.
    pub up_to_date: bool,
    pub manifest: PathBuf,
}

/// `Software\…\NativeMessagingHosts\io.github.sgnemo.taschenmesser.vault`
pub fn registry_subkey(base: &str) -> String {
    format!(r"{base}\{HOST_NAME}")
}

/// Where the manifest file lives inside the app's data folder.
pub fn manifest_path(data_dir: &Path) -> PathBuf {
    data_dir
        .join("native-messaging")
        .join(format!("{HOST_NAME}.json"))
}

/// The manifest for the executable at `exe`: one allowed origin, no wildcards.
pub fn host_manifest(exe: &Path) -> String {
    let manifest = json!({
        "name": HOST_NAME,
        "description": "Nemo vault bridge (talks to the desktop app, stores nothing)",
        "path": exe.to_string_lossy(),
        "type": "stdio",
        "allowed_origins": [allowed_origin()],
    });
    serde_json::to_string_pretty(&manifest).expect("manifest serialises")
}

/// Browsers start a host with the calling origin as the first argument
/// (`chrome-extension://<id>/`). Only the exact allowed origin counts.
pub fn origin_arg_allowed(arg: &str) -> bool {
    arg == allowed_origin()
}

/// True when `args` (without the program name) ask for host mode.
pub fn is_host_invocation(args: &[String]) -> bool {
    args.first()
        .is_some_and(|a| a.starts_with("chrome-extension://"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_has_exactly_one_origin_and_no_wildcard() {
        let text = host_manifest(Path::new(r"C:\Apps\Nemo\Nemo-Portable.exe"));
        let value: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert_eq!(value["name"], HOST_NAME);
        assert_eq!(value["type"], "stdio");
        assert_eq!(value["path"], r"C:\Apps\Nemo\Nemo-Portable.exe");
        let origins = value["allowed_origins"].as_array().unwrap();
        assert_eq!(origins.len(), 1);
        assert_eq!(origins[0], allowed_origin());
        assert!(!text.contains('*'));
    }

    #[test]
    fn only_the_exact_origin_is_allowed() {
        assert!(origin_arg_allowed(&allowed_origin()));
        for bad in [
            "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/",
            &format!("chrome-extension://{EXTENSION_ID}"),
            &format!("chrome-extension://{EXTENSION_ID}/x"),
            "https://example.com/",
            "",
        ] {
            assert!(!origin_arg_allowed(bad), "{bad}");
        }
    }

    #[test]
    fn host_mode_needs_an_extension_origin_as_first_argument() {
        let args = |v: &[&str]| v.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert!(is_host_invocation(&args(&[&allowed_origin()])));
        assert!(is_host_invocation(&args(&[
            &allowed_origin(),
            "--parent-window=1"
        ])));
        assert!(!is_host_invocation(&args(&["--autostart"])));
        assert!(!is_host_invocation(&args(&[])));
    }

    #[test]
    fn brave_and_chrome_have_their_own_keys() {
        let keys: Vec<_> = BROWSER_KEYS.iter().map(|(n, _)| *n).collect();
        assert!(keys.contains(&"Brave") && keys.contains(&"Chrome"));
        assert!(registry_subkey(BROWSER_KEYS[0].1).ends_with(HOST_NAME));
        assert!(BROWSER_KEYS[0].1.contains("BraveSoftware"));
    }

    #[test]
    fn manifest_lives_in_a_subfolder_of_the_data_dir() {
        let p = manifest_path(Path::new("data"));
        assert!(p.ends_with(format!("native-messaging/{HOST_NAME}.json")));
    }
}
