//! Names of received files (concept `docs/design/device-exchange/CONCEPT.md` §6). The sender's
//! name is never trusted: [`clean`] turns it into one plain file name for the receiver's folder,
//! [`risk`] says whether Nemo may ever open it, [`unique`] finds a free name without replacing a
//! file, and [`part`] names the half-written file from the authenticated device and the item id
//! only. Pure: no file system here, nothing is logged. Mirrors the prototype `proto/wire.mjs`
//! (`cleanName`, `risk`, `partName`) and its cases in `proto/run.mjs`.

use icu_normalizer::ComposingNormalizerBorrowed;
use icu_properties::props::{DefaultIgnorableCodePoint, GeneralCategory};
use icu_properties::{CodePointMapData, CodePointSetData};

/// Longest cleaned name, in UTF-8 bytes, with its extension and a " (n)" (filesystems allow 255;
/// the rest is room for the folder and a calm card).
pub const MAX_NAME_BYTES: usize = 120;
/// An "extension" longer than this (with its dot) is no extension: it stays part of the stem.
const MAX_EXT_BYTES: usize = 20;
/// The name of a file whose name cleaned away to nothing.
const FALLBACK: &str = "Datei";

/// Types Nemo may open on a click (with the system's default app). Everything else is "other".
/// An allow-list on purpose: a deny-list always misses a handler. Archives are not on it:
/// browsing one exposes entries that were never cleaned or defused.
const OPENABLE: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif", "bmp", "mp3", "m4a", "aac", "ogg",
    "opus", "flac", "wav", "mp4", "m4v", "mov", "mkv", "webm", "pdf", "txt", "md", "csv", "docx",
    "xlsx", "pptx", "odt", "ods", "odp",
];

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

/// Whether Nemo may open a received file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Risk {
    /// On the allow-list: _Öffnen_ (only on a click).
    Plain,
    /// Anything else: only _Im Ordner zeigen_, with a warning line.
    Other,
}

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
    if ext.is_empty() && cut.len() < stem.len() && extension(&out).is_some() {
        out.push('_');
    }
    // Windows treats "CON", "con.txt", "con .txt" and "con.tar.gz" alike: the first segment counts
    if reserved(trim_end(out.split('.').next().unwrap_or(""))) {
        out.insert(0, '_');
    }
    defuse(out + ext)
}

