//! The sealed vault key on desktop, bound to a Windows Hello key (launch review V2).
//!
//! `biometric_seal` creates a Hello key credential (TPM-backed where the device has one, private key
//! never leaves it) and has it sign a random challenge. Hello signatures are RSA PKCS#1 v1.5 and
//! therefore deterministic, so the same challenge always yields the same signature: its SHA-256 is the
//! wrapping key for the vault key (ChaCha20-Poly1305). The keyring only keeps
//! `h1:` + base64(challenge ‖ nonce ‖ ciphertext). Reading that entry without a Hello verification
//! yields nothing usable; the signature (= the key) only exists after the Hello prompt.
//!
//! Entries written before this format hold the raw key (base64, no prefix). The first unlock with
//! such an entry creates the Hello key (that creation is the verification), re-wraps the key and
//! replaces the raw entry.
//!
//! The logic here is platform-free and tested with fakes; `hello.rs` is the Windows side.

use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    ChaCha20Poly1305, Key, Nonce,
};
use sha2::{Digest, Sha256};
use zeroize::{Zeroize, Zeroizing};

use crate::{Error, Result};

const PREFIX: &str = "h1:";
const CHALLENGE_LEN: usize = 32;
const NONCE_LEN: usize = 12;
const TAG_LEN: usize = 16;
const KDF_DOMAIN: &[u8] = b"nemo/secure-store/hello-wrap/v1";

/// The answer of a Hello operation that the person can decline.
#[derive(Debug, PartialEq, Eq)]
pub enum Ask<T> {
    Done(T),
    Cancelled,
    /// The Hello key does not exist (removed, PIN reset, other user profile).
    Missing,
}

/// Windows Hello key credentials (`KeyCredentialManager`); a fake in the tests.
pub trait HelloKeys {
    /// Creates (or replaces) the key credential `key` and signs `data` with the new key; asks the
    /// person to verify (Windows may show one or two prompts).
    fn create_and_sign(&self, key: &str, data: &[u8]) -> Result<Ask<Vec<u8>>>;
    /// Signs `data` with the key credential `key`; asks the person to verify.
    fn sign(&self, key: &str, data: &[u8]) -> Result<Ask<Vec<u8>>>;
    /// Removes the key credential; a missing one is not an error.
    fn delete(&self, key: &str);
}

/// The keyring entry that holds the wrapped key (the real one is the OS keyring).
pub trait Slot {
    fn read(&self) -> Result<Option<String>>;
    fn write(&self, value: &str) -> Result<()>;
    fn remove(&self) -> Result<()>;
}

/// What `unseal` hands back; mirrors the `status` values of the command.
#[derive(Debug, PartialEq, Eq)]
pub enum Unsealed {
    /// base64 of the vault key.
    Ok(Zeroizing<String>),
    Cancelled,
    Missing,
    Invalidated,
}

/// Seals `secret_b64` under the Hello key `key`. `aad` binds the blob to its entry name.
/// Cancelled or failed after the Hello key may have been replaced: entry and key are removed, so the
/// result is always either "sealed" or "not enrolled", never a seal that can no longer be opened.
pub fn seal(
    hello: &dyn HelloKeys,
    slot: &dyn Slot,
    key: &str,
    aad: &str,
    secret_b64: &str,
) -> Result<()> {
    let secret = Zeroizing::new(
        STANDARD
            .decode(secret_b64)
            .map_err(|_| Error::Invalid("secret is not base64".into()))?,
    );
    let result = match wrap_new(hello, key, aad, &secret) {
        Ok(Some(value)) => slot.write(&value),
        Ok(None) => Err(Error::Cancelled),
        Err(e) => Err(e),
    };
    if result.is_err() {
        delete(hello, slot, key)?;
    }
    result
}

