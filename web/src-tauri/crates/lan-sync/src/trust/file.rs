//! Persistent trust list: one JSON file, replaced atomically on every change (write a sibling temp
//! file, then rename). Fail-closed: a file that exists but cannot be read or parsed is an error
//! (the hub does not start; it never silently begins with an empty list), and a change that cannot
//! be written is refused: an `add` is rolled back, a `revoke` stays revoked in memory (towards closed).

use super::{Device, ExchangeGrant, MemoryTrustStore, RemoteGrant, TrustError, TrustStore};
use crate::input::wire::Level;
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
    /// Remote-control grant (`off` | `media` | `full`). The three fields are missing in files
    /// written before remote control existed: missing = no grant.
    #[serde(default = "level_off")]
    remote: String,
    #[serde(default, rename = "remotePaused")]
    remote_paused: bool,
    #[serde(default = "yes", rename = "remoteUnlock")]
    remote_unlock: bool,
    /// Power actions allowed (missing in older files = no).
    #[serde(default, rename = "remotePower")]
    remote_power: bool,
    /// Programs of the PC's list may be started (missing in older files = no).
    #[serde(default, rename = "remotePrograms")]
    remote_programs: bool,
    /// Device exchange allowed (missing in older files = no).
    #[serde(default)]
    exchange: bool,
    #[serde(default, rename = "exchangePaused")]
    exchange_paused: bool,
}

fn level_off() -> String {
    level_name(Level::Off).to_owned()
}

fn yes() -> bool {
    true
}

fn level_name(l: Level) -> &'static str {
    match l {
        Level::Off => "off",
        Level::Media => "media",
        Level::Full => "full",
    }
}

fn level_from(name: &str) -> Option<Level> {
    [Level::Off, Level::Media, Level::Full]
        .into_iter()
        .find(|l| level_name(*l) == name)
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
    /// The last write failed: memory is ahead of the file (H5). A revoke is then written again on
    /// the next try instead of reporting "nothing changed".
    unsaved: std::sync::atomic::AtomicBool,
}

