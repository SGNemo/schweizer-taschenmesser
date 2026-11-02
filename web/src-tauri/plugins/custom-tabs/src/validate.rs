//! What may be handed to a Custom Tab: only `http(s)` addresses with a host. Everything else
//! (`file:`, `javascript:`, `intent:`, `content:`, custom schemes) never reaches the system.

pub fn check_url(raw: &str) -> Result<(), &'static str> {
    if raw.len() > 8192 {
        return Err("too long");
    }
    let url = url::Url::parse(raw).map_err(|_| "not an address")?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("only http and https");
    }
    if url.host_str().is_none_or(str::is_empty) {
        return Err("no host");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::check_url;

    #[test]
    fn only_http_and_https_with_a_host() {
        assert!(check_url("https://example.org/a?b=1#c").is_ok());
        assert!(check_url("http://example.org").is_ok());
        for bad in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "intent://scan/#Intent;scheme=zxing;end",
            "content://com.android.contacts/contacts",
            "data:text/html,x",
            "magnet:?xt=urn:btih:abc",
            "https://",
            "not a url",
            "",
        ] {
            assert!(check_url(bad).is_err(), "{bad}");
        }
        assert!(check_url(&format!("https://example.org/{}", "a".repeat(9000))).is_err());
    }
}
