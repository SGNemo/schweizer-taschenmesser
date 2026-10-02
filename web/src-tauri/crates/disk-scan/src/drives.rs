//! Drive overview: label, type, capacity. Nothing here needs admin rights.
// The descriptor parsers are only called by the Windows code but are unit-tested everywhere.
#![cfg_attr(not(windows), allow(dead_code))]

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

/// How the drive is connected, as reported by the storage driver (no admin rights needed).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Bus {
    Nvme,
    Sata,
    Usb,
    Scsi,
    Card,
    Virtual,
    Other,
    Unknown,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum HealthStatus {
    Ok,
    /// The drive itself predicts a failure.
    Warning,
    Unknown,
}

/// Why a health value is missing, so the UI can say it in plain words.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum HealthGap {
    /// Windows only hands the value out with administrator rights.
    NeedsAdmin,
    /// This kind of drive does not report it (network, card readers, many USB bridges).
    Unsupported,
}

/// SMART-style health and temperature as far as Windows allows without admin rights.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Health {
    pub status: HealthStatus,
    pub temperature_c: Option<i16>,
    pub gap: Option<HealthGap>,
}

impl Health {
    pub const fn unknown(gap: HealthGap) -> Health {
        Health {
            status: HealthStatus::Unknown,
            temperature_c: None,
            gap: Some(gap),
        }
    }
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
    pub bus: Bus,
    /// Product name from the storage driver ("Samsung SSD 990 PRO 1TB"); never a serial number.
    pub model: Option<String>,
    /// Holds the running Windows.
    pub is_system: bool,
    pub health: Health,
}

/// `BusType` of `STORAGE_BUS_TYPE`.
pub fn bus_from_code(code: u32) -> Bus {
    match code {
        17 => Bus::Nvme,
        3 | 11 => Bus::Sata, // ATA, SATA
        7 => Bus::Usb,
        1 | 8 | 10 => Bus::Scsi, // SCSI, RAID, SAS
        12 | 13 => Bus::Card,    // SD, MMC
        14..=16 => Bus::Virtual, // virtual, file-backed virtual, storage spaces
        0 => Bus::Unknown,
        _ => Bus::Other,
    }
}

fn c_string_at(buf: &[u8], off: usize) -> Option<String> {
    if off == 0 || off >= buf.len() {
        return None;
    }
    let end = buf[off..].iter().position(|b| *b == 0).map_or(buf.len(), |p| off + p);
    let s = String::from_utf8_lossy(&buf[off..end]).trim().to_string();
    (!s.is_empty()).then_some(s)
}

fn u32_at(buf: &[u8], off: usize) -> Option<u32> {
    Some(u32::from_le_bytes(buf.get(off..off + 4)?.try_into().ok()?))
}

/// Model and bus out of a `STORAGE_DEVICE_DESCRIPTOR` buffer (vendor + product, no serial number).
pub fn parse_device_descriptor(buf: &[u8]) -> (Option<String>, Bus) {
    let vendor = u32_at(buf, 12).and_then(|o| c_string_at(buf, o as usize));
    let product = u32_at(buf, 16).and_then(|o| c_string_at(buf, o as usize));
    let bus = u32_at(buf, 28).map_or(Bus::Unknown, bus_from_code);
    // Many drives put the maker into the product string already; "ATA" is just the transport.
    let model = match (vendor.filter(|v| !v.eq_ignore_ascii_case("ATA")), product) {
        (Some(v), Some(p)) if !p.to_lowercase().starts_with(&v.to_lowercase()) => {
            Some(format!("{v} {p}"))
        }
        (_, Some(p)) => Some(p),
        (Some(v), None) => Some(v),
        _ => None,
    };
    (model, bus)
}

/// Current temperature in °C out of a `STORAGE_TEMPERATURE_DATA_DESCRIPTOR` buffer.
pub fn parse_temperature(buf: &[u8]) -> Option<i16> {
    let count = u16::from_le_bytes(buf.get(12..14)?.try_into().ok()?);
    if count == 0 {
        return None;
    }
    // Header is 24 bytes; each info entry starts with u16 index, then the i16 temperature.
    let t = i16::from_le_bytes(buf.get(26..28)?.try_into().ok()?);
    (-40..=150).contains(&t).then_some(t)
}

