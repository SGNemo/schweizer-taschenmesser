//! Persistent trust list: one JSON file, replaced atomically on every change (write a sibling temp
//! file, then rename). Fail-closed: a file that exists but cannot be read or parsed is an error
//! (the hub does not start; it never silently begins with an empty list), and a change that cannot
//! be written is refused: an `add` is rolled back, a `revoke` stays revoked in memory (towards closed).

use super::{Device, MemoryTrustStore, TrustError, TrustStore};
use crate::noise::PublicKey;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Serialize, Deserialize)]
struct FileDevice {
    key: String,
    name: String,
    #[serde(rename = "lastSeen")]
    last_seen: Option<u64>,
    revoked: bool,
}

#[derive(Serialize, Deserialize)]
struct FileList {
    v: u32,
    devices: Vec<FileDevice>,
}

/// Why the list could not be opened. Carries no content.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpenError {
    Unreadable,
    Corrupt,
}

pub struct FileTrustStore {
    path: PathBuf,
    mem: MemoryTrustStore,
    /// Serialises "change memory, then write the file".
    io: Mutex<()>,
}

pub fn to_hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

pub fn from_hex32(s: &str) -> Option<[u8; 32]> {
    if s.len() != 64 || !s.is_ascii() {
        return None;
    }
    let mut out = [0u8; 32];
    for (i, o) in out.iter_mut().enumerate() {
        *o = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).ok()?;
    }
    Some(out)
}