/// Windows device names (any case, also with the superscript digits Windows accepts).
fn reserved(segment: &str) -> bool {
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
fn extension(name: &str) -> Option<&str> {
    match name.rfind('.') {
        Some(dot) if dot > 0 => Some(&name[dot + 1..]),
        _ => None,
    }
}

/// Whether Nemo may open this (cleaned) name; the last extension decides.
pub fn risk(name: &str) -> Risk {
    match extension(name) {
        Some(e) if OPENABLE.iter().any(|o| e.eq_ignore_ascii_case(o)) => Risk::Plain,
        _ => Risk::Other,
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

/// The half-written file of an incoming transfer: named only from the authenticated device and
/// the validated item id, never from anything the sender wrote.
pub fn part(peer: &[u8; 32], id: &[u8; 16]) -> String {
    let hex = |bytes: &[u8]| bytes.iter().map(|b| format!("{b:02x}")).collect::<String>();
    format!("{}-{}.part", hex(peer), hex(id))
}

fn trim_end(s: &str) -> &str {
    s.trim_end_matches(|c: char| c.is_whitespace() || c == '.')
}

/// The longest prefix of whole characters that fits into `max` UTF-8 bytes.
fn cut_bytes(text: &str, max: usize) -> &str {
    if text.len() <= max {
        return text;
    }
    let mut end = max;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    &text[..end]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cleans_every_case_of_the_prototype() {
        let a = |n: usize| "a".repeat(n);
        let cases: Vec<(String, String)> = vec![
            ("../../Windows/System32/evil.dll".into(), "evil.dll".into()),
            ("C:\\Users\\x\\Desktop\\a.txt".into(), "a.txt".into()),
            ("CON.txt".into(), "_CON.txt".into()),
            ("com1".into(), "_com1".into()),
            ("Rechnung\u{202E}fdp.exe".into(), "Rechnungfdp.exe".into()),
            ("  .versteckt".into(), "versteckt".into()),
            ("Notiz. . .".into(), "Notiz".into()),
            ("a<b>c:d\"e|f?g*h.png".into(), "a_b_c_d_e_f_g_h.png".into()),
            ("zero\u{200B}width.pdf".into(), "zerowidth.pdf".into()),
            ("".into(), "Datei".into()),
            ("..".into(), "Datei".into()),
            (
                format!("{}.jpeg", "x".repeat(300)),
                format!("{}.jpeg", "x".repeat(115)),
            ),
            ("e\u{0301}te\u{0301}.txt".into(), "été.txt".into()),
            ("con .txt".into(), "_con.txt".into()),
            ("CON  .txt".into(), "_CON.txt".into()),
            ("nul.tar.gz".into(), "_nul.tar.gz".into()),
            (
                "Rechnung\u{3164}\u{3164}.pdf.exe".into(),
                "Rechnung__.pdf.exe".into(),
            ),
            (format!("x.pdf.{}", a(26)), format!("x.pdf.{}", a(26))),
            ("Ordner.url".into(), "Ordner.url_".into()),
            ("Start.LNK".into(), "Start.LNK_".into()),
            (
                "Suche.searchConnector-ms".into(),
                "Suche.searchConnector-ms_".into(),
            ),
            (
                format!("{}.txt", "y".repeat(30000)),
                format!("{}.txt", "y".repeat(116)),
            ),
            (
                format!("{}.lnk.{}", a(115), "b".repeat(25)),
                format!("{}.lnk_", a(115)),
            ),
            (
                format!("{}.url.{}", a(115), "b".repeat(25)),
                format!("{}.url_", a(115)),
            ),
            (
                // the cut end never becomes an extension (the prototype gave ".sc")
                format!("{}.scf{}", a(116), "b".repeat(30)),
                format!("{}.sc_", a(116)),
            ),
            ("Design.themepack".into(), "Design.themepack_".into()),
            (
                format!("con.{}.txt", "c".repeat(116)),
                format!("_con.{}.txt", "c".repeat(111)),
            ),
        ];
        for (input, want) in &cases {
            assert_eq!(&clean(input), want, "{input:?}");
            assert!(clean(input).len() <= MAX_NAME_BYTES);
        }
    }

    #[test]
    fn cleans_windows_specials() {
        // an alternate data stream and a drive-relative name are plain names
        assert_eq!(
            clean("Bild.png:Zone.Identifier"),
            "Bild.png_Zone.Identifier"
        );
        assert_eq!(clean("C:evil.exe"), "C_evil.exe");
        assert_eq!(clean("CONIN$"), "_CONIN$");
        assert_eq!(clean("conout$.log"), "_conout$.log");
        assert_eq!(clean("LPT¹.txt"), "_LPT¹.txt");
        assert_eq!(clean("com0"), "_com0");
        // not device names
        assert_eq!(clean("console.txt"), "console.txt");
        assert_eq!(clean("com10.txt"), "com10.txt");
        assert_eq!(clean("lpt.txt"), "lpt.txt");
        // a line separator and a tab are a gap; a BOM, a soft hyphen and a bell are gone
        assert_eq!(clean("a\u{2028}b\u{FEFF}c\u{00AD}d\te.txt"), "a bcd e.txt");
        assert_eq!(clean("Rechnung\t\n  März.pdf"), "Rechnung März.pdf");
        assert_eq!(clean("a\u{0007}b.txt"), "ab.txt");
        // a trailing space before the extension and in the name
        assert_eq!(clean("Brief .pdf "), "Brief.pdf");
        // multi-byte names are cut on a character, never inside one
        let long = format!("{}.txt", "ä".repeat(100));
        let cleaned = clean(&long);
        assert!(cleaned.len() <= MAX_NAME_BYTES && cleaned.ends_with(".txt"));
        assert_eq!(cleaned, format!("{}.txt", "ä".repeat(58)));
    }

    #[test]
    fn hardens_what_the_prototype_missed() {
        // a received desktop.ini would make Explorer fetch its icon (NTLM) in a marked folder
        assert_eq!(clean("desktop.ini"), "desktop.ini_");
        assert_eq!(clean("Desktop.INI"), "Desktop.INI_");
        assert!(defused("desktop.ini_"));
        assert_eq!(clean("Spiel.pif"), "Spiel.pif_");
        // a cut never turns a stem into a new extension
        for ext in ["exe", "pdf", "jpg"] {
            let name = clean(&format!("{}.{ext}.{}", "a".repeat(115), "b".repeat(25)));
            assert_eq!(name, format!("{}.{ext}_", "a".repeat(115)));
            assert_eq!(risk(&name), Risk::Other);
        }
        // a short name with a long tail keeps it uncut: no new extension either
        assert_eq!(
            clean(&format!("x.exe.{}", "b".repeat(25))),
            format!("x.exe.{}", "b".repeat(25))
        );
        // composed again after an invisible character is gone
        assert_eq!(clean("e\u{200B}\u{301}.txt"), "é.txt");
        // default-ignorable marks: combining grapheme joiner, variation selector, Khmer vowels
        assert_eq!(clean("a\u{34F}b\u{FE0F}c\u{17B4}d.txt"), "abcd.txt");
    }

    #[test]
    fn a_cut_never_uncovers_a_shortcut_and_never_ends_on_a_dot() {
        for n in 100..130 {
            for ext in ["lnk", "url", "scf", "theme"] {
                let name = clean(&format!("{}.{ext}.{}", "a".repeat(n), "b".repeat(25)));
                assert!(name.len() <= MAX_NAME_BYTES, "{name}");
                let tail_ok = !name.ends_with('.') && !name.ends_with(' ');
                assert!(tail_ok, "{name}");
                if name.to_lowercase().ends_with(&format!(".{ext}")) {
                    panic!("uncovered: {name}");
                }
            }
        }
    }

    #[test]
    fn only_allow_listed_types_open() {
        for (name, want) in [
            ("Rechnung.pdf.exe", Risk::Other),
            ("setup.MSI", Risk::Other),
            ("Link.lnk", Risk::Other),
            ("Link.lnk_", Risk::Other),
            ("app.apk", Risk::Other),
            ("x.msc", Risk::Other),
            ("hilfe.chm", Risk::Other),
            ("seite.html", Risk::Other),
            ("bild.svg", Risk::Other),
            ("a.appref-ms", Risk::Other),
            ("exe", Risk::Other),
            (".jpg", Risk::Other),
            ("Archiv.7z", Risk::Other),
            ("Archiv.zip", Risk::Other),
            ("Foto.JPG", Risk::Plain),
            ("Liste.pdf", Risk::Plain),
            ("Notizen.md", Risk::Plain),
        ] {
            assert_eq!(risk(name), want, "{name}");
        }
        assert!(defused("Ordner.url_") && defused("Start.LNK_"));
        assert!(!defused("Foto.jpg") && !defused("x_") && !defused("Ordner.url"));
    }

    #[test]
    fn unique_names_count_up_within_the_limit() {
        let taken = ["Foto.jpg", "Foto (2).jpg"];
        assert_eq!(
            unique("Foto.jpg", |n| taken.contains(&n)).unwrap(),
            "Foto (3).jpg"
        );
        assert_eq!(unique("Neu.txt", |_| false).unwrap(), "Neu.txt");
        assert_eq!(
            unique("Ordner.url_", |n| n == "Ordner.url_").unwrap(),
            "Ordner (2).url_"
        );
        assert_eq!(unique("README", |n| n == "README").unwrap(), "README (2)");
        // a name at the limit keeps its extension and stays within it, also at " (10)"
        let full = clean(&format!("{}.jpeg", "x".repeat(300)));
        let mut seen = vec![full.clone()];
        for _ in 0..12 {
            let next = unique(&full, |n| seen.iter().any(|s| s == n)).unwrap();
            assert!(
                next.len() <= MAX_NAME_BYTES && next.ends_with(".jpeg"),
                "{next}"
            );
            seen.push(next);
        }
        assert!(seen.last().unwrap().contains(" (13)"));
        // nothing free: no name, never a replaced file
        assert_eq!(unique("a.txt", |_| true), None);
        let all: Vec<String> = candidates("a.txt").collect();
        assert_eq!(all.len(), 9999);
        assert_eq!((all[0].as_str(), all[1].as_str()), ("a.txt", "a (2).txt"));
    }

    #[test]
    fn part_names_come_from_the_device_and_the_id_only() {
        let name = part(&[0xab; 32], &[0x01; 16]);
        assert_eq!(
            name,
            format!("{}-{}.part", "ab".repeat(32), "01".repeat(16))
        );
        let stem = name.strip_suffix(".part").unwrap();
        assert!(stem.chars().all(|c| c.is_ascii_hexdigit() || c == '-'));
    }
}
