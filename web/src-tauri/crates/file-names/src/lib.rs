//! Names of files that come from outside – a sender in the device exchange, a server's
//! `Content-Disposition`, an address, a torrent – never trusted: [`clean`] turns one into a single
//! plain file name, [`safe_segment`] says whether a name may be used as it is (torrent paths, which
//! cannot be renamed), [`unique`] finds a free name without replacing a file. [`mark_of_the_web`]
//! tags a file from the internet like a browser download does. No logging, no unsafe.
//!
//! Moved here from `lan-sync`'s `exchange/name.rs` (security review 2026-11, DL8) so the downloads
//! use the same rules; that module re-exports it.

use icu_normalizer::ComposingNormalizerBorrowed;
use icu_properties::props::{DefaultIgnorableCodePoint, GeneralCategory};
use icu_properties::{CodePointMapData, CodePointSetData};

/// Longest cleaned name, in UTF-8 bytes, with its extension and a " (n)" (filesystems allow 255;
/// the rest is room for the folder and a calm card).
pub const MAX_NAME_BYTES: usize = 120;
/// An "extension" longer than this (with its dot) is no extension: it stays part of the stem.
pub const MAX_EXT_BYTES: usize = 20;
/// The name of a file whose name cleaned away to nothing.
pub const FALLBACK: &str = "Datei";

/// Types Explorer resolves (icon, target) just by showing the folder; an SMB path there leaks the
/// user's NTLM hash. They get `_` appended, so no handler ever parses them (`pif`: a DOS program
/// shortcut, run on open). `desktop.ini` is the same as a whole name: see [`defuse`].
const DEFUSE: &[&str] = &[
    "url",
    "pif",
    "lnk",
    "scf",
    "library-ms",
    "searchconnector-ms",
    "search-ms",
    "desktop",
    "website",
    "appref-ms",
    "theme",
    "themepack",
    "deskthemepack",
];

/// One plain file name from a sender's name: the last path segment only, NFC, no control,
/// format or bidi characters, blank-looking letters and `<>:"/\|?*` as `_`, no dot or space at
/// either end (also before the extension), Windows device names with a leading `_`, at most
/// [`MAX_NAME_BYTES`] with the extension kept, shortcut types defused on the final name.
pub fn clean(raw: &str) -> String {
    let nfc = ComposingNormalizerBorrowed::new_nfc();
    let whole = nfc.normalize(raw);
    // the last segment only: "../../x" → "x", "C:\x" → "x"
    let last = whole.rsplit(['/', '\\']).next().unwrap_or("");
    let category = CodePointMapData::<GeneralCategory>::new();
    let ignorable = CodePointSetData::new::<DefaultIgnorableCodePoint>();
    let mapped: String = last
        .chars()
        .map(|c| match c {
            // letters that render blank could push the real extension off a narrow card
            '\u{115F}' | '\u{1160}' | '\u{3164}' | '\u{FFA0}' | '\u{2800}' => '_',
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            // breaks between words stay a gap ("Rechnung\tMärz" is not "RechnungMärz")
            '\t' | '\n' | '\r' | '\u{2028}' | '\u{2029}' => ' ',
            // every other space (no-break, em, ideographic …) is a plain one, so runs collapse
            c if category.get(c) == GeneralCategory::SpaceSeparator => ' ',
            c => c,
        })
        // invisible: controls, line separators, format characters (bidi, zero-width) and every
        // other default-ignorable code point (variation selectors, combining grapheme joiner …)
        .filter(|&c| {
            !(c.is_control() || category.get(c) == GeneralCategory::Format || ignorable.contains(c))
        })
        .collect();
    // removing a character can leave a combining mark next to its base: compose again
    let mapped = nfc.normalize(&mapped);
    // one space where there were several
    let mut mapped_once = String::with_capacity(mapped.len());
    for c in mapped.chars() {
        if !(c == ' ' && mapped_once.ends_with(' ')) {
            mapped_once.push(c);
        }
    }
    let mapped = mapped_once;
    // no leading dots (hidden, ".."), no trailing dot or space
    let s = trim_end(mapped.trim_start_matches(|c: char| c.is_whitespace() || c == '.'));
    let s = if s.is_empty() { FALLBACK } else { s };
    let (stem, ext) = match s.rfind('.') {
        Some(dot) if dot > 0 && s.len() - dot <= MAX_EXT_BYTES => (trim_end(&s[..dot]), &s[dot..]),
        _ => (s, ""),
    };
    // the "_" of a device name and of a defused type need up to two more bytes: cut again
    let mut room = MAX_NAME_BYTES;
    loop {
        let name = fit(stem, ext, room);
        if name.len() <= MAX_NAME_BYTES || room == 0 {
            return name;
        }
        room -= 1;
    }
}

