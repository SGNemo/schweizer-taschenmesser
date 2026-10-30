//! Whether the "last opened" date of files can be trusted. Windows only keeps it when NTFS
//! last-access updates are on (`NtfsDisableLastAccessUpdate`, off by default on most systems since
//! Vista; Windows 10 1803+ turns it on for small system drives). Elsewhere the scan does not offer
//! it, so the UI never shows a date that may just be the day the file was copied.

use std::path::Path;

/// Decision behind [`access_time_tracked`]: the registry value (`None` = not set) and the file
/// system of the scanned volume. The low bit of the value means "updates disabled", in the plain
/// (0/1) and in the "system managed" (0x8000_0000 | n) form alike.
#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) fn tracked_from(value: Option<u32>, file_system: &str) -> bool {
    file_system.eq_ignore_ascii_case("NTFS") && value.is_some_and(|v| v & 1 == 0)
}

/// True when access times on the volume of `path` are kept up to date (Windows, NTFS, updates on).
pub fn access_time_tracked(path: &Path) -> bool {
    imp::tracked(path)
}

#[cfg(windows)]
mod imp {
    use super::*;
    use std::os::windows::ffi::OsStrExt;
    use std::path::Component;
    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::ERROR_SUCCESS;
    use windows::Win32::Storage::FileSystem::GetVolumeInformationW;
    use windows::Win32::System::Registry::{RegGetValueW, HKEY_LOCAL_MACHINE, RRF_RT_REG_DWORD};

    fn registry_value() -> Option<u32> {
        let mut value = 0u32;
        let mut bytes = std::mem::size_of::<u32>() as u32;
        // SAFETY: `value` is valid for `bytes` bytes; the API writes at most that many.
        let status = unsafe {
            RegGetValueW(
                HKEY_LOCAL_MACHINE,
                w!("SYSTEM\\CurrentControlSet\\Control\\FileSystem"),
                w!("NtfsDisableLastAccessUpdate"),
                RRF_RT_REG_DWORD,
                None,
                Some((&mut value as *mut u32).cast()),
                Some(&mut bytes),
            )
        };
        (status == ERROR_SUCCESS).then_some(value)
    }

    fn file_system(path: &Path) -> String {
        let Some(Component::Prefix(prefix)) = path.components().next() else {
            return String::new();
        };
        let mut root: Vec<u16> = prefix.as_os_str().encode_wide().collect();
        root.push(u16::from(b'\\'));
        root.push(0);
        let mut fs = [0u16; 32];
        // SAFETY: NUL-terminated root; the buffer length is taken from the slice.
        let ok = unsafe {
            GetVolumeInformationW(PCWSTR(root.as_ptr()), None, None, None, None, Some(&mut fs))
        };
        if ok.is_err() {
            return String::new();
        }
        let end = fs.iter().position(|&c| c == 0).unwrap_or(fs.len());
        String::from_utf16_lossy(&fs[..end])
    }

    pub fn tracked(path: &Path) -> bool {
        tracked_from(registry_value(), &file_system(path))
    }
}

#[cfg(not(windows))]
mod imp {
    use std::path::Path;

    /// Only the Windows rules are known; elsewhere the date is not offered.
    pub fn tracked(_path: &Path) -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_ntfs_with_updates_on_is_trusted() {
        // Plain values: 0 = on, 1 = off.
        assert!(tracked_from(Some(0), "NTFS"));
        assert!(!tracked_from(Some(1), "NTFS"));
        // "System managed" (Windows 10 1803+): the low bit still decides.
        assert!(tracked_from(Some(0x8000_0002), "ntfs"));
        assert!(!tracked_from(Some(0x8000_0003), "NTFS"));
        assert!(!tracked_from(Some(0x8000_0001), "NTFS"));
        // Not set: older Windows, where updates are off by default.
        assert!(!tracked_from(None, "NTFS"));
        // FAT keeps only a day, exFAT/ReFS/network drives are not covered.
        assert!(!tracked_from(Some(0), "FAT32"));
        assert!(!tracked_from(Some(0), "exFAT"));
        assert!(!tracked_from(Some(0), ""));
    }
}
