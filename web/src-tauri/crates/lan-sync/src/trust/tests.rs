use super::*;
use std::mem::ManuallyDrop;

fn key() -> PublicKey {
    StaticKey::generate().unwrap().public()
}

fn dev(k: PublicKey) -> Device {
    Device {
        key: k,
        name: "Phone".into(),
        last_seen: None,
        revoked: false,
    }
}

#[test]
fn add_find_touch_list() {
    let s = MemoryTrustStore::new();
    let k = key();
    assert!(s.find_by_key(&k).is_none());
    s.add(dev(k)).unwrap();
    assert_eq!(s.find_by_key(&k).unwrap().name, "Phone");
    s.touch(&k, 42);
    assert_eq!(s.find_by_key(&k).unwrap().last_seen, Some(42));
    assert_eq!(s.list().len(), 1);
}

#[test]
fn add_refuses_active_and_revoked_keys() {
    let s = MemoryTrustStore::new();
    let k = key();
    s.add(dev(k)).unwrap();
    assert_eq!(s.add(dev(k)), Err(TrustError::AlreadyTrusted));
    assert_eq!(s.revoke(&k), Ok(true));
    // T17: a revoked key is never trusted again, not even by `add`
    assert_eq!(s.add(dev(k)), Err(TrustError::Revoked));
    assert!(s.find_by_key(&k).unwrap().revoked);
}

#[test]
fn revoke_is_a_tombstone_and_remove_is_rollback_only() {
    let s = MemoryTrustStore::new();
    let k = key();
    assert_eq!(s.revoke(&k), Ok(false));
    s.add(dev(k)).unwrap();
    assert_eq!(s.revoke(&k), Ok(true));
    assert_eq!(s.revoke(&k), Ok(false));
    assert_eq!(
        s.remove(&k),
        Err(TrustError::NotFound),
        "tombstones cannot be removed"
    );
    s.touch(&k, 9);
    assert_eq!(
        s.find_by_key(&k).unwrap().last_seen,
        None,
        "no activity for a revoked key"
    );
    let k2 = key();
    s.add(dev(k2)).unwrap();
    s.remove(&k2).unwrap();
    assert!(s.find_by_key(&k2).is_none());
}

#[test]
fn device_debug_shows_no_name_or_key() {
    let d = Device {
        key: key(),
        name: "Svens Handy".into(),
        last_seen: None,
        revoked: false,
    };
    assert!(!format!("{d:?}").contains("Svens"));
}

#[test]
fn key_store_creates_once_and_returns_the_same_key() {
    let ks = MemoryKeyStore::empty();
    let a = ks.load_or_create().unwrap();
    let b = ks.load_or_create().unwrap();
    assert_eq!(a.public(), b.public());
}

#[test]
fn regenerate_replaces_the_key() {
    let ks = MemoryKeyStore::empty();
    let a = ks.load_or_create().unwrap();
    let b = ks.regenerate().unwrap();
    assert_ne!(a.public(), b.public());
    assert_eq!(ks.load_or_create().unwrap().public(), b.public());
}

/// A store that cannot be read: nothing may be created over it.
struct Broken;
impl StaticKeyStore for Broken {
    fn load_or_create(&self) -> Result<StaticKey, KeyStoreError> {
        Err(KeyStoreError::Corrupt)
    }
    fn regenerate(&self) -> Result<StaticKey, KeyStoreError> {
        Err(KeyStoreError::Unavailable)
    }
}

#[test]
fn broken_store_is_an_error_not_a_new_key() {
    assert_eq!(Broken.load_or_create().err(), Some(KeyStoreError::Corrupt));
    assert_eq!(Broken.regenerate().err(), Some(KeyStoreError::Unavailable));
}

#[test]
fn replaced_secret_is_zeroized() {
    let mut old = ManuallyDrop::new(Zeroizing::new([7u8; 32]));
    let ptr = old.as_ptr();
    unsafe { ManuallyDrop::drop(&mut old) };
    assert!(unsafe { std::slice::from_raw_parts(ptr, 32) }
        .iter()
        .all(|b| *b == 0));
}

#[test]
fn registry_closes_sessions_of_a_revoked_peer_only() {
    let reg = SessionRegistry::new();
    let (a, b) = (key(), key());
    let ha = reg.register(a);
    let hb = reg.register(b);
    assert_eq!(reg.open_count(), 2);
    let trust = MemoryTrustStore::new();
    trust.add(dev(a)).unwrap();
    assert_eq!(reg.revoke(&trust, &a), Ok(true));
    assert!(ha.is_closed());
    assert!(!hb.is_closed());
    assert_eq!(reg.open_count(), 1);
    assert!(trust.find_by_key(&a).unwrap().revoked);
}

#[test]
fn registry_closes_even_if_the_store_errors() {
    struct Failing;
    impl TrustStore for Failing {
        fn find_by_key(&self, _: &PublicKey) -> Option<Device> {
            None
        }
        fn add(&self, _: Device) -> Result<(), TrustError> {
            Err(TrustError::Storage)
        }
        fn remove(&self, _: &PublicKey) -> Result<(), TrustError> {
            Err(TrustError::Storage)
        }
        fn revoke(&self, _: &PublicKey) -> Result<bool, TrustError> {
            Err(TrustError::Storage)
        }
        fn touch(&self, _: &PublicKey, _: u64) {}
        fn list(&self) -> Vec<Device> {
            vec![]
        }
    }
    let reg = SessionRegistry::new();
    let a = key();
    let h = reg.register(a);
    assert_eq!(reg.revoke(&Failing, &a), Err(TrustError::Storage));
    assert!(h.is_closed());
}
