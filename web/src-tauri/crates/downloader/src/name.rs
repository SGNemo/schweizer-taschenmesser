use std::path::{Path, PathBuf};


fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3])
                .ok()
                .and_then(|h| u8::from_str_radix(h, 16).ok());
            if let Some(v) = hex {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// A safe single file name: the cleaner the device exchange uses (`file_names::clean`: last
/// segment only, no control, format or bidi characters, no characters Windows rejects, no device
/// names, shortcut types defused, length capped with the extension kept). Never empty.
pub fn sanitize_file_name(raw: &str) -> String {
    file_names::clean(raw)
}

/// Name from a `Content-Disposition` header (`filename*=UTF-8''…` wins over `filename=`), sanitised.
pub fn file_name_from_disposition(header: &str) -> Option<String> {
    let lower = header.to_ascii_lowercase();
    if let Some(i) = lower.find("filename*=") {
        let rest = &header[i + 10..];
        let value = rest.split(';').next().unwrap_or("").trim();
        let encoded = value.splitn(3, '\'').nth(2).unwrap_or(value);
        let name = sanitize_file_name(&percent_decode(encoded));
        return Some(name);
    }
    let i = lower.find("filename=")?;
    let value = header[i + 9..].split(';').next().unwrap_or("").trim();
    Some(sanitize_file_name(value.trim_matches('"')))
}

/// File name for a URL: last path segment, percent-decoded, sanitised; `download` when there is none.
pub fn file_name_from_url(url: &url::Url) -> String {
    let seg = url
        .path_segments()
        .and_then(|mut s| s.next_back())
        .unwrap_or("");
    let decoded = percent_decode(seg);
    if decoded.trim_matches(['.', ' ', '/', '\\']).is_empty() {
        return "download".into();
    }
    sanitize_file_name(&decoded)
}

/// `name`, or `name (1).ext`, `name (2).ext` … – the first one that does not exist in `dir`
/// (also counting `.part` files of other jobs, so two jobs never write the same file).
pub fn unique_name(dir: &Path, name: &str, taken: &dyn Fn(&str) -> bool) -> String {
    let exists =
        |n: &str| dir.join(n).exists() || dir.join(format!("{n}.part")).exists() || taken(n);
    if !exists(name) {
        return name.to_string();
    }
    let path = PathBuf::from(name);
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let ext = path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    (1..10_000)
        .map(|i| format!("{stem} ({i}){ext}"))
        .find(|n| !exists(n))
        .unwrap_or_else(|| format!("{stem} (copy){ext}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitises() {
        assert_eq!(sanitize_file_name("../../etc/passwd"), "passwd");
        assert_eq!(sanitize_file_name("a\\b\\c.txt"), "c.txt");
        assert_eq!(
            sanitize_file_name("we<ir>d:na?me*.iso"),
            "we_ir_d_na_me_.iso"
        );
        assert_eq!(sanitize_file_name("  ..  "), "Datei");
        assert_eq!(sanitize_file_name(""), "Datei");
        // DL8: device names with a space or a superscript digit, bidi overrides, shortcut types
        assert_eq!(sanitize_file_name("CON .txt"), "_CON.txt");
        assert_eq!(sanitize_file_name("COM¹.log"), "_COM¹.log");
        assert_eq!(sanitize_file_name("Rechnung\u{202E}fdp.exe"), "Rechnungfdp.exe");
        assert_eq!(sanitize_file_name("Ordner.url"), "Ordner.url_");
        assert_eq!(sanitize_file_name("CON.txt"), "_CON.txt");
        assert_eq!(sanitize_file_name("nul"), "_nul");
        let long = format!("{}.tar.gz", "x".repeat(400));
        let cut = sanitize_file_name(&long);
        assert!(cut.len() <= file_names::MAX_NAME_BYTES && cut.ends_with(".gz"));
    }

    #[test]
    fn name_from_url() {
        let u = |s: &str| url::Url::parse(s).unwrap();
        assert_eq!(
            file_name_from_url(&u("https://x.test/a/b/file%20one.zip?x=1")),
            "file one.zip"
        );
        assert_eq!(file_name_from_url(&u("https://x.test/")), "download");
        assert_eq!(
            file_name_from_url(&u("https://x.test/%2e%2e%2fpasswd")),
            "passwd"
        );
    }

    #[test]
    fn disposition() {
        assert_eq!(
            file_name_from_disposition("attachment; filename=\"a b.iso\"").unwrap(),
            "a b.iso"
        );
        assert_eq!(
            file_name_from_disposition("attachment; filename=x.bin; size=3").unwrap(),
            "x.bin"
        );
        assert_eq!(
            file_name_from_disposition(
                "attachment; filename=\"f.txt\"; filename*=UTF-8''%C3%A4.txt"
            )
            .unwrap(),
            "ä.txt"
        );
        assert_eq!(
            file_name_from_disposition("attachment; filename=\"../../x\"").unwrap(),
            "x"
        );
        assert!(file_name_from_disposition("inline").is_none());
    }

    #[test]
    fn never_overwrites() {
        let dir = std::env::temp_dir().join(format!("dl-name-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("f.bin"), b"x").unwrap();
        std::fs::write(dir.join("f (1).bin.part"), b"x").unwrap();
        assert_eq!(unique_name(&dir, "g.bin", &|_| false), "g.bin");
        assert_eq!(unique_name(&dir, "f.bin", &|_| false), "f (2).bin");
        assert_eq!(unique_name(&dir, "g.bin", &|n| n == "g.bin"), "g (1).bin");
        let _ = std::fs::remove_dir_all(dir);
    }
}