pub fn unseal(hello: &dyn HelloKeys, slot: &dyn Slot, key: &str, aad: &str) -> Result<Unsealed> {
    let Some(stored) = slot.read()? else {
        return Ok(Unsealed::Missing);
    };
    let stored = Zeroizing::new(stored);
    let Some(body) = stored.strip_prefix(PREFIX) else {
        return migrate(hello, slot, key, aad, &stored);
    };
    let Some((challenge, nonce, ciphertext)) = split(body) else {
        return invalidate(hello, slot, key);
    };
    let signature = match hello.sign(key, &challenge)? {
        Ask::Done(sig) => Zeroizing::new(sig),
        Ask::Cancelled => return Ok(Unsealed::Cancelled),
        Ask::Missing => return invalidate(hello, slot, key),
    };
    let cipher = ChaCha20Poly1305::new(Key::from_slice(&*wrapping_key(&signature)));
    match cipher.decrypt(
        Nonce::from_slice(&nonce),
        Payload {
            msg: &ciphertext,
            aad: aad.as_bytes(),
        },
    ) {
        Ok(plain) => Ok(Unsealed::Ok(b64(Zeroizing::new(plain)))),
        // A different Hello key under the same name (re-created after a PIN reset) or a changed blob.
        Err(_) => invalidate(hello, slot, key),
    }
}

pub fn delete(hello: &dyn HelloKeys, slot: &dyn Slot, key: &str) -> Result<()> {
    slot.remove()?;
    hello.delete(key);
    Ok(())
}

/// A raw key from before the Hello binding: creating the Hello key is the verification; the entry is
/// then replaced by the wrapped form. Cancelled = the raw entry stays as it was (no Hello key
/// existed for it, so nothing that worked is lost).
fn migrate(
    hello: &dyn HelloKeys,
    slot: &dyn Slot,
    key: &str,
    aad: &str,
    raw: &str,
) -> Result<Unsealed> {
    let Ok(secret) = STANDARD.decode(raw).map(Zeroizing::new) else {
        return invalidate(hello, slot, key);
    };
    let Some(value) = wrap_new(hello, key, aad, &secret)? else {
        return Ok(Unsealed::Cancelled);
    };
    slot.write(&value)?;
    Ok(Unsealed::Ok(b64(secret)))
}

/// Creates the Hello key, has it sign a fresh challenge and wraps `secret`. `None` = cancelled.
fn wrap_new(hello: &dyn HelloKeys, key: &str, aad: &str, secret: &[u8]) -> Result<Option<String>> {
    let mut challenge = [0u8; CHALLENGE_LEN];
    let mut nonce = [0u8; NONCE_LEN];
    getrandom::fill(&mut challenge).map_err(|e| Error::Keystore(e.to_string()))?;
    getrandom::fill(&mut nonce).map_err(|e| Error::Keystore(e.to_string()))?;
    let signature = match hello.create_and_sign(key, &challenge)? {
        Ask::Done(sig) => Zeroizing::new(sig),
        Ask::Cancelled => return Ok(None),
        Ask::Missing => return Err(Error::Biometric("Hello key could not be created".into())),
    };
    let ciphertext = ChaCha20Poly1305::new(Key::from_slice(&*wrapping_key(&signature)))
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: secret,
                aad: aad.as_bytes(),
            },
        )
        .map_err(|_| Error::Keystore("wrapping failed".into()))?;
    let mut blob = Vec::with_capacity(CHALLENGE_LEN + NONCE_LEN + ciphertext.len());
    blob.extend_from_slice(&challenge);
    blob.extend_from_slice(&nonce);
    blob.extend_from_slice(&ciphertext);
    Ok(Some(format!("{PREFIX}{}", STANDARD.encode(blob))))
}

/// The cipher wipes its own key copy on drop (`ZeroizeOnDrop`); this one is wiped by `Zeroizing`.
fn wrapping_key(signature: &[u8]) -> Zeroizing<[u8; 32]> {
    let mut h = Sha256::new();
    h.update(KDF_DOMAIN);
    h.update((signature.len() as u32).to_be_bytes());
    h.update(signature);
    let mut digest = h.finalize();
    let key = Zeroizing::new(digest.into());
    digest.zeroize();
    key
}

type Parts = ([u8; CHALLENGE_LEN], [u8; NONCE_LEN], Vec<u8>);

fn split(body: &str) -> Option<Parts> {
    let blob = STANDARD.decode(body).ok()?;
    if blob.len() < CHALLENGE_LEN + NONCE_LEN + TAG_LEN {
        return None;
    }
    let (challenge, rest) = blob.split_at(CHALLENGE_LEN);
    let (nonce, ciphertext) = rest.split_at(NONCE_LEN);
    Some((
        challenge.try_into().ok()?,
        nonce.try_into().ok()?,
        ciphertext.to_vec(),
    ))
}

fn invalidate(hello: &dyn HelloKeys, slot: &dyn Slot, key: &str) -> Result<Unsealed> {
    delete(hello, slot, key)?;
    Ok(Unsealed::Invalidated)
}

