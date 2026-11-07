//! Trust list, device key storage contract and the registry of open sessions.
//!
//! Persistence of the real list and the OS keystore live in the shell (package 2b); this module
//! holds the traits and in-memory implementations the logic is tested with.

use crate::noise::{KeyError, PublicKey, StaticKey};
use std::collections::HashMap;
use std::fmt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use zeroize::Zeroizing;

/// A paired device. The key is the identity; the name is only a label.
#[derive(Clone, PartialEq, Eq)]
pub struct Device {
    pub key: PublicKey,
    pub name: String,
    /// Unix seconds of the last authenticated frame, set by the caller.
    pub last_seen: Option<u64>,
    /// A revoked key stays in the list as a tombstone and is never trusted again.
    pub revoked: bool,
}

impl fmt::Debug for Device {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Device")
            .field("revoked", &self.revoked)
            .finish_non_exhaustive()
    }
}

/// Trust list failures. Carry no keys or names.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrustError {
    /// The key is already trusted and active.
    AlreadyTrusted,
    /// The key was revoked; "pair again" needs a fresh key on the device.
    Revoked,
    NotFound,
    Storage,
}

pub trait TrustStore: Send + Sync {
    /// Active or revoked entry for this key.
    fn find_by_key(&self, key: &PublicKey) -> Option<Device>;
    /// Adds a new active device. Refuses a key that is already listed (active or revoked).
    fn add(&self, device: Device) -> Result<(), TrustError>;
    /// Rollback of an `add` that was never reported to the user: deletes the entry. Not for
    /// unpairing (that is `revoke`).
    fn remove(&self, key: &PublicKey) -> Result<(), TrustError>;
    /// Marks the key revoked (tombstone). `Ok(false)` if it was unknown or already revoked.
    fn revoke(&self, key: &PublicKey) -> Result<bool, TrustError>;
    /// Records activity; only called after an authenticated transport frame.
    fn touch(&self, key: &PublicKey, at: u64);
    fn list(&self) -> Vec<Device>;
}

/// In-memory trust list (tests, and the logic behind the shell's persistent one).
#[derive(Default)]
pub struct MemoryTrustStore {
    devices: Mutex<HashMap<[u8; 32], Device>>,
}

impl MemoryTrustStore {
    pub fn new() -> Self {
        Self::default()
    }
}

impl TrustStore for MemoryTrustStore {
    fn find_by_key(&self, key: &PublicKey) -> Option<Device> {
        self.devices.lock().ok()?.get(key.as_bytes()).cloned()
    }

    fn add(&self, device: Device) -> Result<(), TrustError> {
        let mut map = self.devices.lock().map_err(|_| TrustError::Storage)?;
        match map.get(device.key.as_bytes()) {
            Some(d) if d.revoked => Err(TrustError::Revoked),
            Some(_) => Err(TrustError::AlreadyTrusted),
            None => {
                map.insert(*device.key.as_bytes(), device);
                Ok(())
            }
        }
    }

    fn remove(&self, key: &PublicKey) -> Result<(), TrustError> {
        let mut map = self.devices.lock().map_err(|_| TrustError::Storage)?;
        match map.get(key.as_bytes()) {
            Some(d) if !d.revoked => {
                map.remove(key.as_bytes());
                Ok(())
            }
            _ => Err(TrustError::NotFound),
        }
    }

    fn revoke(&self, key: &PublicKey) -> Result<bool, TrustError> {
        let mut map = self.devices.lock().map_err(|_| TrustError::Storage)?;
        match map.get_mut(key.as_bytes()) {
            Some(d) if !d.revoked => {
                d.revoked = true;
                Ok(true)
            }
            _ => Ok(false),
        }
    }

    fn touch(&self, key: &PublicKey, at: u64) {
        if let Ok(mut map) = self.devices.lock() {
            if let Some(d) = map.get_mut(key.as_bytes()) {
                if !d.revoked {
                    d.last_seen = Some(at);
                }
            }
        }
    }

    fn list(&self) -> Vec<Device> {
        self.devices
            .lock()
            .map(|m| m.values().cloned().collect())
            .unwrap_or_default()
    }
}

/// Key store failures. Carry no bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyStoreError {
    /// The stored key exists but cannot be read or is malformed. Never answered by making a new one.
    Corrupt,
    Unavailable,
    Key(KeyError),
}

