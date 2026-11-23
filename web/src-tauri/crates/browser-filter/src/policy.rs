use url::Url;

/// What the browser does with a navigation target.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Verdict {
    /// `https:` – load.
    Allow,
    /// `http:` – show the warning first; the user may continue.
    WarnHttp,
    /// Anything else (`file:`, `javascript:`, `data:`, `blob:`, custom schemes, `ipc:` …) – never loaded.
    Deny,
}

/// The app's own origins on Windows (WebView2 serves the app and its IPC under these names). A
/// browser tab never loads them, whatever the scheme (B2, launch review 2026-11).
const APP_HOSTS: [&str; 2] = ["tauri.localhost", "ipc.localhost"];

fn is_app_host(url: &Url) -> bool {
    url.host_str().is_some_and(|h| {
        let h = h.trim_end_matches('.').to_ascii_lowercase();
        APP_HOSTS
            .iter()
            .any(|a| h == *a || h.ends_with(&format!(".{a}")))
    })
}

/// Classify a navigation target. `about:blank` is allowed (a new, empty tab).
pub fn classify(url: &Url) -> Verdict {
    if is_app_host(url) {
        return Verdict::Deny;
    }
    match url.scheme() {
        "https" => Verdict::Allow,
        "http" => Verdict::WarnHttp,
        "about" if url.as_str() == "about:blank" => Verdict::Allow,
        _ => Verdict::Deny,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(s: &str) -> Verdict {
        classify(&Url::parse(s).unwrap())
    }

    #[test]
    fn https_http_and_the_rest() {
        assert_eq!(v("https://example.org/a"), Verdict::Allow);
        assert_eq!(v("http://example.org"), Verdict::WarnHttp);
        assert_eq!(v("about:blank"), Verdict::Allow);
        for bad in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "data:text/html,hi",
            "blob:https://example.org/x",
            "ipc://localhost/cmd",
            "tauri://localhost/",
            "http://ipc.localhost/cmd",
            "magnet:?xt=urn:btih:abc",
            "about:srcdoc",
        ] {
            assert_eq!(v(bad), Verdict::Deny, "{bad}");
        }
    }

    #[test]
    fn the_apps_own_hosts_are_never_loaded_in_a_tab() {
        for bad in [
            "http://tauri.localhost/",
            "https://tauri.localhost/index.html",
            "http://ipc.localhost/plugin%3Ashell%7Copen",
            "https://IPC.localhost./x",
            "http://x.tauri.localhost/",
        ] {
            assert_eq!(v(bad), Verdict::Deny, "{bad}");
        }
        assert_eq!(v("https://localhost.example/"), Verdict::Allow);
        assert_eq!(v("http://localhost:8080/"), Verdict::WarnHttp);
    }
}
