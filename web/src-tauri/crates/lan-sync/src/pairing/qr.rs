//! The pairing QR: `NEMO1:` + base64url (no padding) of 59 bytes = 85 characters.
//!
//! `version (1) || hub static PUBLIC key (32) || single-use secret (16) || expiry secs (4, BE) ||
//! port (2, BE) || IPv4 hint (4)`. Only the hub's public key; never a private key, never the data
//! key. The expiry is a hint for the phone, the hub's window governs.

use crate::noise::PublicKey;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use std::fmt;
use zeroize::Zeroizing;

pub const PREFIX: &str = "NEMO1:";
pub const VERSION: u8 = 1;
pub const PAYLOAD_LEN: usize = 59;
/// Longest accepted expiry hint (the hub window is 120 s).
pub const MAX_EXPIRY_SECS: u32 = 120;

pub struct QrPayload {
    pub hub_key: PublicKey,
    pub secret: Zeroizing<[u8; 16]>,
    pub expiry_secs: u32,
    pub port: u16,
    pub ipv4: [u8; 4],
}

impl fmt::Debug for QrPayload {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("QrPayload(..)")
    }
}

/// Why a QR was refused. Carries no bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QrError {
    Prefix,
    Encoding,
    Length,
    Version,
    Expiry,
    Port,
    /// The address hint is not in 10/8, 172.16/12, 192.168/16 or 169.254/16.
    NotPrivate,
}

/// Private IPv4 ranges the hub may announce (CONCEPT §4): 10/8, 172.16/12, 192.168/16, 169.254/16.
pub fn is_private_v4(ip: [u8; 4]) -> bool {
    matches!(ip, [10, ..] | [192, 168, ..] | [169, 254, ..])
        || (ip[0] == 172 && (16..=31).contains(&ip[1]))
}

fn check(p: &QrPayload) -> Result<(), QrError> {
    if p.expiry_secs == 0 || p.expiry_secs > MAX_EXPIRY_SECS {
        return Err(QrError::Expiry);
    }
    if p.port == 0 {
        return Err(QrError::Port);
    }
    if !is_private_v4(p.ipv4) {
        return Err(QrError::NotPrivate);
    }
    Ok(())
}

pub fn encode(p: &QrPayload) -> Result<String, QrError> {
    check(p)?;
    let mut raw = Zeroizing::new(Vec::with_capacity(PAYLOAD_LEN));
    raw.push(VERSION);
    raw.extend_from_slice(p.hub_key.as_bytes());
    raw.extend_from_slice(&*p.secret);
    raw.extend_from_slice(&p.expiry_secs.to_be_bytes());
    raw.extend_from_slice(&p.port.to_be_bytes());
    raw.extend_from_slice(&p.ipv4);
    Ok(format!("{PREFIX}{}", URL_SAFE_NO_PAD.encode(&*raw)))
}

