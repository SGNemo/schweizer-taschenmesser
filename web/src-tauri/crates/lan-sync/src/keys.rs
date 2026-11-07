//! The hub's two long-lived secrets, kept in one OS keystore slot each (CONCEPT §3 "Key ownership"):
//! the static Noise key and the E2E data key with its version. The slot itself (Windows Credential
//! Manager via `keyring`) is the shell's; everything that decides what to do with its answers
//! lives here and is tested with a fake slot.
//!
//! Fail-closed: a slot that errors, or holds bytes of the wrong size, is an error and the hub does
//! not start. A key is created only when the slot is positively empty, never to replace a broken one.

use crate::noise::StaticKey;
use crate::pairing::{DataKey, DataKeyError, DataKeyProvider};
use crate::trust::{KeyStoreError, StaticKeyStore};
use zeroize::Zeroizing;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SlotError;

/// One named secret in the OS keystore.
pub trait SecretSlot: Send + Sync {
    /// `Ok(None)` only when the slot is positively empty.
    fn get(&self) -> Result<Option<Zeroizing<Vec<u8>>>, SlotError>;
    fn set(&self, bytes: &[u8]) -> Result<(), SlotError>;
}

pub struct SlotKeyStore<S: SecretSlot> {
    slot: S,
}

impl<S: SecretSlot> SlotKeyStore<S> {
    pub fn new(slot: S) -> Self {
        SlotKeyStore { slot }
    }

    fn store(&self, key: &StaticKey) -> Result<(), KeyStoreError> {
        let secret = key.to_secret_bytes();
        self.slot
            .set(&secret[..])
            .map_err(|_| KeyStoreError::Unavailable)
    }
}

impl<S: SecretSlot> StaticKeyStore for SlotKeyStore<S> {
    fn load_or_create(&self) -> Result<StaticKey, KeyStoreError> {
        match self.slot.get().map_err(|_| KeyStoreError::Unavailable)? {
            Some(bytes) => {
                let arr: [u8; 32] = bytes[..].try_into().map_err(|_| KeyStoreError::Corrupt)?;
                StaticKey::from_secret_bytes(Zeroizing::new(arr)).map_err(KeyStoreError::Key)
            }
            None => {
                let key = StaticKey::generate().map_err(KeyStoreError::Key)?;
                self.store(&key)?;
                Ok(key)
            }
        }
    }

    fn regenerate(&self) -> Result<StaticKey, KeyStoreError> {
        let key = StaticKey::generate().map_err(KeyStoreError::Key)?;
        self.store(&key)?;
        Ok(key)
    }
}

/// The data key: slot content is `version (u32 BE) || key (32 B)`.
pub struct DataKeys<S: SecretSlot> {
    slot: S,
}

impl<S: SecretSlot> DataKeys<S> {
    pub fn new(slot: S) -> Self {
        DataKeys { slot }
    }

    fn write(&self, version: u32, key: &[u8; 32]) -> Result<(), DataKeyError> {
        let mut bytes = Zeroizing::new(Vec::with_capacity(36));
        bytes.extend_from_slice(&version.to_be_bytes());
        bytes.extend_from_slice(key);
        self.slot.set(&bytes).map_err(|_| DataKeyError)
    }

    /// The current key; a positively empty slot gets version 1 with a fresh random key.
    pub fn load_or_create(&self) -> Result<DataKey, DataKeyError> {
        match self.slot.get().map_err(|_| DataKeyError)? {
            Some(bytes) => {
                if bytes.len() != 36 {
                    return Err(DataKeyError);
                }
                let version = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
                if version == 0 {
                    return Err(DataKeyError);
                }
                let mut key = Zeroizing::new([0u8; 32]);
                key.copy_from_slice(&bytes[4..]);
                Ok(DataKey { version, key })
            }
            None => {
                let mut key = Zeroizing::new([0u8; 32]);
                getrandom::fill(&mut *key).map_err(|_| DataKeyError)?;
                self.write(1, &key)?;
                Ok(DataKey { version: 1, key })
            }
        }
    }

    /// Stores a fresh random key as version n+1 and returns it. The old one is gone from the slot;
    /// callers that may have to undo this keep it and call [`restore`](Self::restore).
    pub fn rotate(&self) -> Result<DataKey, DataKeyError> {
        let current = self.load_or_create()?;
        let version = current.version.checked_add(1).ok_or(DataKeyError)?;
        let mut key = Zeroizing::new([0u8; 32]);
        getrandom::fill(&mut *key).map_err(|_| DataKeyError)?;
        self.write(version, &key)?;
        Ok(DataKey { version, key })
    }

