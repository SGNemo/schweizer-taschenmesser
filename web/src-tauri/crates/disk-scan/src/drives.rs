//! Drive overview: label, type, capacity. Nothing here needs admin rights.

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DriveKind {
    Fixed,
    Removable,
    Network,
    Ram,
    Unknown,
}

/// SSD/HDD as far as the OS tells us without admin rights.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Media {
    Ssd,
    Hdd,
    Unknown,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    /// Scan root, e.g. `C:\` (Windows) or a mount point.
    pub root: String,
    pub label: String,
    pub file_system: String,
    pub kind: DriveKind,
    pub media: Media,
    pub total_bytes: u64,
    pub free_bytes: u64,
}

/// Lists the mounted drives that have a readable capacity.
pub fn list_drives() -> Vec<DriveInfo> {
    imp::list()
}

#[cfg(windows)]
mod imp {
    use super::*;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::Storage::FileSystem::{
        CreateFileW, GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDrives, GetVolumeInformationW,
        FILE_FLAGS_AND_ATTRIBUTES, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    };
    use windows::Win32::System::Ioctl::{
        PropertyStandardQuery, StorageDeviceSeekPenaltyProperty, DEVICE_SEEK_PENALTY_DESCRIPTOR,
        IOCTL_STORAGE_QUERY_PROPERTY, STORAGE_PROPERTY_QUERY,
    };
    use windows::Win32::System::IO::DeviceIoControl;

    const DRIVE_REMOVABLE: u32 = 2;
    const DRIVE_FIXED: u32 = 3;
    const DRIVE_REMOTE: u32 = 4;
    const DRIVE_RAMDISK: u32 = 6;

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn text(buf: &[u16]) -> String {
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        String::from_utf16_lossy(&buf[..end])
    }

    /// Seek-penalty query on `\\.\X:` (no access rights requested, so no admin needed).
    fn media(letter: char) -> Media {
        let path = wide(&format!("\\\\.\\{letter}:"));
        // SAFETY: `path` is NUL-terminated and outlives the call; access 0 only queries metadata.
        let handle = unsafe {
            CreateFileW(
                PCWSTR(path.as_ptr()),
                0,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                None,
                OPEN_EXISTING,
                FILE_FLAGS_AND_ATTRIBUTES(0),
                None,
            )
        };
        let Ok(handle) = handle else {
            return Media::Unknown;
        };
        let query = STORAGE_PROPERTY_QUERY {
            PropertyId: StorageDeviceSeekPenaltyProperty,
            QueryType: PropertyStandardQuery,
            AdditionalParameters: [0],
        };
        let mut out = DEVICE_SEEK_PENALTY_DESCRIPTOR::default();
        let mut returned = 0u32;
        // SAFETY: both buffers are live locals of the exact sizes passed; the handle is valid
        // and closed right after.
        let ok = unsafe {
            DeviceIoControl(
                handle,
                IOCTL_STORAGE_QUERY_PROPERTY,
                Some(std::ptr::from_ref(&query).cast()),
                std::mem::size_of::<STORAGE_PROPERTY_QUERY>() as u32,
                Some(std::ptr::from_mut(&mut out).cast()),
                std::mem::size_of::<DEVICE_SEEK_PENALTY_DESCRIPTOR>() as u32,
                Some(&mut returned),
                None,
            )
        };
        // SAFETY: `handle` came from CreateFileW above and is closed exactly once.
        unsafe {
            let _ = CloseHandle(handle);
        }
        match ok {
            Ok(())
                if returned as usize >= std::mem::size_of::<DEVICE_SEEK_PENALTY_DESCRIPTOR>() =>
            {
                if out.IncursSeekPenalty {
                    Media::Hdd
                } else {
                    Media::Ssd
                }
            }
            _ => Media::Unknown,
        }
    }

