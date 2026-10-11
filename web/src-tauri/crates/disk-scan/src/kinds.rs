use serde::{Deserialize, Serialize};
use std::path::Path;

/// File type buckets of the treemap legend. The order is the index into `kind_bytes`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileKind {
    Video,
    Image,
    Audio,
    Archive,
    Program,
    Document,
    /// Game data (packages, archives of game engines), so a game library is not all "other".
    Game,
    Other,
}

pub const KIND_COUNT: usize = 8;

impl FileKind {
    pub const ALL: [FileKind; KIND_COUNT] = [
        FileKind::Video,
        FileKind::Image,
        FileKind::Audio,
        FileKind::Archive,
        FileKind::Program,
        FileKind::Document,
        FileKind::Game,
        FileKind::Other,
    ];

    pub fn index(self) -> usize {
        self as usize
    }
}

/// Buckets a file by its extension (case-insensitive). Content is never read.
pub fn classify(name: &str) -> FileKind {
    let ext = match Path::new(name).extension().and_then(|e| e.to_str()) {
        Some(e) => e.to_ascii_lowercase(),
        None => return FileKind::Other,
    };
    match ext.as_str() {
        "mp4" | "mkv" | "avi" | "mov" | "wmv" | "webm" | "m4v" | "flv" | "mpg" | "mpeg"
        | "m2ts" | "mts" | "3gp" | "vob" | "bik" | "bk2" | "usm" => FileKind::Video,
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "heic" | "heif" | "avif" | "jxl"
        | "tif" | "tiff" | "svg" | "ico" | "raw" | "dng" | "cr2" | "cr3" | "nef" | "arw"
        | "orf" | "rw2" | "psd" | "xcf" | "dds" | "exr" => FileKind::Image,
        "mp3" | "flac" | "wav" | "aac" | "ogg" | "m4a" | "wma" | "opus" | "aif" | "aiff"
        | "mid" | "midi" | "wem" | "bnk" | "fsb" => FileKind::Audio,
        "zip" | "rar" | "7z" | "tar" | "gz" | "tgz" | "bz2" | "xz" | "zst" | "lz4" | "lzma"
        | "iso" | "img" | "dmg" | "cab" | "wim" | "esd" | "vhd" | "vhdx" | "vmdk" | "qcow2" => {
            FileKind::Archive
        }
        "exe" | "dll" | "msi" | "msix" | "appx" | "sys" | "bat" | "cmd" | "ps1" | "com" | "so"
        | "dylib" | "app" | "apk" | "jar" | "pdb" | "lib" | "pyd" | "node" => FileKind::Program,
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "odt" | "ods"
        | "odp" | "md" | "csv" | "rtf" | "epub" | "mobi" => FileKind::Document,
        // Package formats of game engines and launchers (Unreal, Unity, Source, RE Engine,
        // REDengine, Bethesda, Blizzard, Rockstar, Ubisoft, CRI, ...).
        "pak" | "ucas" | "utoc" | "uasset" | "umap" | "upk" | "vpk" | "rpak" | "starpak"
        | "assets" | "resource" | "ress" | "bundle" | "unity3d" | "forge" | "rpf" | "wad"
        | "bsa" | "ba2" | "esm" | "esp" | "cpk" | "pck" | "mpq" | "casc" | "big" | "gma"
        | "xnb" | "arc" | "tiger" | "sdfdata" | "vfs" | "pac" => FileKind::Game,
        _ => FileKind::Other,
    }
}

/// Age buckets of the data (by the time a file was last changed), relative to the scan start.
/// Upper limits in days; the last bucket is "older than the last limit".
pub const AGE_LIMITS_DAYS: [i64; 5] = [30, 182, 365, 730, 1095];
pub const AGE_COUNT: usize = AGE_LIMITS_DAYS.len() + 1;

/// Bucket of a file changed at `modified` (Unix seconds) as seen at `now`. An unknown (0) or
/// future time counts as new: a broken timestamp must never make data look abandoned.
pub fn age_bucket(modified: i64, now: i64) -> usize {
    if modified <= 0 || modified >= now {
        return 0;
    }
    let days = (now - modified) / 86_400;
    AGE_LIMITS_DAYS
        .iter()
        .position(|&limit| days < limit)
        .unwrap_or(AGE_LIMITS_DAYS.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_by_extension_case_insensitively() {
        assert_eq!(classify("Holiday.MP4"), FileKind::Video);
        assert_eq!(classify("a.tar.gz"), FileKind::Archive);
        assert_eq!(classify("setup.EXE"), FileKind::Program);
        assert_eq!(classify("README"), FileKind::Other);
        assert_eq!(classify(".hidden"), FileKind::Other);
    }

    #[test]
    fn game_packages_are_not_other() {
        assert_eq!(classify("pakchunk0-Windows.pak"), FileKind::Game);
        assert_eq!(classify("pak01_dir.vpk"), FileKind::Game);
        assert_eq!(classify("sharedassets0.assets"), FileKind::Game);
        assert_eq!(classify("intro.bk2"), FileKind::Video);
        assert_eq!(classify("music.wem"), FileKind::Audio);
        assert_eq!(classify("disk.vhdx"), FileKind::Archive);
    }

    #[test]
    fn age_buckets_follow_the_limits() {
        let now = 2_000_000_000;
        let days = |d: i64| now - d * 86_400;
        assert_eq!(age_bucket(days(1), now), 0);
        assert_eq!(age_bucket(days(29), now), 0);
        assert_eq!(age_bucket(days(30), now), 1);
        assert_eq!(age_bucket(days(200), now), 2);
        assert_eq!(age_bucket(days(400), now), 3);
        assert_eq!(age_bucket(days(800), now), 4);
        assert_eq!(age_bucket(days(1095), now), 5);
        assert_eq!(age_bucket(days(5000), now), 5);
        // Unknown or future times never look old.
        assert_eq!(age_bucket(0, now), 0);
        assert_eq!(age_bucket(now + 10, now), 0);
    }

    #[test]
    fn index_matches_all_order() {
        for (i, k) in FileKind::ALL.iter().enumerate() {
            assert_eq!(k.index(), i);
        }
    }
}