    /// Puts an earlier key back (a rotation that could not be completed).
    pub fn restore(&self, key: &DataKey) -> Result<(), DataKeyError> {
        self.write(key.version, &key.key)
    }
}

impl<S: SecretSlot> DataKeyProvider for DataKeys<S> {
    fn current(&self) -> Result<DataKey, DataKeyError> {
        self.load_or_create()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[derive(Default)]
    struct Fake {
        value: Mutex<Option<Vec<u8>>>,
        fail_get: Mutex<bool>,
        fail_set: Mutex<bool>,
    }
    impl SecretSlot for &Fake {
        fn get(&self) -> Result<Option<Zeroizing<Vec<u8>>>, SlotError> {
            if *self.fail_get.lock().unwrap() {
                return Err(SlotError);
            }
            Ok(self.value.lock().unwrap().clone().map(Zeroizing::new))
        }
        fn set(&self, bytes: &[u8]) -> Result<(), SlotError> {
            if *self.fail_set.lock().unwrap() {
                return Err(SlotError);
            }
            *self.value.lock().unwrap() = Some(bytes.to_vec());
            Ok(())
        }
    }

    #[test]
    fn static_key_is_created_once_and_then_stable() {
        let f = Fake::default();
        let s = SlotKeyStore::new(&f);
        let a = s.load_or_create().unwrap().public();
        assert_eq!(s.load_or_create().unwrap().public(), a);
        assert_ne!(s.regenerate().unwrap().public(), a, "Neu koppeln = new key");
        assert_ne!(s.load_or_create().unwrap().public(), a);
    }

    #[test]
    fn static_key_store_is_fail_closed() {
        let f = Fake::default();
        let s = SlotKeyStore::new(&f);
        *f.fail_get.lock().unwrap() = true;
        assert!(matches!(
            s.load_or_create(),
            Err(KeyStoreError::Unavailable)
        ));
        assert!(
            f.value.lock().unwrap().is_none(),
            "no key made on a read error"
        );
        *f.fail_get.lock().unwrap() = false;
        *f.value.lock().unwrap() = Some(vec![1, 2, 3]);
        assert!(matches!(s.load_or_create(), Err(KeyStoreError::Corrupt)));
        assert_eq!(
            f.value.lock().unwrap().as_deref(),
            Some(&[1u8, 2, 3][..]),
            "broken content kept"
        );
        *f.value.lock().unwrap() = None;
        *f.fail_set.lock().unwrap() = true;
        assert!(matches!(
            s.load_or_create(),
            Err(KeyStoreError::Unavailable)
        ));
    }

    #[test]
    fn data_key_starts_at_version_one_and_rotates_by_one() {
        let f = Fake::default();
        let d = DataKeys::new(&f);
        let first = d.current().unwrap();
        assert_eq!(first.version, 1);
        assert_eq!(d.current().unwrap().key[..], first.key[..]);
        let second = d.rotate().unwrap();
        assert_eq!(second.version, 2);
        assert_ne!(second.key[..], first.key[..]);
        assert_eq!(d.current().unwrap().version, 2);
        d.restore(&first).unwrap();
        assert_eq!(d.current().unwrap().version, 1);
        assert_eq!(d.current().unwrap().key[..], first.key[..]);
    }

    #[test]
    fn data_key_store_is_fail_closed() {
        let f = Fake::default();
        let d = DataKeys::new(&f);
        *f.fail_get.lock().unwrap() = true;
        assert!(d.current().is_err());
        *f.fail_get.lock().unwrap() = false;
        for bad in [vec![0u8; 35], vec![0u8; 36], vec![]] {
            // length 36 with version 0, wrong lengths: never replaced silently
            *f.value.lock().unwrap() = Some(bad.clone());
            assert!(d.current().is_err());
            assert_eq!(f.value.lock().unwrap().as_deref(), Some(&bad[..]));
        }
        let mut max = vec![0xff; 4];
        max.extend_from_slice(&[7u8; 32]);
        *f.value.lock().unwrap() = Some(max);
        assert_eq!(d.current().unwrap().version, u32::MAX);
        assert!(d.rotate().is_err(), "no wrap-around");
        *f.value.lock().unwrap() = None;
        *f.fail_set.lock().unwrap() = true;
        assert!(d.current().is_err());
    }
}