fn fit(stem: &str, ext: &str, room: usize) -> String {
    let cut = trim_end(cut_bytes(stem, room.saturating_sub(ext.len())));
    let mut out = if cut.is_empty() {
        FALLBACK.to_owned()
    } else {
        cut.to_owned()
    };
    // a name without an extension of its own must not get one from the cut
    // ("a….exe.bbbbbbbbbbbbbbbbbbbbbbbbb" cut to "a….exe"): the cut end stays a stem
    if ext.is_empty()
        && cut.len() < stem.len()
        && extension(&out).is_some_and(|e| e.len() < MAX_EXT_BYTES)
    {
        out.push('_');
    }
    // Windows treats "CON", "con.txt", "con .txt" and "con.tar.gz" alike: the first segment counts
    if reserved(trim_end(out.split('.').next().unwrap_or(""))) {
        out.insert(0, '_');
    }
    defuse(out + ext)
}

/// Windows device names (any case, also with the superscript digits Windows accepts).
pub fn reserved(segment: &str) -> bool {
    let lower = segment.to_lowercase();
    if matches!(
        lower.as_str(),
        "con" | "prn" | "aux" | "nul" | "conin$" | "conout$"
    ) {
        return true;
    }
    let mut chars = lower.chars();
    let prefix: String = chars.by_ref().take(3).collect();
    let rest: Vec<char> = chars.collect();
    matches!(prefix.as_str(), "com" | "lpt")
        && matches!(rest.as_slice(), [d] if d.is_ascii_digit() || matches!(d, '¹' | '²' | '³'))
}

/// `name` with `_` appended when its final extension is a shortcut-like type, or when it is
/// `desktop.ini` (Explorer reads its icon from a folder marked read-only or system).
fn defuse(mut name: String) -> String {
    if defused_ext(&name) {
        name.push('_');
    }
    name
}

fn defused_ext(name: &str) -> bool {
    name.eq_ignore_ascii_case("desktop.ini")
        || extension(name).is_some_and(|e| DEFUSE.iter().any(|d| e.eq_ignore_ascii_case(d)))
}

/// Whether a cleaned name is a shortcut-like type that [`clean`] defused (`Ordner.url_`).
pub fn defused(name: &str) -> bool {
    name.strip_suffix('_').is_some_and(defused_ext)
}

/// The final extension without its dot, if the name has one after a non-empty stem.
pub fn extension(name: &str) -> Option<&str> {
    match name.rfind('.') {
        Some(dot) if dot > 0 => Some(&name[dot + 1..]),
        _ => None,
    }
}

/// The names to try for a cleaned name, in order: the name itself, then "stem (2).ext" …
/// "stem (9999).ext", each within [`MAX_NAME_BYTES`] (the stem is cut, never the extension).
/// The caller creates each one create-new and takes the first that works, so a race never
/// replaces a file and an error other than "exists" can stop the search.
pub fn candidates(name: &str) -> impl Iterator<Item = String> + '_ {
    // a defused name keeps its whole tail ("x.url_"): the counter goes before it
    let (stem, ext) = match name.rfind('.') {
        Some(dot) if dot > 0 && name.len() - dot <= MAX_EXT_BYTES + 1 => {
            (&name[..dot], &name[dot..])
        }
        _ => (name, ""),
    };
    std::iter::once(name.to_owned()).chain((2..=9999u32).map(move |n| {
        let counter = format!(" ({n})");
        let room = MAX_NAME_BYTES.saturating_sub(ext.len() + counter.len());
        let cut = trim_end(cut_bytes(stem, room));
        format!(
            "{}{counter}{ext}",
            if cut.is_empty() { FALLBACK } else { cut }
        )
    }))
}

/// The first of [`candidates`] that `taken` says is free (`None` when none is).
pub fn unique(name: &str, mut taken: impl FnMut(&str) -> bool) -> Option<String> {
    candidates(name).find(|c| !taken(c))
}

pub fn trim_end(s: &str) -> &str {
    s.trim_end_matches(|c: char| c.is_whitespace() || c == '.')
}

/// The longest prefix of whole characters that fits into `max` UTF-8 bytes.
pub fn cut_bytes(text: &str, max: usize) -> &str {
    if text.len() <= max {
        return text;
    }
    let mut end = max;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    &text[..end]
}


/// Longest single path segment most file systems take (NTFS, ext4: 255).
const MAX_SEGMENT_BYTES: usize = 255;

/// Whether `segment` may be used as a file or folder name exactly as it is – for names that cannot
/// be renamed (the paths inside a torrent): not empty, not `.` or `..`, no separator, no
/// `<>:"|?*` (so no drive letter and no alternate data stream), no control, format, bidi or other
/// invisible character, no dot or space at the end, no Windows device name, at most 255 bytes.
pub fn safe_segment(segment: &str) -> bool {
    if segment.is_empty() || segment.len() > MAX_SEGMENT_BYTES || segment == "." || segment == ".."
    {
        return false;
    }
    let category = CodePointMapData::<GeneralCategory>::new();
    let ignorable = CodePointSetData::new::<DefaultIgnorableCodePoint>();
    let bad_char = segment.chars().any(|c| {
        matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*')
            || c.is_control()
            || category.get(c) == GeneralCategory::Format
            || ignorable.contains(c)
    });
    !bad_char
        && trim_end(segment).len() == segment.len()
        && !reserved(trim_end(segment.split('.').next().unwrap_or("")))
}

