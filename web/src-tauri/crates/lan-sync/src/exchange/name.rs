//! Names of received files (concept `docs/design/device-exchange/CONCEPT.md` §6). The sender's
//! name is never trusted: [`clean`] turns it into one plain file name for the receiver's folder,
//! [`risk`] says whether Nemo may ever open it, [`unique`] finds a free name without replacing a
//! file, and [`part`] names the half-written file from the authenticated device and the item id
//! only. Pure: no file system here, nothing is logged. Mirrors the prototype `proto/wire.mjs`
//! (`cleanName`, `risk`, `partName`) and its cases in `proto/run.mjs`.

use file_names::extension;
pub use file_names::{candidates, clean, defused, unique, MAX_NAME_BYTES};

/// Types Nemo may open on a click (with the system's default app). Everything else is "other".
/// An allow-list on purpose: a deny-list always misses a handler. Archives are not on it:
/// browsing one exposes entries that were never cleaned or defused.
const OPENABLE: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif", "bmp", "mp3", "m4a", "aac", "ogg",
    "opus", "flac", "wav", "mp4", "m4v", "mov", "mkv", "webm", "pdf", "txt", "md", "csv", "docx",
    "xlsx", "pptx", "odt", "ods", "odp",
];

/// Whether Nemo may open a received file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Risk {
    /// On the allow-list: _Öffnen_ (only on a click).
    Plain,
    /// Anything else: only _Im Ordner zeigen_, with a warning line.
    Other,
}

/// Whether Nemo may open this (cleaned) name; the last extension decides.
pub fn risk(name: &str) -> Risk {
    match extension(name) {
        Some(e) if OPENABLE.iter().any(|o| e.eq_ignore_ascii_case(o)) => Risk::Plain,
        _ => Risk::Other,
    }
}

/// The half-written file of an incoming transfer: named only from the authenticated device and
/// the validated item id, never from anything the sender wrote.
pub fn part(peer: &[u8; 32], id: &[u8; 16]) -> String {
    let hex = |bytes: &[u8]| bytes.iter().map(|b| format!("{b:02x}")).collect::<String>();
    format!("{}-{}.part", hex(peer), hex(id))
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
        // a dot far back is no extension: the cut name stays as it is
        let mr = clean(&format!("Mr. {}", "Smith ".repeat(40)));
        assert!(mr.starts_with("Mr. Smith") && !mr.ends_with('_'), "{mr}");
        // wide blanks are one plain space
        assert_eq!(
            clean("a\u{3000}\u{3000}\u{3000}b\u{00A0}\u{2003}c.pdf"),
            "a b c.pdf"
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