impl FileTrustStore {
    /// A missing file is an empty list; anything else unreadable is an error.
    pub fn open(path: &Path) -> Result<Self, OpenError> {
        let mem = MemoryTrustStore::new();
        match std::fs::read(path) {
            Ok(bytes) => {
                let list: FileList =
                    serde_json::from_slice(&bytes).map_err(|_| OpenError::Corrupt)?;
                if list.v != 1 {
                    return Err(OpenError::Corrupt);
                }
                for d in list.devices {
                    let key = from_hex32(&d.key).ok_or(OpenError::Corrupt)?;
                    mem.add(Device {
                        key: PublicKey::from_bytes(key),
                        name: d.name,
                        last_seen: d.last_seen,
                        revoked: false,
                    })
                    .map_err(|_| OpenError::Corrupt)?;
                    if d.revoked {
                        mem.revoke(&PublicKey::from_bytes(key))
                            .map_err(|_| OpenError::Corrupt)?;
                    }
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err(OpenError::Unreadable),
        }
        Ok(FileTrustStore {
            path: path.to_owned(),
            mem,
            io: Mutex::new(()),
        })
    }

    fn persist(&self) -> Result<(), TrustError> {
        let list = FileList {
            v: 1,
            devices: self
                .mem
                .list()
                .into_iter()
                .map(|d| FileDevice {
                    key: to_hex(d.key.as_bytes()),
                    name: d.name,
                    last_seen: d.last_seen,
                    revoked: d.revoked,
                })
                .collect(),
        };
        let bytes = serde_json::to_vec(&list).map_err(|_| TrustError::Storage)?;
        let mut tmp = self.path.clone().into_os_string();
        tmp.push(".tmp");
        std::fs::write(&tmp, bytes).map_err(|_| TrustError::Storage)?;
        std::fs::rename(&tmp, &self.path).map_err(|_| TrustError::Storage)
    }
}

impl TrustStore for FileTrustStore {
    fn find_by_key(&self, key: &PublicKey) -> Option<Device> {
        self.mem.find_by_key(key)
    }

    fn add(&self, device: Device) -> Result<(), TrustError> {
        let _g = self.io.lock().map_err(|_| TrustError::Storage)?;
        let key = device.key;
        self.mem.add(device)?;
        if let Err(e) = self.persist() {
            let _ = self.mem.remove(&key);
            return Err(e);
        }
        Ok(())
    }

    fn remove(&self, key: &PublicKey) -> Result<(), TrustError> {
        let _g = self.io.lock().map_err(|_| TrustError::Storage)?;
        self.mem.remove(key)?;
        self.persist()
    }

    fn revoke(&self, key: &PublicKey) -> Result<bool, TrustError> {
        let _g = self.io.lock().map_err(|_| TrustError::Storage)?;
        let changed = self.mem.revoke(key)?;
        if changed {
            self.persist()?;
        }
        Ok(changed)
    }

    /// Activity is written at most once a minute per device (a file write per frame is waste).
    fn touch(&self, key: &PublicKey, at: u64) {
        let Ok(_g) = self.io.lock() else { return };
        let before = self.mem.find_by_key(key).and_then(|d| d.last_seen);
        self.mem.touch(key, at);
        if before.is_none_or(|b| at.saturating_sub(b) >= 60) {
            let _ = self.persist();
        }
    }

    fn list(&self) -> Vec<Device> {
        self.mem.list()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("lan-sync-{name}-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    fn dev(b: u8) -> Device {
        Device {
            key: PublicKey::from_bytes([b; 32]),
            name: format!("Phone {b}"),
            last_seen: None,
            revoked: false,
        }
    }

    #[test]
    fn list_survives_a_restart_including_revocations() {
        let d = dir("roundtrip");
        let path = d.join("trust.json");
        {
            let s = FileTrustStore::open(&path).unwrap();
            s.add(dev(1)).unwrap();
            s.add(dev(2)).unwrap();
            s.touch(&dev(1).key, 1000);
            assert_eq!(s.revoke(&dev(2).key), Ok(true));
        }
        let s = FileTrustStore::open(&path).unwrap();
        assert_eq!(s.find_by_key(&dev(1).key).unwrap().last_seen, Some(1000));
        assert!(!s.find_by_key(&dev(1).key).unwrap().revoked);
        assert!(s.find_by_key(&dev(2).key).unwrap().revoked);
        // a revoked key is never re-added
        assert_eq!(s.add(dev(2)), Err(TrustError::Revoked));
        std::fs::remove_dir_all(d).ok();
    }

    #[test]
    fn missing_file_is_empty_but_a_broken_one_is_an_error() {
        let d = dir("broken");
        let path = d.join("trust.json");
        assert!(FileTrustStore::open(&path).unwrap().list().is_empty());
        for bad in [
            &b"{"[..],
            br#"{"v":2,"devices":[]}"#,
            br#"{"v":1,"devices":[{"key":"zz","name":"x","lastSeen":null,"revoked":false}]}"#,
            br#"{"v":1,"devices":[{"key":"00","name":"x","lastSeen":null,"revoked":false}]}"#,
        ] {
            std::fs::write(&path, bad).unwrap();
            assert!(FileTrustStore::open(&path).is_err());
        }
        // a directory where the file should be: unreadable, not "empty"
        let as_dir = d.join("dir");
        std::fs::create_dir_all(&as_dir).unwrap();
        assert_eq!(
            FileTrustStore::open(&as_dir).err(),
            Some(OpenError::Unreadable)
        );
        std::fs::remove_dir_all(d).ok();
    }

    #[test]
    fn an_add_that_cannot_be_written_is_rolled_back_and_a_revoke_stays_revoked() {
        let d = dir("unwritable");
        let path = d.join("trust.json");
        let s = FileTrustStore::open(&path).unwrap();
        s.add(dev(1)).unwrap();
        // make every later write fail: the temp file's name is taken by a directory
        std::fs::create_dir_all(d.join("trust.json.tmp")).unwrap();
        assert_eq!(s.add(dev(2)), Err(TrustError::Storage));
        assert!(s.find_by_key(&dev(2).key).is_none(), "rolled back");
        assert_eq!(s.revoke(&dev(1).key), Err(TrustError::Storage));
        assert!(
            s.find_by_key(&dev(1).key).unwrap().revoked,
            "towards closed"
        );
        std::fs::remove_dir_all(d).ok();
    }

    #[test]
    fn hex_round_trip_and_rejects() {
        let k = [0xabu8; 32];
        assert_eq!(from_hex32(&to_hex(&k)), Some(k));
        assert_eq!(from_hex32("ab"), None);
        assert_eq!(from_hex32(&"é".repeat(32)), None);
    }
}
