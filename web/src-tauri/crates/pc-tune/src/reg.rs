//! The registry seam: read anywhere below `HKCU` and `HKLM`, **write only below
//! `HKCU\Software`** (and on the real registry only at the keys and names listed in [`WRITABLE`]). There is no function that writes to the machine hive, so nothing built on
//! this trait can need administrator rights.
//!
//! [`MemRegistry`] is the in-memory twin for tests (same key rules, case-insensitive like the
//! real one); `WinRegistry` is the real thing and has round-trip tests that run on Windows.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::Mutex;

/// A registry value. `Raw` keeps any other type byte for byte, so an undo restores exactly what
/// was there (binary, expandable strings, 64-bit numbers, lists).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "t", content = "v", rename_all = "camelCase")]
pub enum Value {
    Dword(u32),
    Sz(String),
    Raw { ty: u32, data: Vec<u8> },
}

/// `REG_BINARY`.
pub const TYPE_BINARY: u32 = 3;

impl Value {
    pub fn binary(data: &[u8]) -> Value {
        Value::Raw {
            ty: TYPE_BINARY,
            data: data.to_vec(),
        }
    }

    pub fn as_dword(&self) -> Option<u32> {
        match self {
            Value::Dword(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::Sz(s) => Some(s),
            _ => None,
        }
    }

    /// The bytes of a `REG_BINARY` value.
    pub fn as_binary(&self) -> Option<&[u8]> {
        match self {
            Value::Raw { ty, data } if *ty == TYPE_BINARY => Some(data),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RegError {
    /// The key is not below `HKCU\Software` (or is malformed): refused before anything happens.
    KeyNotAllowed,
    /// Windows refused the change.
    Failed,
    /// The value exists but could not be read exactly (access denied, too large): nothing may
    /// be changed, because there would be no exact way back.
    Unreadable,
    /// The value is no longer the one a change wrote: it was changed elsewhere since, so an
    /// undo leaves it alone.
    ChangedElsewhere,
    /// No registry on this system.
    Unsupported,
}

impl RegError {
    pub fn code(self) -> &'static str {
        match self {
            RegError::KeyNotAllowed => "key-not-allowed",
            RegError::Failed => "failed",
            RegError::Unreadable => "unreadable",
            RegError::ChangedElsewhere => "changed-elsewhere",
            RegError::Unsupported => "unsupported",
        }
    }
}

/// A key that may be written: `Software\…` with at least one more segment, backslash-separated,
/// ASCII only, no empty, `.`/`..` or over-long segments, no control characters. Never a policy key (any
/// segment `Policies`: Windows would show "managed by your organisation") and never
/// `Software\Classes` (file and COM registration). (Hive names are not part of a
/// key here: the hive is chosen by the function, and only the user hive has write functions.)
pub fn valid_key(key: &str) -> bool {
    // ASCII only: the registry folds case with its own table, so a look-alike letter could
    // otherwise stand in for a refused name. Every key the catalogues use is ASCII.
    if key.len() > 512
        || key.contains('/')
        || !key.is_ascii()
        || key.chars().any(|c| c.is_control())
    {
        return false;
    }
    let segs: Vec<&str> = key.split('\\').collect();
    segs.len() >= 2
        && segs[0].eq_ignore_ascii_case("software")
        && !segs[1].eq_ignore_ascii_case("classes")
        && !segs.iter().any(|s| s.eq_ignore_ascii_case("policies"))
        && segs
            .iter()
            .all(|s| !s.is_empty() && *s != "." && *s != ".." && s.len() <= 255)
}

/// What the real registry lets this crate write, in full: the keys the catalogues use, and for
/// a key that holds other settings too, the one value name. [`valid_key`] is the general rule
/// (and all the in-memory fake checks); this list is the second lock on the real thing, so not
/// even a hand-edited journal file can make an undo write anywhere else.
pub const WRITABLE: &[(&str, Option<&str>)] = &[
    // Autostart: Windows' own "switched off" notes, one value per entry (startup.rs).
    (
        r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run",
        None,
    ),
    (
        r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder",
        None,
    ),
    // Settings catalogue (tweaks.rs): the two entries that are registry values.
    (
        r"Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo",
        Some("Enabled"),
    ),
    (
        r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
        Some("Start_TrackProgs"),
    ),
];

/// Whether the real registry may be written at `key`, value `name`.
pub fn writable(key: &str, name: &str) -> bool {
    valid_key(key)
        && valid_name(name)
        && !name.is_empty()
        && (WRITABLE.iter().any(|(k, n)| {
            k.eq_ignore_ascii_case(key) && n.is_none_or(|n| n.eq_ignore_ascii_case(name))
        }) || (cfg!(test) && key.starts_with(r"Software\NemoPcTuneTest\")))
}

/// A value name the seam writes: not over-long, no control characters.
pub(crate) fn valid_name(name: &str) -> bool {
    name.len() <= 255 && !name.chars().any(|c| c.is_control())
}

pub trait Registry: Send + Sync {
    /// A value of the current user (`HKCU\<key>`), byte for byte. `Ok(None)` only when the key
    /// or the value really is missing; a value that exists but cannot be read is an error, so
    /// a caller never mistakes it for "nothing there" (an undo would then delete it).
    fn get(&self, key: &str, name: &str) -> Result<Option<Value>, RegError>;
    /// All values of a key of the current user (empty when the key is missing). For display
    /// only: values that cannot be read are left out, so never take an undo value from here.
    fn list(&self, key: &str) -> Vec<(String, Value)>;
    /// A machine-wide value (`HKLM\<key>`, 64-bit view). Read only.
    fn machine_get(&self, key: &str, name: &str) -> Result<Option<Value>, RegError>;
    /// All values of a machine-wide key. Read only.
    fn machine_list(&self, key: &str) -> Vec<(String, Value)>;
    /// Sets a value of the current user; the key is created when missing.
    fn set(&self, key: &str, name: &str, value: &Value) -> Result<(), RegError>;
    /// Removes a value of the current user; a missing value is fine.
    fn delete(&self, key: &str, name: &str) -> Result<(), RegError>;

    /// Puts back what was there before: the old value, or no value at all.
    fn restore(&self, key: &str, name: &str, previous: Option<&Value>) -> Result<(), RegError> {
        match previous {
            Some(v) => self.set(key, name, v),
            None => self.delete(key, name),
        }
    }
}

type Store = BTreeMap<(String, String), (String, Value)>;

/// In-memory registry for tests: same rules as the real one.
#[derive(Default)]
pub struct MemRegistry {
    user: Mutex<Store>,
    machine: Mutex<Store>,
    /// Makes every write fail (to test that a failed change leaves no journal entry).
    pub fail_writes: std::sync::atomic::AtomicBool,
    /// Makes every single-value read fail (a value that exists but cannot be read).
    pub fail_reads: std::sync::atomic::AtomicBool,
}

fn slot(key: &str, name: &str) -> (String, String) {
    (key.to_lowercase(), name.to_lowercase())
}

fn list_of(store: &Mutex<Store>, key: &str) -> Vec<(String, Value)> {
    let k = key.to_lowercase();
    store
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .iter()
        .filter(|((kk, _), _)| *kk == k)
        .map(|(_, (name, v))| (name.clone(), v.clone()))
        .collect()
}

impl MemRegistry {
    pub fn new() -> MemRegistry {
        MemRegistry::default()
    }

    /// Test set-up: a machine-wide value (there is no way to write one through the trait).
    pub fn seed_machine(&self, key: &str, name: &str, value: Value) {
        self.machine
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(slot(key, name), (name.to_string(), value));
    }

    /// Number of user values (to assert that nothing was written).
    pub fn user_len(&self) -> usize {
        self.user.lock().unwrap_or_else(|e| e.into_inner()).len()
    }
}

impl Registry for MemRegistry {
    fn get(&self, key: &str, name: &str) -> Result<Option<Value>, RegError> {
        if self.fail_reads.load(std::sync::atomic::Ordering::Relaxed) {
            return Err(RegError::Unreadable);
        }
        Ok(self
            .user
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(&slot(key, name))
            .map(|(_, v)| v.clone()))
    }

    fn list(&self, key: &str) -> Vec<(String, Value)> {
        list_of(&self.user, key)
    }

    fn machine_get(&self, key: &str, name: &str) -> Result<Option<Value>, RegError> {
        Ok(self
            .machine
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(&slot(key, name))
            .map(|(_, v)| v.clone()))
    }

    fn machine_list(&self, key: &str) -> Vec<(String, Value)> {
        list_of(&self.machine, key)
    }

    fn set(&self, key: &str, name: &str, value: &Value) -> Result<(), RegError> {
        if !valid_key(key) || !valid_name(name) {
            return Err(RegError::KeyNotAllowed);
        }
        if self.fail_writes.load(std::sync::atomic::Ordering::Relaxed) {
            return Err(RegError::Failed);
        }
        self.user
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(slot(key, name), (name.to_string(), value.clone()));
        Ok(())
    }

    fn delete(&self, key: &str, name: &str) -> Result<(), RegError> {
        if !valid_key(key) || !valid_name(name) {
            return Err(RegError::KeyNotAllowed);
        }
        if self.fail_writes.load(std::sync::atomic::Ordering::Relaxed) {
            return Err(RegError::Failed);
        }
        self.user
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&slot(key, name));
        Ok(())
    }
}

/// The registry of this Windows machine.
#[cfg(windows)]
pub struct WinRegistry;

#[cfg(windows)]
mod win {
    use super::*;
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::{
        ERROR_FILE_NOT_FOUND, ERROR_MORE_DATA, ERROR_PATH_NOT_FOUND, ERROR_SUCCESS,
    };
    use windows::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegDeleteKeyValueW, RegEnumValueW, RegOpenKeyExW,
        RegQueryValueExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ,
        KEY_SET_VALUE, KEY_WOW64_64KEY, REG_OPTION_NON_VOLATILE, REG_SAM_FLAGS, REG_VALUE_TYPE,
    };

    const REG_SZ: u32 = 1;
    const REG_DWORD: u32 = 4;
    /// Largest value read (a startup command or a small binary). A bigger one is reported as
    /// unreadable by `get` and left out by `list`.
    const MAX_DATA: usize = 1024 * 1024;
    const MAX_VALUES: u32 = 2000;

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// A string becomes `Sz` only when writing it back gives the same bytes; anything else (no
    /// terminator, data after it, half a character) stays `Raw`, so an undo is exact.
    fn decode(ty: u32, data: &[u8]) -> Value {
        match ty {
            REG_DWORD if data.len() == 4 => {
                Value::Dword(u32::from_le_bytes([data[0], data[1], data[2], data[3]]))
            }
            REG_SZ if data.len() % 2 == 0 && data.len() >= 2 => {
                let units: Vec<u16> = data
                    .chunks_exact(2)
                    .map(|c| u16::from_le_bytes([c[0], c[1]]))
                    .collect();
                let text = &units[..units.len() - 1];
                match String::from_utf16(text) {
                    Ok(s) if units[units.len() - 1] == 0 && !text.contains(&0) => Value::Sz(s),
                    _ => Value::Raw {
                        ty,
                        data: data.to_vec(),
                    },
                }
            }
            _ => Value::Raw {
                ty,
                data: data.to_vec(),
            },
        }
    }

    fn encode(value: &Value) -> (u32, Vec<u8>) {
        match value {
            Value::Dword(n) => (REG_DWORD, n.to_le_bytes().to_vec()),
            Value::Sz(s) => (
                REG_SZ,
                wide(s).iter().flat_map(|u| u.to_le_bytes()).collect(),
            ),
            Value::Raw { ty, data } => (*ty, data.clone()),
        }
    }

    /// All values of `hive\key`, read with one open handle.
    fn values(hive: HKEY, access: REG_SAM_FLAGS, key: &str) -> Vec<(String, Value)> {
        let mut out = Vec::new();
        let key_w = wide(key);
        let mut handle = HKEY::default();
        // SAFETY: `key_w` is NUL-terminated and outlives the call; `handle` is a local that is
        // closed below when the open succeeded. Buffers passed to RegEnumValueW are locals whose
        // lengths are passed along and updated by the call.
        unsafe {
            if RegOpenKeyExW(hive, PCWSTR(key_w.as_ptr()), None, access, &mut handle)
                != ERROR_SUCCESS
            {
                return out;
            }
            let mut name = vec![0u16; 16_384];
            let mut data = vec![0u8; 4096];
            let mut index = 0;
            while index < MAX_VALUES {
                let mut name_len = name.len() as u32;
                let mut data_len = data.len() as u32;
                let mut ty = 0u32;
                let rc = RegEnumValueW(
                    handle,
                    index,
                    Some(PWSTR(name.as_mut_ptr())),
                    &mut name_len,
                    None,
                    Some(&mut ty),
                    Some(data.as_mut_ptr()),
                    Some(&mut data_len),
                );
                if rc == ERROR_MORE_DATA && data.len() < MAX_DATA {
                    data.resize(MAX_DATA, 0);
                    continue;
                }
                if rc == ERROR_SUCCESS {
                    let n = String::from_utf16_lossy(&name[..name_len as usize]);
                    out.push((n, decode(ty, &data[..data_len as usize])));
                } else if rc != ERROR_MORE_DATA {
                    break;
                }
                index += 1;
            }
            let _ = RegCloseKey(handle);
        }
        out
    }

    /// One value, byte for byte. `Ok(None)` only for "key or value not there".
    fn value(
        hive: HKEY,
        access: REG_SAM_FLAGS,
        key: &str,
        name: &str,
    ) -> Result<Option<Value>, RegError> {
        let (key_w, name_w) = (wide(key), wide(name));
        let mut handle = HKEY::default();
        // SAFETY: both strings are NUL-terminated locals that outlive the calls; `handle` is
        // closed on every path after a successful open; the data buffer is a local whose length
        // is passed along and updated by the call.
        unsafe {
            let rc = RegOpenKeyExW(hive, PCWSTR(key_w.as_ptr()), None, access, &mut handle);
            if rc == ERROR_FILE_NOT_FOUND || rc == ERROR_PATH_NOT_FOUND {
                return Ok(None);
            }
            if rc != ERROR_SUCCESS {
                return Err(RegError::Unreadable);
            }
            let mut data = vec![0u8; 512];
            let mut result = Err(RegError::Unreadable);
            // A second round when the value is bigger than the first buffer (the call says how
            // big); a third only if it grew in between.
            for _ in 0..3 {
                let mut ty = REG_VALUE_TYPE(0);
                let mut len = data.len() as u32;
                let rc = RegQueryValueExW(
                    handle,
                    PCWSTR(name_w.as_ptr()),
                    None,
                    Some(&mut ty),
                    Some(data.as_mut_ptr()),
                    Some(&mut len),
                );
                if rc == ERROR_SUCCESS {
                    result = Ok(Some(decode(ty.0, &data[..len as usize])));
                    break;
                }
                if rc == ERROR_FILE_NOT_FOUND {
                    result = Ok(None);
                    break;
                }
                if rc != ERROR_MORE_DATA || len as usize > MAX_DATA {
                    break;
                }
                data.resize(len as usize, 0);
            }
            let _ = RegCloseKey(handle);
            result
        }
    }

    impl Registry for WinRegistry {
        fn get(&self, key: &str, name: &str) -> Result<Option<Value>, RegError> {
            value(HKEY_CURRENT_USER, KEY_READ, key, name)
        }

        fn list(&self, key: &str) -> Vec<(String, Value)> {
            values(HKEY_CURRENT_USER, KEY_READ, key)
        }

        fn machine_get(&self, key: &str, name: &str) -> Result<Option<Value>, RegError> {
            value(HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_64KEY, key, name)
        }

        fn machine_list(&self, key: &str) -> Vec<(String, Value)> {
            values(HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_64KEY, key)
        }

        fn set(&self, key: &str, name: &str, value: &Value) -> Result<(), RegError> {
            if !writable(key, name) {
                return Err(RegError::KeyNotAllowed);
            }
            let (ty, data) = encode(value);
            let (key_w, name_w) = (wide(key), wide(name));
            let mut handle = HKEY::default();
            // The key is opened (created when missing) and the value stored with
            // `RegSetValueExW`, which keeps the bytes exactly as given. (`RegSetKeyValueW` adds a
            // terminator to a string that has none, so an undo would not be byte for byte.)
            // SAFETY: both strings are NUL-terminated locals; `handle` is closed after a
            // successful open; `data` is a slice that outlives the call. The hive is the constant
            // HKEY_CURRENT_USER.
            let rc = unsafe {
                let opened = RegCreateKeyExW(
                    HKEY_CURRENT_USER,
                    PCWSTR(key_w.as_ptr()),
                    None,
                    PCWSTR::null(),
                    REG_OPTION_NON_VOLATILE,
                    KEY_SET_VALUE,
                    None,
                    &mut handle,
                    None,
                );
                if opened != ERROR_SUCCESS {
                    return Err(RegError::Failed);
                }
                let rc = RegSetValueExW(
                    handle,
                    PCWSTR(name_w.as_ptr()),
                    None,
                    REG_VALUE_TYPE(ty),
                    Some(&data),
                );
                let _ = RegCloseKey(handle);
                rc
            };
            if rc == ERROR_SUCCESS {
                Ok(())
            } else {
                Err(RegError::Failed)
            }
        }

        fn delete(&self, key: &str, name: &str) -> Result<(), RegError> {
            if !writable(key, name) {
                return Err(RegError::KeyNotAllowed);
            }
            let (key_w, name_w) = (wide(key), wide(name));
            // SAFETY: both strings are NUL-terminated locals; the hive is HKEY_CURRENT_USER.
            let rc = unsafe {
                RegDeleteKeyValueW(
                    HKEY_CURRENT_USER,
                    PCWSTR(key_w.as_ptr()),
                    PCWSTR(name_w.as_ptr()),
                )
            };
            if rc == ERROR_SUCCESS || rc == ERROR_FILE_NOT_FOUND {
                Ok(())
            } else {
                Err(RegError::Failed)
            }
        }
    }

    /// Round trips against the real registry, below a throw-away key of the current user.
    #[cfg(test)]
    mod tests {
        use super::*;
        use windows::Win32::System::Registry::RegDeleteTreeW;

        struct TestKey(String);

        impl TestKey {
            fn new(tag: &str) -> TestKey {
                TestKey(format!(
                    r"Software\NemoPcTuneTest\{tag}-{}",
                    std::process::id()
                ))
            }
        }

        impl Drop for TestKey {
            fn drop(&mut self) {
                let w = wide(&self.0);
                // SAFETY: NUL-terminated local; removes only the test's own key.
                unsafe {
                    let _ = RegDeleteTreeW(HKEY_CURRENT_USER, PCWSTR(w.as_ptr()));
                }
            }
        }

        #[test]
        fn values_round_trip_with_their_type() {
            let k = TestKey::new("roundtrip");
            let r = WinRegistry;
            assert_eq!(r.get(&k.0, "missing"), Ok(None));
            assert_eq!(r.get(r"Software\NemoPcTuneTest\no-such-key", "x"), Ok(None));
            let cases = [
                ("num", Value::Dword(0xDEAD_BEEF)),
                (
                    "text",
                    Value::Sz("C:\\Program Files\\Ä ö\\app.exe --flag".into()),
                ),
                ("empty", Value::Sz(String::new())),
                ("bin", Value::binary(&[2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                (
                    "expand",
                    Value::Raw {
                        ty: 2,
                        data: wide("%TEMP%\\x")
                            .iter()
                            .flat_map(|u| u.to_le_bytes())
                            .collect(),
                    },
                ),
            ];
            for (name, v) in &cases {
                r.set(&k.0, name, v).unwrap();
                assert_eq!(r.get(&k.0, name).as_ref(), Ok(&Some(v.clone())), "{name}");
            }
            assert_eq!(r.list(&k.0).len(), cases.len());
            // Names are case-insensitive, like the registry itself.
            assert_eq!(r.get(&k.0, "NUM"), Ok(Some(Value::Dword(0xDEAD_BEEF))));
        }

        #[test]
        fn restore_puts_back_the_old_value_or_removes_the_new_one() {
            let k = TestKey::new("restore");
            let r = WinRegistry;
            r.set(&k.0, "a", &Value::Dword(1)).unwrap();
            let before = r.get(&k.0, "a").unwrap();
            r.set(&k.0, "a", &Value::Dword(0)).unwrap();
            r.restore(&k.0, "a", before.as_ref()).unwrap();
            assert_eq!(r.get(&k.0, "a"), Ok(Some(Value::Dword(1))));

            let before = r.get(&k.0, "b").unwrap();
            r.set(&k.0, "b", &Value::Sz("x".into())).unwrap();
            r.restore(&k.0, "b", before.as_ref()).unwrap();
            assert_eq!(r.get(&k.0, "b"), Ok(None));
            // Deleting what is not there is fine.
            r.delete(&k.0, "b").unwrap();
        }

        #[test]
        fn a_large_value_is_read_completely() {
            let k = TestKey::new("large");
            let r = WinRegistry;
            let v = Value::binary(&vec![7u8; 20_000]);
            r.set(&k.0, "big", &v).unwrap();
            assert_eq!(r.get(&k.0, "big"), Ok(Some(v)));
        }

        #[test]
        fn odd_strings_come_back_byte_for_byte() {
            let k = TestKey::new("oddsz");
            let r = WinRegistry;
            // No terminator, data after a NUL, an odd length: each must survive a round trip.
            for (name, data) in [
                ("bare", vec![b'a', 0, b'b', 0]),
                ("inner", vec![b'a', 0, 0, 0, b'b', 0, 0, 0]),
                ("odd", vec![b'a', 0, 0]),
                ("none", vec![]),
            ] {
                let v = Value::Raw { ty: 1, data };
                r.set(&k.0, name, &v).unwrap();
                assert_eq!(r.get(&k.0, name), Ok(Some(v)), "{name}");
            }
        }

        #[test]
        fn keys_outside_software_are_refused_before_anything_is_written() {
            let r = WinRegistry;
            for key in [
                "Environment",
                r"System\CurrentControlSet",
                r"..\Software\x",
                "",
            ] {
                assert_eq!(
                    r.set(key, "x", &Value::Dword(1)),
                    Err(RegError::KeyNotAllowed),
                    "{key}"
                );
                assert_eq!(r.delete(key, "x"), Err(RegError::KeyNotAllowed), "{key}");
            }
        }

        #[test]
        fn the_machine_hive_is_readable() {
            let r = WinRegistry;
            let v = r.machine_get(
                r"SOFTWARE\Microsoft\Windows NT\CurrentVersion",
                "CurrentBuildNumber",
            );
            assert!(matches!(v, Ok(Some(Value::Sz(s))) if !s.is_empty()));
            assert!(!r
                .machine_list(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
                .is_empty());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_keys_below_software_may_be_written() {
        for ok in [
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
            r"SOFTWARE\Microsoft\GameBar",
            r"software\x",
        ] {
            assert!(valid_key(ok), "{ok}");
        }
        for bad in [
            "",
            "Software",
            r"Software\",
            r"\Software\x",
            r"Software\\x",
            r"Software\..\System",
            r"Software\.\x",
            r"System\CurrentControlSet\Services",
            r"Environment",
            r"HKLM\Software\x",
            r"HKEY_LOCAL_MACHINE\Software\x",
            r"Control Panel\Desktop",
            "Software/Microsoft",
            "Software\\x\0y",
            "Software\\x\ny",
            r"Software\Policies\Microsoft\Windows\Explorer",
            r"SOFTWARE\POLICIES\x",
            r"Software\Microsoft\Windows\CurrentVersion\Policies\Explorer",
            r"Software\Classes\.txt",
            r"software\classes\CLSID\x",
            "Software\\Cla\u{17f}\u{17f}es\\x",
            "Software\\Pol\u{131}cies\\x",
            "Software\\Übung",
        ] {
            assert!(!valid_key(bad), "{bad:?}");
        }
        assert!(!valid_key(&format!(r"Software\{}", "a".repeat(600))));
    }

    #[test]
    fn the_real_registry_may_only_be_written_at_the_listed_keys_and_names() {
        for (k, name) in WRITABLE {
            assert!(valid_key(k), "{k}");
            assert!(
                writable(&k.to_uppercase(), name.unwrap_or("Any entry")),
                "{k}"
            );
        }
        const ADVANCED: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced";
        assert!(writable(ADVANCED, "start_trackprogs"));
        // The same key holds other settings: those are not ours to write.
        for other in ["Hidden", "HideFileExt", "ShowSuperHidden", ""] {
            assert!(!writable(ADVANCED, other), "{other}");
        }
        for bad in [
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            r"Software\Microsoft\Windows\CurrentVersion\RunOnce",
            r"Software\Microsoft\Windows NT\CurrentVersion\Winlogon",
            r"Software\Microsoft\Command Processor",
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run\x",
            r"Software\X",
        ] {
            assert!(!writable(bad, "x"), "{bad}");
        }
    }

    #[test]
    fn the_fake_refuses_the_same_keys_and_writes_nothing() {
        let r = MemRegistry::new();
        assert_eq!(
            r.set(r"System\x", "a", &Value::Dword(1)),
            Err(RegError::KeyNotAllowed)
        );
        assert_eq!(r.delete("Environment", "a"), Err(RegError::KeyNotAllowed));
        assert_eq!(r.user_len(), 0);
    }

    #[test]
    fn the_fake_is_case_insensitive_and_keeps_the_written_name() {
        let r = MemRegistry::new();
        r.set(r"Software\X", "HideFileExt", &Value::Dword(0))
            .unwrap();
        assert_eq!(
            r.get(r"software\x", "hidefileext"),
            Ok(Some(Value::Dword(0)))
        );
        assert_eq!(
            r.list(r"SOFTWARE\X"),
            vec![("HideFileExt".to_string(), Value::Dword(0))]
        );
    }

    #[test]
    fn restore_puts_back_the_old_value_or_removes_the_new_one() {
        let r = MemRegistry::new();
        let key = r"Software\X";
        r.set(key, "a", &Value::Dword(1)).unwrap();
        r.set(key, "a", &Value::Dword(0)).unwrap();
        r.restore(key, "a", Some(&Value::Dword(1))).unwrap();
        assert_eq!(r.get(key, "a"), Ok(Some(Value::Dword(1))));
        r.set(key, "b", &Value::Sz("x".into())).unwrap();
        r.restore(key, "b", None).unwrap();
        assert_eq!(r.get(key, "b"), Ok(None));
    }

    #[test]
    fn a_value_that_cannot_be_read_is_an_error_not_a_missing_value() {
        let r = MemRegistry::new();
        r.set(r"Software\X", "a", &Value::Dword(1)).unwrap();
        r.fail_reads
            .store(true, std::sync::atomic::Ordering::Relaxed);
        assert_eq!(r.get(r"Software\X", "a"), Err(RegError::Unreadable));
    }

    #[test]
    fn machine_values_can_be_read_but_there_is_no_way_to_write_them() {
        let r = MemRegistry::new();
        r.seed_machine(r"SOFTWARE\M", "v", Value::Sz("x".into()));
        assert_eq!(
            r.machine_get(r"software\m", "V"),
            Ok(Some(Value::Sz("x".into())))
        );
        assert_eq!(r.machine_list(r"SOFTWARE\M").len(), 1);
        // The user hive does not see it.
        assert_eq!(r.get(r"SOFTWARE\M", "v"), Ok(None));
    }

    #[test]
    fn values_serialise_stably() {
        let json = serde_json::to_string(&Value::Dword(1)).unwrap();
        assert_eq!(json, r#"{"t":"dword","v":1}"#);
        let raw = Value::binary(&[2, 0]);
        let back: Value = serde_json::from_str(&serde_json::to_string(&raw).unwrap()).unwrap();
        assert_eq!(back, raw);
        assert_eq!(back.as_binary(), Some(&[2u8, 0][..]));
    }
}
