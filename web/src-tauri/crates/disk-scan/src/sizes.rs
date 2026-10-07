//! Quick sizes of the well-known clean-up places and of the recycle bin, without a scan.
//!
//! Read-only: this only adds up file sizes. Links and junctions are never followed, and the walk
//! is bounded in entries and time, so a huge Downloads folder cannot stall the screen; the result
//! then says it is a lower bound (`partial`).

use crate::system::known_places;
use serde::Serialize;
use std::path::Path;
use std::time::{Duration, Instant};

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaceSize {
    /// `temp`, `chrome`, `edge`, `firefox`, `downloads`, `cache`.
    pub id: &'static str,
    pub path: String,
    pub size_bytes: u64,
    /// The walk stopped early; the real size is at least this much.
    pub partial: bool,
}

#[cfg(windows)]
fn is_link(md: &std::fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const REPARSE_POINT: u32 = 0x400;
    md.file_attributes() & REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_link(md: &std::fs::Metadata) -> bool {
    md.file_type().is_symlink()
}

/// Sum of the file sizes below `root`; `(bytes, partial)`.
pub fn folder_size(root: &Path, max_entries: usize, max_time: Duration) -> (u64, bool) {
    let start = Instant::now();
    let mut stack = vec![root.to_path_buf()];
    let (mut total, mut seen) = (0u64, 0usize);
    while let Some(dir) = stack.pop() {
        let Ok(rd) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in rd.flatten() {
            seen += 1;
            if seen > max_entries || (seen % 256 == 0 && start.elapsed() > max_time) {
                return (total, true);
            }
            let Ok(md) = std::fs::symlink_metadata(entry.path()) else {
                continue;
            };
            if is_link(&md) {
                continue;
            }
            if md.is_dir() {
                stack.push(entry.path());
            } else {
                total += md.len();
            }
        }
    }
    (total, false)
}

/// Sizes of the known places that exist on this machine.
pub fn place_sizes() -> Vec<PlaceSize> {
    known_places()
        .into_iter()
        .map(|p| {
            let (size_bytes, partial) =
                folder_size(Path::new(&p.path), 300_000, Duration::from_secs(3));
            PlaceSize {
                id: p.id,
                path: p.path,
                size_bytes,
                partial,
            }
        })
        .collect()
}

/// Size of the recycle bin (Windows only; the bin itself is never touched here).
#[cfg(windows)]
pub fn recycle_bin_size() -> Option<u64> {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::{SHQueryRecycleBinW, SHQUERYRBINFO};
    let mut info = SHQUERYRBINFO {
        cbSize: std::mem::size_of::<SHQUERYRBINFO>() as u32,
        ..Default::default()
    };
    // SAFETY: a null root asks for all drives; `info` is a live struct with `cbSize` set.
    unsafe { SHQueryRecycleBinW(PCWSTR::null(), &mut info) }.ok()?;
    u64::try_from(info.i64Size).ok()
}

#[cfg(not(windows))]
pub fn recycle_bin_size() -> Option<u64> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("nemo-sizes-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join("sub")).unwrap();
        d
    }

    #[test]
    fn adds_up_files_in_nested_folders() {
        let d = scratch("sum");
        std::fs::write(d.join("a.bin"), vec![0u8; 1000]).unwrap();
        std::fs::write(d.join("sub").join("b.bin"), vec![0u8; 234]).unwrap();
        assert_eq!(folder_size(&d, 100, Duration::from_secs(5)), (1234, false));
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn stops_at_the_entry_limit_and_says_so() {
        let d = scratch("limit");
        for i in 0..10 {
            std::fs::write(d.join(format!("f{i}")), [1u8; 10]).unwrap();
        }
        let (bytes, partial) = folder_size(&d, 3, Duration::from_secs(5));
        assert!(partial);
        assert!(bytes <= 30);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[cfg(unix)]
    #[test]
    fn links_are_not_followed() {
        let d = scratch("link");
        let outside = scratch("outside");
        std::fs::write(outside.join("big"), vec![0u8; 5000]).unwrap();
        std::os::unix::fs::symlink(&outside, d.join("sub").join("lnk")).unwrap();
        assert_eq!(folder_size(&d, 100, Duration::from_secs(5)), (0, false));
        let _ = std::fs::remove_dir_all(&d);
        let _ = std::fs::remove_dir_all(&outside);
    }

    #[test]
    fn a_missing_folder_is_zero() {
        assert_eq!(
            folder_size(
                Path::new("/definitely/not/here"),
                10,
                Duration::from_secs(1)
            ),
            (0, false)
        );
    }
}