/// Where the hub's (or a client's) static key lives: the OS keystore (CONCEPT §3), never IndexedDB,
/// never a backup. Fail-closed: any error means the hub does not start. No in-memory or plaintext
/// fallback, and a corrupt key is never silently replaced.
pub trait StaticKeyStore: Send + Sync {
    /// The stored key, or a new one if (and only if) the store is positively empty.
    fn load_or_create(&self) -> Result<StaticKey, KeyStoreError>;
    /// Replaces the key atomically ("Neu koppeln"); the old secret is zeroized.
    fn regenerate(&self) -> Result<StaticKey, KeyStoreError>;
}

/// Key store for tests and tools. Production wiring (2b) must use the OS keystore.
pub struct MemoryKeyStore {
    secret: Mutex<Option<Zeroizing<[u8; 32]>>>,
}

impl MemoryKeyStore {
    pub fn empty() -> Self {
        MemoryKeyStore {
            secret: Mutex::new(None),
        }
    }
}

impl StaticKeyStore for MemoryKeyStore {
    fn load_or_create(&self) -> Result<StaticKey, KeyStoreError> {
        let mut slot = self.secret.lock().map_err(|_| KeyStoreError::Unavailable)?;
        match slot.as_ref() {
            Some(s) => {
                StaticKey::from_secret_bytes(Zeroizing::new(**s)).map_err(KeyStoreError::Key)
            }
            None => {
                let k = StaticKey::generate().map_err(KeyStoreError::Key)?;
                *slot = Some(k.to_secret_bytes());
                Ok(k)
            }
        }
    }

    fn regenerate(&self) -> Result<StaticKey, KeyStoreError> {
        let k = StaticKey::generate().map_err(KeyStoreError::Key)?;
        let mut slot = self.secret.lock().map_err(|_| KeyStoreError::Unavailable)?;
        // assigning drops (and zeroizes) the old `Zeroizing` value
        *slot = Some(k.to_secret_bytes());
        Ok(k)
    }
}

/// Close flag of one open session; cloneable handle, sticky.
#[derive(Clone)]
pub struct SessionHandle {
    closed: Arc<AtomicBool>,
}

impl SessionHandle {
    pub fn is_closed(&self) -> bool {
        self.closed.load(Ordering::SeqCst)
    }
    pub fn close(&self) {
        self.closed.store(true, Ordering::SeqCst);
    }
}

/// Open sessions by peer key, so a revoke closes them at once.
#[derive(Default)]
pub struct SessionRegistry {
    sessions: Mutex<Vec<(PublicKey, SessionHandle)>>,
}

impl SessionRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Registered at `accept`, before the first frame (a revoke between message 2 and `hello` counts).
    pub fn register(&self, peer: PublicKey) -> SessionHandle {
        let handle = SessionHandle {
            closed: Arc::new(AtomicBool::new(false)),
        };
        if let Ok(mut s) = self.sessions.lock() {
            s.retain(|(_, h)| !h.is_closed());
            s.push((peer, handle.clone()));
        } else {
            handle.close();
        }
        handle
    }

    /// Closes every session of this peer; returns how many were open.
    pub fn close_peer(&self, peer: &PublicKey) -> usize {
        let Ok(mut s) = self.sessions.lock() else {
            return 0;
        };
        let mut n = 0;
        for (p, h) in s.iter() {
            if p == peer && !h.is_closed() {
                h.close();
                n += 1;
            }
        }
        s.retain(|(_, h)| !h.is_closed());
        n
    }

    /// Closes every open session (key rotation); returns how many were open. A poisoned lock is an
    /// error, never a silent "nothing to close".
    pub fn close_all(&self) -> Result<usize, TrustError> {
        let Ok(mut s) = self.sessions.lock() else {
            return Err(TrustError::Storage);
        };
        let n = s.iter().filter(|(_, h)| !h.is_closed()).count();
        for (_, h) in s.iter() {
            h.close();
        }
        s.clear();
        Ok(n)
    }

    #[cfg(test)]
    pub(crate) fn poison_for_test(&self) {
        let _guard = self.sessions.lock().unwrap();
        panic!("poison");
    }

    pub fn open_count(&self) -> usize {
        self.sessions
            .lock()
            .map(|s| s.iter().filter(|(_, h)| !h.is_closed()).count())
            .unwrap_or(0)
    }

    /// Unpairs: revokes in the store, then closes the sessions. Closing happens even if the store
    /// errors (fail towards closed).
    pub fn revoke(&self, trust: &dyn TrustStore, peer: &PublicKey) -> Result<bool, TrustError> {
        let res = trust.revoke(peer);
        self.close_peer(peer);
        res
    }
}

#[cfg(test)]
mod tests;