/// Strict decode: exact prefix, canonical base64url without padding, exact length, known version,
/// sane expiry and port, private address hint.
pub fn decode(text: &str) -> Result<QrPayload, QrError> {
    let body = text.strip_prefix(PREFIX).ok_or(QrError::Prefix)?;
    let raw = Zeroizing::new(
        URL_SAFE_NO_PAD
            .decode(body)
            .map_err(|_| QrError::Encoding)?,
    );
    if URL_SAFE_NO_PAD.encode(&*raw) != body {
        return Err(QrError::Encoding);
    }
    if raw.len() != PAYLOAD_LEN {
        return Err(QrError::Length);
    }
    if raw[0] != VERSION {
        return Err(QrError::Version);
    }
    let mut hub = [0u8; 32];
    hub.copy_from_slice(&raw[1..33]);
    let mut secret = Zeroizing::new([0u8; 16]);
    secret.copy_from_slice(&raw[33..49]);
    let p = QrPayload {
        hub_key: PublicKey::from_bytes(hub),
        secret,
        expiry_secs: u32::from_be_bytes([raw[49], raw[50], raw[51], raw[52]]),
        port: u16::from_be_bytes([raw[53], raw[54]]),
        ipv4: [raw[55], raw[56], raw[57], raw[58]],
    };
    check(&p)?;
    Ok(p)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> QrPayload {
        QrPayload {
            hub_key: PublicKey::from_bytes([0x11; 32]),
            secret: Zeroizing::new([0x22; 16]),
            expiry_secs: 120,
            port: 47_832,
            ipv4: [192, 168, 1, 20],
        }
    }

    #[test]
    fn round_trip_is_59_bytes_and_85_characters() {
        let text = encode(&sample()).unwrap();
        assert_eq!(text.len(), 85);
        assert!(text.starts_with("NEMO1:"));
        let back = decode(&text).unwrap();
        assert_eq!(back.hub_key, sample().hub_key);
        assert_eq!(*back.secret, [0x22; 16]);
        assert_eq!(
            (back.expiry_secs, back.port, back.ipv4),
            (120, 47_832, [192, 168, 1, 20])
        );
    }

    #[test]
    fn strict_decode_rejects_everything_else() {
        let text = encode(&sample()).unwrap();
        let body = &text[6..];
        assert_eq!(decode(body).err(), Some(QrError::Prefix));
        assert_eq!(decode(&text.to_lowercase()).err(), Some(QrError::Prefix));
        assert_eq!(decode(&format!("{text}=")).err(), Some(QrError::Encoding));
        assert!(decode(&format!("{text}A")).is_err());
        assert_eq!(decode(&format!("{} ", text)).err(), Some(QrError::Encoding));
        assert_eq!(decode("NEMO1:").err(), Some(QrError::Length));
        assert!(decode(&text[..text.len() - 4]).is_err());
        let short = format!("{PREFIX}{}", URL_SAFE_NO_PAD.encode([1u8; 58]));
        assert_eq!(decode(&short).err(), Some(QrError::Length));
        // non-canonical trailing bits: the last char carries 4 data bits, its low 2 bits must be 0
        let mut tampered = text[..text.len() - 1].to_owned();
        tampered.push('B');
        assert!(decode(&tampered).is_err());
    }

    #[test]
    fn field_checks() {
        let mut p = sample();
        p.ipv4 = [8, 8, 8, 8];
        assert_eq!(encode(&p).err(), Some(QrError::NotPrivate));
        p.ipv4 = [127, 0, 0, 1];
        assert_eq!(encode(&p).err(), Some(QrError::NotPrivate));
        p = sample();
        p.port = 0;
        assert_eq!(encode(&p).err(), Some(QrError::Port));
        p = sample();
        p.expiry_secs = 121;
        assert_eq!(encode(&p).err(), Some(QrError::Expiry));
        p.expiry_secs = 0;
        assert_eq!(encode(&p).err(), Some(QrError::Expiry));
        // a QR built by hand with a public address or another version is refused on decode
        let mut raw = vec![VERSION];
        raw.extend_from_slice(&[0u8; 32 + 16]);
        raw.extend_from_slice(&60u32.to_be_bytes());
        raw.extend_from_slice(&5000u16.to_be_bytes());
        raw.extend_from_slice(&[1, 1, 1, 1]);
        let t = format!("{PREFIX}{}", URL_SAFE_NO_PAD.encode(&raw));
        assert_eq!(decode(&t).err(), Some(QrError::NotPrivate));
        raw[0] = 2;
        raw[55..].copy_from_slice(&[10, 0, 0, 1]);
        let t = format!("{PREFIX}{}", URL_SAFE_NO_PAD.encode(&raw));
        assert_eq!(decode(&t).err(), Some(QrError::Version));
    }

    #[test]
    fn private_ranges() {
        for ip in [
            [10, 1, 2, 3],
            [172, 16, 0, 1],
            [172, 31, 255, 1],
            [192, 168, 0, 1],
            [169, 254, 1, 1],
        ] {
            assert!(is_private_v4(ip), "{ip:?}");
        }
        for ip in [
            [172, 15, 0, 1],
            [172, 32, 0, 1],
            [100, 64, 0, 1],
            [127, 0, 0, 1],
            [0, 0, 0, 0],
            [192, 169, 0, 1],
            [8, 8, 8, 8],
        ] {
            assert!(!is_private_v4(ip), "{ip:?}");
        }
    }

    #[test]
    fn payload_carries_no_private_key_and_debug_is_redacted() {
        let key = crate::noise::StaticKey::generate().unwrap();
        let p = QrPayload {
            hub_key: key.public(),
            ..sample()
        };
        let text = encode(&p).unwrap();
        let raw = URL_SAFE_NO_PAD.decode(&text[6..]).unwrap();
        let secret = key.to_secret_bytes();
        assert!(!raw.windows(32).any(|w| w == &secret[..]));
        assert_eq!(&raw[1..33], key.public().as_bytes());
        assert_eq!(format!("{p:?}"), "QrPayload(..)");
    }
}
