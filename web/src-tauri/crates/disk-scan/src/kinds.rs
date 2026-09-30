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
    Other,
}

pub const KIND_COUNT: usize = 7;

impl FileKind {
    pub const ALL: [FileKind; KIND_COUNT] = [
        FileKind::Video,
        FileKind::Image,
        FileKind::Audio,
        FileKind::Archive,
        FileKind::Program,
        FileKind::Document,
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
        "mp4" | "mkv" | "avi" | "mov" | "wmv" | "webm" | "m4v" | "flv" | "mpg" | "mpeg" => {
            FileKind::Video
        }
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "heic" | "tif" | "tiff" | "svg"
        | "raw" | "cr2" | "nef" | "psd" => FileKind::Image,
        "mp3" | "flac" | "wav" | "aac" | "ogg" | "m4a" | "wma" | "opus" => FileKind::Audio,
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "iso" | "cab" | "zst" => {
            FileKind::Archive
        }
        "exe" | "dll" | "msi" | "sys" | "bat" | "com" | "so" | "app" | "apk" => FileKind::Program,
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "odt" | "ods" | "md"
        | "csv" | "rtf" => FileKind::Document,
        _ => FileKind::Other,
    }
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
    fn index_matches_all_order() {
        for (i, k) in FileKind::ALL.iter().enumerate() {
            assert_eq!(k.index(), i);
        }
    }
}