/// Writes and flushes to disk before the caller renames the file into place.
pub(crate) fn write_synced(path: &std::ffi::OsStr, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let mut f = std::fs::File::create(path)?;
    f.write_all(bytes)?;
    f.sync_all()
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
                    // an unknown level is a broken file, never "probably full" or "probably off"
                    let level = level_from(&d.remote).ok_or(OpenError::Corrupt)?;
                    if d.revoked {
                        mem.revoke(&PublicKey::from_bytes(key))
                            .map_err(|_| OpenError::Corrupt)?;
                    } else {
                        mem.set_remote(
                            &PublicKey::from_bytes(key),
                            RemoteGrant {
                                level,
                                paused: d.remote_paused,
                                unlock: d.remote_unlock,
                                power: d.remote_power,
                                programs: d.remote_programs,
                            },
                        )
                        .map_err(|_| OpenError::Corrupt)?;
                        mem.set_exchange(
                            &PublicKey::from_bytes(key),
                            ExchangeGrant {
                                on: d.exchange,
                                paused: d.exchange_paused,
                            },
                        )
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
            unsaved: std::sync::atomic::AtomicBool::new(false),
        })
    }

    /// Writes the list and remembers whether memory is now ahead of the file.
    fn persist(&self) -> Result<(), TrustError> {
        let result = self.write_list();
        self.unsaved
            .store(result.is_err(), std::sync::atomic::Ordering::SeqCst);
        result
    }

    fn write_list(&self) -> Result<(), TrustError> {
        let list = FileList {
            v: 1,
            devices: self
                .mem
                .list()
                .into_iter()
                .map(|d| {
                    let grant = self.mem.remote_of(&d.key);
                    let exchange = self.mem.exchange_of(&d.key);
                    FileDevice {
                        key: to_hex(d.key.as_bytes()),
                        name: d.name,
                        last_seen: d.last_seen,
                        revoked: d.revoked,
                        remote: level_name(grant.level).to_owned(),
                        remote_paused: grant.paused,
                        remote_unlock: grant.unlock,
                        remote_power: grant.power,
                        remote_programs: grant.programs,
                        exchange: exchange.on,
                        exchange_paused: exchange.paused,
                    }
                })
                .collect(),
        };
        let bytes = serde_json::to_vec(&list).map_err(|_| TrustError::Storage)?;
        let mut tmp = self.path.clone().into_os_string();
        tmp.push(".tmp");
        write_synced(&tmp, &bytes).map_err(|_| TrustError::Storage)?;
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
        // H5: an earlier write failed, so the revocation may only be in memory: write it again
        if changed || self.unsaved.load(std::sync::atomic::Ordering::SeqCst) {
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

    fn remote_of(&self, key: &PublicKey) -> RemoteGrant {
        self.mem.remote_of(key)
    }

    /// A change that gives control and cannot be written is rolled back; one that only takes
    /// control away stays in memory (towards closed), like `revoke`.
    fn set_remote(&self, key: &PublicKey, grant: RemoteGrant) -> Result<(), TrustError> {
        let _g = self.io.lock().map_err(|_| TrustError::Storage)?;
        let old = self.mem.remote_of(key);
        self.mem.set_remote(key, grant)?;
        if let Err(e) = self.persist() {
            if grant.widens(&old) {
                let _ = self.mem.set_remote(key, old);
            }
            return Err(e);
        }
        Ok(())
    }

    fn exchange_of(&self, key: &PublicKey) -> ExchangeGrant {
        self.mem.exchange_of(key)
    }

    /// Like `set_remote`: a widening that cannot be written is rolled back, a narrowing stays.
    fn set_exchange(&self, key: &PublicKey, grant: ExchangeGrant) -> Result<(), TrustError> {
        let _g = self.io.lock().map_err(|_| TrustError::Storage)?;
        let old = self.mem.exchange_of(key);
        self.mem.set_exchange(key, grant)?;
        if let Err(e) = self.persist() {
            if grant.widens(&old) {
                let _ = self.mem.set_exchange(key, old);
            }
            return Err(e);
        }
        Ok(())
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

    // H5 (launch review 2026-11): a revoke that could not be written is not "done". Asking again
    // must write it again (and say so while it still fails); otherwise the device is trusted
    // again after a restart while the page believes it is gone.
    #[test]
    fn a_revoke_that_could_not_be_written_is_written_on_the_next_try() {
        let d = dir("revoke-retry");
        let path = d.join("trust.json");
        let s = FileTrustStore::open(&path).unwrap();
        s.add(dev(1)).unwrap();
        let blocker = d.join("trust.json.tmp");
        std::fs::create_dir_all(&blocker).unwrap();
        assert_eq!(s.revoke(&dev(1).key), Err(TrustError::Storage));
        assert_eq!(
            s.revoke(&dev(1).key),
            Err(TrustError::Storage),
            "still not on disk: not reported as done"
        );
        std::fs::remove_dir_all(&blocker).unwrap();
        assert_eq!(s.revoke(&dev(1).key), Ok(false), "written now");
        let again = FileTrustStore::open(&path).unwrap();
        assert!(
            again.find_by_key(&dev(1).key).unwrap().revoked,
            "survives a restart"
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

    #[test]
    fn a_file_from_before_remote_control_opens_with_no_grant_for_anybody() {
        let d = dir("old-file");
        let path = d.join("trust.json");
        let key = to_hex(&[7u8; 32]);
        let old = format!(
            r#"{{"v":1,"devices":[{{"key":"{key}","name":"Phone","lastSeen":1000,"revoked":false}}]}}"#
        );
        std::fs::write(&path, &old).unwrap();
        let s = FileTrustStore::open(&path).unwrap();
        let k = PublicKey::from_bytes([7u8; 32]);
        assert_eq!(s.find_by_key(&k).unwrap().last_seen, Some(1000));
        assert_eq!(s.remote_of(&k), RemoteGrant::default());
        assert_eq!(s.remote_of(&k).level, Level::Off);
        // nothing was rewritten just by opening
        assert_eq!(std::fs::read_to_string(&path).unwrap(), old);
        std::fs::remove_dir_all(d).ok();
    }

    #[test]
    fn exchange_grants_survive_a_restart_old_files_have_none_and_revoke_clears() {
        let d = dir("exchange");
        let path = d.join("trust.json");
        {
            let s = FileTrustStore::open(&path).unwrap();
            for b in 1..=3 {
                s.add(dev(b)).unwrap();
            }
            let on = ExchangeGrant {
                on: true,
                paused: false,
            };
            s.set_exchange(&dev(1).key, on).unwrap();
            s.set_exchange(
                &dev(2).key,
                ExchangeGrant {
                    on: true,
                    paused: true,
                },
            )
            .unwrap();
            s.set_exchange(&dev(3).key, on).unwrap();
            s.revoke(&dev(3).key).unwrap();
        }
        let text = std::fs::read_to_string(&path).unwrap();
        assert!(text.contains(r#""exchange":true"#) && text.contains(r#""exchangePaused":true"#));
        let s = FileTrustStore::open(&path).unwrap();
        assert!(s.exchange_of(&dev(1).key).effective());
        assert!(s.exchange_of(&dev(2).key).on && !s.exchange_of(&dev(2).key).effective());
        assert_eq!(
            s.exchange_of(&dev(3).key),
            ExchangeGrant::default(),
            "revoked"
        );
        // a file from before device exchange: nobody has it
        let old = d.join("old.json");
        std::fs::write(
            &old,
            format!(
                r#"{{"v":1,"devices":[{{"key":"{}","name":"P","lastSeen":null,"revoked":false}}]}}"#,
                to_hex(dev(1).key.as_bytes())
            ),
        )
        .unwrap();
        let s = FileTrustStore::open(&old).unwrap();
        assert_eq!(s.exchange_of(&dev(1).key), ExchangeGrant::default());
    }

    #[test]
    fn grants_survive_a_restart_and_a_revoked_device_keeps_none() {
        let d = dir("grants");
        let path = d.join("trust.json");
        let full_paused = RemoteGrant {
            level: Level::Full,
            paused: true,
            unlock: false,
            power: false,
            programs: false,
        };
        {
            let s = FileTrustStore::open(&path).unwrap();
            s.add(dev(1)).unwrap();
            s.add(dev(2)).unwrap();
            s.add(dev(3)).unwrap();
            s.set_remote(&dev(1).key, full_paused).unwrap();
            s.set_remote(
                &dev(2).key,
                RemoteGrant {
                    level: Level::Media,
                    power: true,
                    ..RemoteGrant::default()
                },
            )
            .unwrap();
            s.set_remote(&dev(3).key, full_paused).unwrap();
            s.revoke(&dev(3).key).unwrap();
            s.add(dev(4)).unwrap();
            s.set_remote(
                &dev(4).key,
                RemoteGrant {
                    level: Level::Full,
                    programs: true,
                    ..RemoteGrant::default()
                },
            )
            .unwrap();
        }
        let text = std::fs::read_to_string(&path).unwrap();
        assert!(text.contains(r#""remote":"full""#) && text.contains(r#""remotePaused":true"#));
        assert!(text.contains(r#""remote":"media""#) && text.contains(r#""remoteUnlock":false"#));
        let s = FileTrustStore::open(&path).unwrap();
        assert_eq!(s.remote_of(&dev(1).key), full_paused);
        assert_eq!(s.remote_of(&dev(2).key).level, Level::Media);
        assert!(s.remote_of(&dev(2).key).unlock);
        assert!(text.contains(r#""remotePower":true"#));
        assert!(s.remote_of(&dev(2).key).power && !s.remote_of(&dev(1).key).power);
        assert!(text.contains(r#""remotePrograms":true"#));
        assert!(s.remote_of(&dev(4).key).programs && s.remote_of(&dev(4).key).programs_effective());
        assert!(!s.remote_of(&dev(1).key).programs && !s.remote_of(&dev(2).key).programs);
        assert_eq!(s.remote_of(&dev(3).key), RemoteGrant::default(), "revoked");
        // nothing about use is in the file: only the five settings per device
        for word in ["remoteUsed", "usedAt", "lastInput", "lastRemote"] {
            assert!(!text.contains(word), "{word}");
        }
        // an unknown level is a broken file, never a guess
        std::fs::write(
            &path,
            text.replace(r#""remote":"media""#, r#""remote":"all""#),
        )
        .unwrap();
        assert_eq!(FileTrustStore::open(&path).err(), Some(OpenError::Corrupt));
        std::fs::remove_dir_all(d).ok();
    }

    #[test]
    fn a_grant_that_cannot_be_written_is_not_given_but_one_taken_away_stays_away() {
        let d = dir("grant-unwritable");
        let path = d.join("trust.json");
        let s = FileTrustStore::open(&path).unwrap();
        s.add(dev(1)).unwrap();
        let media = RemoteGrant {
            level: Level::Media,
            ..RemoteGrant::default()
        };
        s.set_remote(&dev(1).key, media).unwrap();
        std::fs::create_dir_all(d.join("trust.json.tmp")).unwrap();
        // widening: rolled back
        let full = RemoteGrant {
            level: Level::Full,
            ..media
        };
        assert_eq!(s.set_remote(&dev(1).key, full), Err(TrustError::Storage));
        assert_eq!(s.remote_of(&dev(1).key), media);
        // narrowing: stays in memory (towards closed)
        assert_eq!(
            s.set_remote(&dev(1).key, RemoteGrant::default()),
            Err(TrustError::Storage)
        );
        assert_eq!(s.remote_of(&dev(1).key), RemoteGrant::default());
        std::fs::remove_dir_all(d).ok();
    }
}