/// Combines what the two queries returned. `predict` is `None` when it could not be read.
pub fn health_from(temperature_c: Option<i16>, predict_failure: Option<bool>, gap: HealthGap) -> Health {
    match predict_failure {
        Some(true) => Health {
            status: HealthStatus::Warning,
            temperature_c,
            gap: None,
        },
        Some(false) => Health {
            status: HealthStatus::Ok,
            temperature_c,
            gap: None,
        },
        None => Health {
            status: HealthStatus::Unknown,
            temperature_c,
            gap: Some(gap),
        },
    }
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
        PropertyStandardQuery, StorageDeviceProperty, StorageDeviceSeekPenaltyProperty,
        StorageDeviceTemperatureProperty, DEVICE_SEEK_PENALTY_DESCRIPTOR,
        IOCTL_STORAGE_PREDICT_FAILURE, IOCTL_STORAGE_QUERY_PROPERTY, STORAGE_PREDICT_FAILURE,
        STORAGE_PROPERTY_ID, STORAGE_PROPERTY_QUERY,
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

    fn open_volume(letter: char) -> Option<windows::Win32::Foundation::HANDLE> {
        let path = wide(&format!("\\\\.\\{letter}:"));
        // SAFETY: `path` is NUL-terminated; access 0 only queries metadata.
        unsafe {
            CreateFileW(
                PCWSTR(path.as_ptr()),
                0,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                None,
                OPEN_EXISTING,
                FILE_FLAGS_AND_ATTRIBUTES(0),
                None,
            )
        }
        .ok()
    }

    /// A storage property as raw bytes (the descriptors are variable-sized, parsed in the safe part).
    fn query_property(
        handle: windows::Win32::Foundation::HANDLE,
        id: STORAGE_PROPERTY_ID,
    ) -> Option<Vec<u8>> {
        let query = STORAGE_PROPERTY_QUERY {
            PropertyId: id,
            QueryType: PropertyStandardQuery,
            AdditionalParameters: [0],
        };
        let mut out = vec![0u8; 1024];
        let mut returned = 0u32;
        // SAFETY: both buffers are live and the sizes passed are theirs.
        let ok = unsafe {
            DeviceIoControl(
                handle,
                IOCTL_STORAGE_QUERY_PROPERTY,
                Some(std::ptr::from_ref(&query).cast()),
                std::mem::size_of::<STORAGE_PROPERTY_QUERY>() as u32,
                Some(out.as_mut_ptr().cast()),
                out.len() as u32,
                Some(&mut returned),
                None,
            )
        };
        ok.ok()?;
        out.truncate(returned as usize);
        Some(out)
    }

    /// `Some(true)` if the drive predicts a failure; `None` if Windows did not answer.
    fn predict_failure(handle: windows::Win32::Foundation::HANDLE) -> Option<bool> {
        let mut out = STORAGE_PREDICT_FAILURE::default();
        let mut returned = 0u32;
        // SAFETY: `out` is a live struct of the exact type the IOCTL fills.
        unsafe {
            DeviceIoControl(
                handle,
                IOCTL_STORAGE_PREDICT_FAILURE,
                None,
                0,
                Some(std::ptr::from_mut(&mut out).cast()),
                std::mem::size_of::<STORAGE_PREDICT_FAILURE>() as u32,
                Some(&mut returned),
                None,
            )
        }
        .ok()?;
        Some(out.PredictFailure != 0)
    }

    /// Model, bus and health of the physical drive behind `X:` – every part may be missing.
    fn details(letter: char) -> (Option<String>, Bus, Health) {
        let Some(handle) = open_volume(letter) else {
            return (None, Bus::Unknown, Health::unknown(HealthGap::NeedsAdmin));
        };
        let (model, bus) = query_property(handle, StorageDeviceProperty)
            .map_or((None, Bus::Unknown), |b| parse_device_descriptor(&b));
        let temperature = query_property(handle, StorageDeviceTemperatureProperty)
            .and_then(|b| parse_temperature(&b));
        let predict = predict_failure(handle);
        // SAFETY: `handle` came from CreateFileW and is closed exactly once.
        unsafe {
            let _ = CloseHandle(handle);
        }
        // Card readers and many USB bridges never answer; everything else needs admin rights.
        let gap = if matches!(bus, Bus::Usb | Bus::Card | Bus::Virtual) {
            HealthGap::Unsupported
        } else {
            HealthGap::NeedsAdmin
        };
        (model, bus, health_from(temperature, predict, gap))
    }

    pub fn list() -> Vec<DriveInfo> {
        let system_letter = std::env::var("SystemDrive")
            .ok()
            .and_then(|d| d.chars().next())
            .map(|c| c.to_ascii_uppercase());
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
            let (model, bus, health) = if matches!(kind, DriveKind::Fixed | DriveKind::Removable) {
                details(letter)
            } else {
                (None, Bus::Unknown, Health::unknown(HealthGap::Unsupported))
            };
            out.push(DriveInfo {
                root,
                label,
                file_system,
                kind,
                media,
                total_bytes: total,
                free_bytes: free,
                bus,
                model,
                is_system: system_letter == Some(letter),
                health,
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
            let is_system = mount == "/";
            out.push(DriveInfo {
                label: mount.rsplit('/').next().unwrap_or("").to_string(),
                root: mount,
                file_system: fs.to_string(),
                kind,
                media: Media::Unknown,
                total_bytes: total,
                free_bytes: free,
                bus: Bus::Unknown,
                model: None,
                is_system,
                health: Health::unknown(HealthGap::Unsupported),
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

#[cfg(test)]
mod tests {
    use super::*;

    /// A minimal STORAGE_DEVICE_DESCRIPTOR with strings behind the 36-byte header.
    fn descriptor(vendor: &str, product: &str, bus: u32) -> Vec<u8> {
        let mut b = vec![0u8; 36];
        let vendor_off = b.len() as u32;
        b.extend(vendor.as_bytes());
        b.push(0);
        let product_off = b.len() as u32;
        b.extend(product.as_bytes());
        b.push(0);
        b[12..16].copy_from_slice(&vendor_off.to_le_bytes());
        b[16..20].copy_from_slice(&product_off.to_le_bytes());
        b[28..32].copy_from_slice(&bus.to_le_bytes());
        b
    }

    #[test]
    fn model_and_bus_come_from_the_descriptor() {
        let (model, bus) = parse_device_descriptor(&descriptor("", "Samsung SSD 990 PRO 1TB", 17));
        assert_eq!(model.as_deref(), Some("Samsung SSD 990 PRO 1TB"));
        assert_eq!(bus, Bus::Nvme);
        let (model, bus) = parse_device_descriptor(&descriptor("ATA", "WDC WD40EFRX", 11));
        assert_eq!(model.as_deref(), Some("WDC WD40EFRX"));
        assert_eq!(bus, Bus::Sata);
        let (model, _) = parse_device_descriptor(&descriptor("SanDisk", "Ultra USB 3.0", 7));
        assert_eq!(model.as_deref(), Some("SanDisk Ultra USB 3.0"));
    }

    #[test]
    fn garbage_and_empty_descriptors_are_harmless() {
        assert_eq!(parse_device_descriptor(&[]), (None, Bus::Unknown));
        let mut b = vec![0u8; 36];
        b[16..20].copy_from_slice(&9999u32.to_le_bytes()); // offset beyond the buffer
        assert_eq!(parse_device_descriptor(&b), (None, Bus::Unknown));
    }

    #[test]
    fn bus_codes_map_to_plain_kinds() {
        assert_eq!(bus_from_code(17), Bus::Nvme);
        assert_eq!(bus_from_code(7), Bus::Usb);
        assert_eq!(bus_from_code(12), Bus::Card);
        assert_eq!(bus_from_code(14), Bus::Virtual);
        assert_eq!(bus_from_code(0), Bus::Unknown);
        assert_eq!(bus_from_code(99), Bus::Other);
    }

    #[test]
    fn temperature_is_read_from_the_first_info_entry() {
        let mut b = vec![0u8; 24 + 16];
        b[12..14].copy_from_slice(&1u16.to_le_bytes());
        b[26..28].copy_from_slice(&41i16.to_le_bytes());
        assert_eq!(parse_temperature(&b), Some(41));
        b[26..28].copy_from_slice(&900i16.to_le_bytes());
        assert_eq!(parse_temperature(&b), None);
        b[12..14].copy_from_slice(&0u16.to_le_bytes());
        assert_eq!(parse_temperature(&b), None);
        assert_eq!(parse_temperature(&[1, 2, 3]), None);
    }

    #[test]
    fn health_says_why_a_value_is_missing() {
        let h = health_from(Some(40), Some(false), HealthGap::NeedsAdmin);
        assert_eq!((h.status, h.temperature_c, h.gap), (HealthStatus::Ok, Some(40), None));
        let h = health_from(None, Some(true), HealthGap::NeedsAdmin);
        assert_eq!(h.status, HealthStatus::Warning);
        let h = health_from(Some(33), None, HealthGap::Unsupported);
        assert_eq!(
            (h.status, h.temperature_c, h.gap),
            (HealthStatus::Unknown, Some(33), Some(HealthGap::Unsupported))
        );
    }
}
