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

/// Classify a navigation target. `about:blank` is allowed (a new, empty tab).
pub fn classify(url: &Url) -> Verdict {
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
            let url = Url::parse(bad).unwrap();
            let want = if bad.starts_with("http://ipc.localhost") {
                Verdict::WarnHttp // plain http host; isolation does not rely on the scheme, see capabilities
            } else {
                Verdict::Deny
            };
            assert_eq!(classify(&url), want, "{bad}");
        }
    }
}
