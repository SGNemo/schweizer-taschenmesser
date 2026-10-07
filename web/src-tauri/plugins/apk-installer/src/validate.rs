//! Pure checks on a download request, applied before anything reaches the Kotlin side: the APK
//! must be a release asset of this repository and the caller must name the expected SHA-256.
//! No dependencies, so the checks compile and test on every host.

/// Only release assets of this repository may be installed.
const RELEASE_PREFIX: &str = "https://github.com/SGNemo/schweizer-taschenmesser/releases/download/";
const MAX_URL_LEN: usize = 512;

/// `Ok` when `url` is `https://github.com/SGNemo/schweizer-taschenmesser/releases/download/<tag>/<name>.apk`
/// with plain path segments only (no query, fragment, userinfo, dot or empty segments).
pub fn check_url(url: &str) -> Result<(), &'static str> {
    if url.len() > MAX_URL_LEN {
        return Err("url-too-long");
    }
    let rest = url
        .strip_prefix(RELEASE_PREFIX)
        .ok_or("url-not-a-release-asset")?;
    if !rest.bytes().all(|b| b.is_ascii_graphic()) {
        return Err("url-has-unexpected-characters");
    }
    if rest.contains(['?', '#', '@', '\\']) {
        return Err("url-has-query-fragment-or-userinfo");
    }
    let segments: Vec<&str> = rest.split('/').collect();
    if segments.len() != 2 {
        return Err("url-not-a-release-asset");
    }
    if segments
        .iter()
        .any(|s| s.is_empty() || *s == "." || *s == "..")
    {
        return Err("url-has-dot-or-empty-segments");
    }
    if !segments[1].ends_with(".apk") || segments[1] == ".apk" {
        return Err("url-not-an-apk");
    }
    Ok(())
}

/// `Ok` when `sha256` is exactly 64 lowercase hex characters.
pub fn check_sha256(sha256: Option<&str>) -> Result<(), &'static str> {
    let digest = sha256.ok_or("sha256-missing")?;
    let hex_lower = |b: u8| b.is_ascii_digit() || (b'a'..=b'f').contains(&b);
    if digest.len() == 64 && digest.bytes().all(hex_lower) {
        Ok(())
    } else {
        Err("sha256-not-64-lowercase-hex")
    }
}

/// Both checks; the first failure wins.
pub fn check_download(url: &str, sha256: Option<&str>) -> Result<(), &'static str> {
    check_url(url)?;
    check_sha256(sha256)
}

#[cfg(test)]
mod tests {
    use super::*;

    const OK_URL: &str =
        "https://github.com/SGNemo/schweizer-taschenmesser/releases/download/v1.2.0/Nemo.apk";
    const OK_SHA: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    #[test]
    fn accepts_release_apks_of_this_repository() {
        for url in [
            OK_URL,
            "https://github.com/SGNemo/schweizer-taschenmesser/releases/download/v1.2.0-beta.1/Taschenmesser.apk",
            "https://github.com/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/Nemo-dev.apk",
        ] {
            assert_eq!(check_url(url), Ok(()), "{url}");
        }
        assert_eq!(check_download(OK_URL, Some(OK_SHA)), Ok(()));
    }

    #[test]
    fn rejects_other_hosts_repositories_schemes_and_paths() {
        for bad in [
            "http://github.com/SGNemo/schweizer-taschenmesser/releases/download/v1/Nemo.apk",
            "https://evil.example/SGNemo/schweizer-taschenmesser/releases/download/v1/Nemo.apk",
            "https://github.com.evil.example/SGNemo/schweizer-taschenmesser/releases/download/v1/Nemo.apk",
            "https://github.com/other/repo/releases/download/v1/Nemo.apk",
            "https://github.com/SGNemo/schweizer-taschenmesser-fork/releases/download/v1/Nemo.apk",
            "https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Nemo.apk",
            "https://github.com/SGNemo/schweizer-taschenmesser/archive/v1/Nemo.apk",
            "https://GitHub.com/SGNemo/schweizer-taschenmesser/releases/download/v1/Nemo.apk",
            "",
            "not a url",
        ] {
            assert!(check_url(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn rejects_userinfo_query_fragment_and_tricks() {
        let prefix = "https://github.com/SGNemo/schweizer-taschenmesser/releases/download/";
        for bad in [
            "https://user:pw@github.com/SGNemo/schweizer-taschenmesser/releases/download/v1/Nemo.apk".to_owned(),
            "https://github.com:443/SGNemo/schweizer-taschenmesser/releases/download/v1/Nemo.apk".to_owned(),
            format!("{prefix}v1/Nemo.apk?x=1"),
            format!("{prefix}v1/Nemo.apk#frag"),
            format!("{prefix}v1@evil/Nemo.apk"),
            format!("{prefix}../../evil/Nemo.apk"),
            format!("{prefix}./Nemo.apk"),
            format!("{prefix}v1//Nemo.apk"),
            format!("{prefix}v1/"),
            format!("{prefix}v1"),
            format!("{prefix}v1/sub/Nemo.apk"),
            format!("{prefix}v1/Nemo.exe"),
            format!("{prefix}v1/.apk"),
            format!("{prefix}v1/Nemo.apk\\"),
            format!("{prefix}v1/Nemo .apk"),
            format!("{prefix}v1/Nemo\u{e4}.apk"),
            format!("{prefix}v1/{}.apk", "a".repeat(600)),
        ] {
            assert!(check_url(&bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn sha256_must_be_64_lowercase_hex() {
        assert_eq!(check_sha256(Some(OK_SHA)), Ok(()));
        for bad in [
            None,
            Some(""),
            Some(&OK_SHA[..63]),
            Some(&OK_SHA.to_uppercase()),
            Some(" 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde"),
            Some("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefg"),
            Some("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg"),
        ] {
            assert!(check_sha256(bad).is_err(), "{bad:?}");
        }
        assert!(check_download(OK_URL, None).is_err());
        assert!(check_download(OK_URL, Some("abc")).is_err());
    }
}