    pub fn list() -> Vec<DriveInfo> {
        // SAFETY: plain query without arguments.
        let mask = unsafe { GetLogicalDrives() };
        let mut out = Vec::new();
        for i in 0..26u32 {
            if mask & (1 << i) == 0 {
                continue;
            }
            let letter = char::from(b'A' + i as u8);
            let root = format!("{letter}:\\");
            let root_w = wide(&root);
            // SAFETY: NUL-terminated wide string.
            let kind = match unsafe { GetDriveTypeW(PCWSTR(root_w.as_ptr())) } {
                DRIVE_FIXED => DriveKind::Fixed,
                DRIVE_REMOVABLE => DriveKind::Removable,
                DRIVE_REMOTE => DriveKind::Network,
                DRIVE_RAMDISK => DriveKind::Ram,
                _ => continue, // optical drives, unknown types, missing roots
            };
            let (mut total, mut free) = (0u64, 0u64);
            // SAFETY: out pointers point to live locals.
            if unsafe {
                GetDiskFreeSpaceExW(
                    PCWSTR(root_w.as_ptr()),
                    None,
                    Some(&mut total),
                    Some(&mut free),
                )
            }
            .is_err()
                || total == 0
            {
                continue; // no medium / not ready
            }
            let mut label = [0u16; 261];
            let mut fs = [0u16; 32];
            // SAFETY: buffers are live locals; the lengths are taken from the slices.
            let info = unsafe {
                GetVolumeInformationW(
                    PCWSTR(root_w.as_ptr()),
                    Some(&mut label),
                    None,
                    None,
                    None,
                    Some(&mut fs),
                )
            };
            let (label, file_system) = if info.is_ok() {
                (text(&label), text(&fs))
            } else {
                (String::new(), String::new())
            };
            let media = if kind == DriveKind::Fixed {
                media(letter)
            } else {
                Media::Unknown
            };
            out.push(DriveInfo {
                root,
                label,
                file_system,
                kind,
                media,
                total_bytes: total,
                free_bytes: free,
            });
        }
        out
    }
}

#[cfg(unix)]
mod imp {
    use super::*;
    use std::ffi::CString;

    fn capacity(mount: &str) -> Option<(u64, u64)> {
        let c = CString::new(mount).ok()?;
        let mut st: libc::statvfs = unsafe { std::mem::zeroed() };
        // SAFETY: `c` is a valid NUL-terminated string and `st` a live, zeroed struct.
        if unsafe { libc::statvfs(c.as_ptr(), &mut st) } != 0 {
            return None;
        }
        let frsize = st.f_frsize as u64;
        Some((st.f_blocks as u64 * frsize, st.f_bavail as u64 * frsize))
    }

    /// Development helper for Linux/macOS: real block devices and network mounts from `/proc/mounts`.
    pub fn list() -> Vec<DriveInfo> {
        let Ok(mounts) = std::fs::read_to_string("/proc/mounts") else {
            return Vec::new();
        };
        let mut seen = std::collections::HashSet::new();
        let mut out = Vec::new();
        for line in mounts.lines() {
            let mut it = line.split_whitespace();
            let (Some(dev), Some(mount), Some(fs)) = (it.next(), it.next(), it.next()) else {
                continue;
            };
            let kind = if matches!(fs, "nfs" | "nfs4" | "cifs" | "smb3" | "fuse.sshfs") {
                DriveKind::Network
            } else if dev.starts_with("/dev/") {
                DriveKind::Fixed
            } else {
                continue;
            };
            if !seen.insert(dev.to_string()) {
                continue;
            }
            let mount = mount.replace("\\040", " ");
            let Some((total, free)) = capacity(&mount) else {
                continue;
            };
            if total == 0 {
                continue;
            }
            out.push(DriveInfo {
                label: mount.rsplit('/').next().unwrap_or("").to_string(),
                root: mount,
                file_system: fs.to_string(),
                kind,
                media: Media::Unknown,
                total_bytes: total,
                free_bytes: free,
            });
        }
        out
    }
}

#[cfg(not(any(windows, unix)))]
mod imp {
    use super::*;
    pub fn list() -> Vec<DriveInfo> {
        Vec::new()
    }
}