/// Whether a name is a shortcut type Explorer resolves just by showing the folder (`.url`, `.lnk`,
/// `desktop.ini` …). [`clean`] defuses such names; where a name cannot be renamed (a file inside
/// a torrent), the caller leaves the file out.
pub fn shortcut(name: &str) -> bool {
    defused_ext(name)
}

/// The `Zone.Identifier` text Windows reads for a file from the internet (zone 3): SmartScreen,
/// Office Protected View and the "blocked" checkbox in the file's properties then treat it like a
/// browser download. `host_url` without credentials (the caller strips them).
pub fn zone_identifier(host_url: Option<&str>) -> String {
    let mut text = String::from("[ZoneTransfer]\r\nZoneId=3\r\n");
    if let Some(url) = host_url.filter(|u| !u.contains(['\r', '\n'])) {
        text.push_str("HostUrl=");
        text.push_str(url);
        text.push_str("\r\n");
    }
    text
}

/// Marks a finished file as coming from the internet (Mark-of-the-Web, the NTFS stream
/// `<file>:Zone.Identifier`). Windows only; elsewhere nothing to do. On a file system without
/// streams (FAT32, exFAT, a network share) Windows refuses the write: that is reported, the file
/// stays.
pub fn mark_of_the_web(path: &std::path::Path, host_url: Option<&str>) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        let mut stream = path.as_os_str().to_owned();
        stream.push(":Zone.Identifier");
        std::fs::write(stream, zone_identifier(host_url))
    }
    #[cfg(not(windows))]
    {
        let _ = (path, host_url);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_segments_are_plain_names_only() {
        for ok in ["Linux 12.iso", "Kapitel 1", "ä ö ü.mp3", "a.b.c", ".hidden"] {
            assert!(safe_segment(ok), "{ok}");
        }
        for bad in [
            "",
            ".",
            "..",
            "C:",
            "C:evil",
            "a:Zone.Identifier",
            "a/b",
            "a\\b",
            "CON",
            "con.txt",
            "CON .txt",
            "COM¹",
            "lpt9.log",
            "name.",
            "name ",
            "gnp.\u{202E}exe",
            "zero\u{200B}width",
            "tab\there",
        ] {
            assert!(!safe_segment(bad), "{bad:?}");
        }
        assert!(!safe_segment(&"x".repeat(256)));
        assert!(safe_segment(&"x".repeat(255)));
    }

    /// DL8: what the old downloader cleaner let through.
    #[test]
    fn clean_closes_the_downloader_gaps() {
        assert_eq!(clean("CON .txt"), "_CON.txt");
        assert_eq!(clean("COM¹"), "_COM¹");
        assert_eq!(clean("Rechnung\u{202E}fdp.exe"), "Rechnungfdp.exe");
        assert_eq!(clean("../../etc/passwd"), "passwd");
        assert_eq!(clean("Bild.png:Zone.Identifier"), "Bild.png_Zone.Identifier");
    }

    #[test]
    fn shortcut_types_are_recognised() {
        for s in ["Besuche uns.url", "x.LNK", "desktop.ini", "a.library-ms"] {
            assert!(shortcut(s), "{s}");
        }
        assert!(!shortcut("film.mkv") && !shortcut("url"));
    }

    #[test]
    fn zone_identifier_is_zone_three() {
        assert_eq!(zone_identifier(None), "[ZoneTransfer]\r\nZoneId=3\r\n");
        assert_eq!(
            zone_identifier(Some("https://example.org/a.zip")),
            "[ZoneTransfer]\r\nZoneId=3\r\nHostUrl=https://example.org/a.zip\r\n"
        );
        // a line break could add keys of its own
        assert_eq!(
            zone_identifier(Some("https://x/\r\nZoneId=0")),
            "[ZoneTransfer]\r\nZoneId=3\r\n"
        );
    }

    #[cfg(windows)]
    #[test]
    fn a_marked_file_carries_the_stream() {
        let dir = std::env::temp_dir().join(format!("nemo-motw-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("a.bin");
        std::fs::write(&file, b"x").unwrap();
        mark_of_the_web(&file, Some("https://example.org/a.bin")).unwrap();
        let mut stream = file.as_os_str().to_owned();
        stream.push(":Zone.Identifier");
        let text = std::fs::read_to_string(stream).unwrap();
        assert!(text.contains("ZoneId=3"));
        let _ = std::fs::remove_dir_all(dir);
    }
}