fn b64(plain: Zeroizing<Vec<u8>>) -> Zeroizing<String> {
    Zeroizing::new(STANDARD.encode(plain.as_slice()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::{Cell, RefCell};

    /// Deterministic like RSA PKCS#1 v1.5: the "signature" is SHA-256(private ‖ data).
    struct FakeHello {
        private: RefCell<Option<[u8; 8]>>,
        next: Cell<u8>,
        cancel_create: Cell<bool>,
        cancel_sign: Cell<bool>,
        prompts: Cell<u32>,
    }

    impl FakeHello {
        fn new() -> Self {
            Self {
                private: RefCell::new(None),
                next: Cell::new(1),
                cancel_create: Cell::new(false),
                cancel_sign: Cell::new(false),
                prompts: Cell::new(0),
            }
        }
    }

    impl FakeHello {
        /// Same name, new private key (like a PIN reset or another enrolment).
        fn recreate(&self) {
            let n = self.next.get();
            self.next.set(n + 1);
            *self.private.borrow_mut() = Some([n; 8]);
        }
    }

    impl HelloKeys for FakeHello {
        fn create_and_sign(&self, key: &str, data: &[u8]) -> Result<Ask<Vec<u8>>> {
            self.prompts.set(self.prompts.get() + 1);
            if self.cancel_create.get() {
                return Ok(Ask::Cancelled);
            }
            self.recreate();
            self.sign(key, data)
        }
        fn sign(&self, _key: &str, data: &[u8]) -> Result<Ask<Vec<u8>>> {
            self.prompts.set(self.prompts.get() + 1);
            if self.cancel_sign.get() {
                return Ok(Ask::Cancelled);
            }
            let Some(p) = *self.private.borrow() else {
                return Ok(Ask::Missing);
            };
            let mut h = Sha256::new();
            h.update(p);
            h.update(data);
            Ok(Ask::Done(h.finalize().to_vec()))
        }
        fn delete(&self, _key: &str) {
            *self.private.borrow_mut() = None;
        }
    }

    #[derive(Default)]
    struct MemSlot(RefCell<Option<String>>);

    impl Slot for MemSlot {
        fn read(&self) -> Result<Option<String>> {
            Ok(self.0.borrow().clone())
        }
        fn write(&self, value: &str) -> Result<()> {
            *self.0.borrow_mut() = Some(value.into());
            Ok(())
        }
        fn remove(&self) -> Result<()> {
            *self.0.borrow_mut() = None;
            Ok(())
        }
    }

    const DEK: &str = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="; // 32 bytes
    const K: &str = "svc/vault-dek:1";
    const AAD: &str = "bio:vault-dek:1";

    fn ok(s: &str) -> Unsealed {
        Unsealed::Ok(Zeroizing::new(s.into()))
    }

    #[test]
    fn seal_then_unseal_gives_the_key_back() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        seal(&h, &s, K, AAD, DEK).unwrap();
        assert_eq!(unseal(&h, &s, K, AAD).unwrap(), ok(DEK));
    }

    #[test]
    fn the_stored_entry_does_not_contain_the_key() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        seal(&h, &s, K, AAD, DEK).unwrap();
        let stored = s.read().unwrap().unwrap();
        assert!(stored.starts_with("h1:"));
        assert!(!stored.contains(DEK));
        let raw = STANDARD.decode(DEK).unwrap();
        let blob = STANDARD.decode(&stored[3..]).unwrap();
        assert!(!blob.windows(raw.len()).any(|w| w == raw.as_slice()));
    }

    #[test]
    fn cancelling_seal_stores_nothing() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        h.cancel_create.set(true);
        assert!(matches!(seal(&h, &s, K, AAD, DEK), Err(Error::Cancelled)));
        h.cancel_create.set(false);
        h.cancel_sign.set(true);
        assert!(matches!(seal(&h, &s, K, AAD, DEK), Err(Error::Cancelled)));
        assert_eq!(s.read().unwrap(), None);
    }

    #[test]
    fn a_cancelled_reseal_leaves_nothing_half_sealed() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        seal(&h, &s, K, AAD, DEK).unwrap();
        h.cancel_sign.set(true); // new key created, then the signing prompt is cancelled
        assert!(matches!(seal(&h, &s, K, AAD, DEK), Err(Error::Cancelled)));
        h.cancel_sign.set(false);
        assert_eq!(
            s.read().unwrap(),
            None,
            "not enrolled, instead of a seal that cannot open"
        );
        assert!(h.private.borrow().is_none(), "no orphaned Hello key");
        assert_eq!(unseal(&h, &s, K, AAD).unwrap(), Unsealed::Missing);
    }

    #[test]
    fn seal_rejects_non_base64() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        assert!(matches!(
            seal(&h, &s, K, AAD, "not base64!"),
            Err(Error::Invalid(_))
        ));
        assert_eq!(h.prompts.get(), 0, "no prompt for a bad request");
    }

    #[test]
    fn cancelled_unseal_keeps_the_entry() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        seal(&h, &s, K, AAD, DEK).unwrap();
        h.cancel_sign.set(true);
        assert_eq!(unseal(&h, &s, K, AAD).unwrap(), Unsealed::Cancelled);
        h.cancel_sign.set(false);
        assert_eq!(unseal(&h, &s, K, AAD).unwrap(), ok(DEK));
    }

    #[test]
    fn nothing_sealed_is_missing() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        assert_eq!(unseal(&h, &s, K, AAD).unwrap(), Unsealed::Missing);
        assert_eq!(h.prompts.get(), 0);
    }

    #[test]
    fn a_vanished_hello_key_invalidates_the_entry() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        seal(&h, &s, K, AAD, DEK).unwrap();
        h.delete(K);
        assert_eq!(unseal(&h, &s, K, AAD).unwrap(), Unsealed::Invalidated);
        assert_eq!(s.read().unwrap(), None);
    }

    #[test]
    fn a_recreated_hello_key_invalidates_the_entry() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        seal(&h, &s, K, AAD, DEK).unwrap();
        h.recreate(); // e.g. PIN reset: same name, new private key
        assert_eq!(unseal(&h, &s, K, AAD).unwrap(), Unsealed::Invalidated);
        assert_eq!(s.read().unwrap(), None);
    }

    #[test]
    fn a_blob_under_another_name_does_not_open() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        seal(&h, &s, K, AAD, DEK).unwrap();
        assert_eq!(
            unseal(&h, &s, K, "bio:vault-dek:2").unwrap(),
            Unsealed::Invalidated
        );
    }

    #[test]
    fn a_damaged_entry_invalidates() {
        for bad in ["h1:", "h1:@@@", "h1:AAAA", "%%%"] {
            let (h, s) = (FakeHello::new(), MemSlot::default());
            s.write(bad).unwrap();
            assert_eq!(
                unseal(&h, &s, K, AAD).unwrap(),
                Unsealed::Invalidated,
                "{bad}"
            );
            assert_eq!(s.read().unwrap(), None);
        }
    }

    #[test]
    fn a_raw_entry_is_migrated_on_first_unlock() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        s.write(DEK).unwrap(); // written by a version before the Hello binding
        assert_eq!(unseal(&h, &s, K, AAD).unwrap(), ok(DEK));
        let stored = s.read().unwrap().unwrap();
        assert!(stored.starts_with("h1:"), "raw key replaced");
        assert_eq!(unseal(&h, &s, K, AAD).unwrap(), ok(DEK));
    }

    #[test]
    fn a_cancelled_migration_changes_nothing() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        s.write(DEK).unwrap();
        h.cancel_create.set(true);
        assert_eq!(unseal(&h, &s, K, AAD).unwrap(), Unsealed::Cancelled);
        assert_eq!(s.read().unwrap().as_deref(), Some(DEK));
        h.cancel_create.set(false);
        h.cancel_sign.set(true);
        assert_eq!(unseal(&h, &s, K, AAD).unwrap(), Unsealed::Cancelled);
        assert_eq!(s.read().unwrap().as_deref(), Some(DEK));
    }

    #[test]
    fn delete_removes_entry_and_hello_key() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        seal(&h, &s, K, AAD, DEK).unwrap();
        delete(&h, &s, K).unwrap();
        assert_eq!(s.read().unwrap(), None);
        assert!(h.private.borrow().is_none());
    }

    #[test]
    fn the_wrapped_entry_fits_the_credential_manager() {
        let (h, s) = (FakeHello::new(), MemSlot::default());
        seal(&h, &s, K, AAD, DEK).unwrap();
        assert!(crate::models::validate_value(&s.read().unwrap().unwrap()).is_ok());
    }
}
