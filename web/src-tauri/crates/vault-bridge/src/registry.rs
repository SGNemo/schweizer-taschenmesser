//! Registers the host for the Chromium-family browsers under HKCU (no administrator rights) and
//! writes the host manifest file. Windows only.

use crate::manifest::{
    host_manifest, manifest_path, registry_subkey, BrowserStatus, Registration, BROWSER_KEYS,
};
use std::io;
use std::path::Path;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};
use windows::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegDeleteKeyW, RegGetValueW, RegSetValueExW, HKEY,
    HKEY_CURRENT_USER, KEY_SET_VALUE, REG_OPTION_NON_VOLATILE, REG_SZ, RRF_RT_REG_SZ,
};

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn check(code: windows::Win32::Foundation::WIN32_ERROR) -> io::Result<()> {
    if code == ERROR_SUCCESS {
        Ok(())
    } else {
        Err(io::Error::from_raw_os_error(code.0 as i32))
    }
}

/// Default value of `HKCU\<subkey>`, if the key exists.
fn read_default(subkey: &str) -> Option<String> {
    let name = wide(subkey);
    let mut size = 0u32;
    unsafe {
        let probe = RegGetValueW(
            HKEY_CURRENT_USER,
            PCWSTR(name.as_ptr()),
            PCWSTR::null(),
            RRF_RT_REG_SZ,
            None,
            None,
            Some(&mut size),
        );
        if probe != ERROR_SUCCESS || size == 0 {
            return None;
        }
        let mut buf = vec![0u16; (size as usize).div_ceil(2)];
        let got = RegGetValueW(
            HKEY_CURRENT_USER,
            PCWSTR(name.as_ptr()),
            PCWSTR::null(),
            RRF_RT_REG_SZ,
            None,
            Some(buf.as_mut_ptr().cast()),
            Some(&mut size),
        );
        if got != ERROR_SUCCESS {
            return None;
        }
        let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        Some(String::from_utf16_lossy(&buf[..len]))
    }
}

fn write_default(subkey: &str, value: &str) -> io::Result<()> {
    let name = wide(subkey);
    let data = wide(value);
    unsafe {
        let mut key = HKEY::default();
        check(RegCreateKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(name.as_ptr()),
            None,
            PCWSTR::null(),
            REG_OPTION_NON_VOLATILE,
            KEY_SET_VALUE,
            None,
            &mut key,
            None,
        ))?;
        let bytes = std::slice::from_raw_parts(data.as_ptr().cast::<u8>(), data.len() * 2);
        let result = check(RegSetValueExW(
            key,
            PCWSTR::null(),
            None,
            REG_SZ,
            Some(bytes),
        ));
        let _ = RegCloseKey(key);
        result
    }
}

fn delete_key(subkey: &str) -> io::Result<()> {
    let name = wide(subkey);
    let code = unsafe { RegDeleteKeyW(HKEY_CURRENT_USER, PCWSTR(name.as_ptr())) };
    if code == ERROR_FILE_NOT_FOUND {
        Ok(())
    } else {
        check(code)
    }
}

/// Writes the manifest file and the registry entries for every supported browser.
pub fn register(exe: &Path, data_dir: &Path) -> io::Result<Registration> {
    let file = manifest_path(data_dir);
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir)?;
    }
    std::fs::write(&file, host_manifest(exe))?;
    let file_text = file.to_string_lossy().into_owned();
    for (_, base) in BROWSER_KEYS {
        write_default(&registry_subkey(base), &file_text)?;
    }
    status(exe, data_dir)
}

pub fn status(exe: &Path, data_dir: &Path) -> io::Result<Registration> {
    let file = manifest_path(data_dir);
    let file_text = file.to_string_lossy().into_owned();
    let browsers = BROWSER_KEYS
        .iter()
        .map(|(browser, base)| BrowserStatus {
            browser,
            registered: read_default(&registry_subkey(base)).as_deref() == Some(&file_text),
        })
        .collect();
    let up_to_date = std::fs::read_to_string(&file).is_ok_and(|t| t == host_manifest(exe));
    Ok(Registration {
        browsers,
        up_to_date,
        manifest: file,
    })
}

/// Removes the registry entries and the manifest file again.
pub fn unregister(data_dir: &Path) -> io::Result<()> {
    for (_, base) in BROWSER_KEYS {
        delete_key(&registry_subkey(base))?;
    }
    match std::fs::remove_file(manifest_path(data_dir)) {
        Err(e) if e.kind() != io::ErrorKind::NotFound => Err(e),
        _ => Ok(()),
    }
}
