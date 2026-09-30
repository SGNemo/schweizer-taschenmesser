//! Bearer tokens: only SHA-256 hashes are known here; comparison is constant-time.

use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

/// Longest token accepted in the `Authorization` header (ours are `tm_` + 43 characters).
const MAX_TOKEN_LEN: usize = 256;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TokenEntry {
    pub id: String,
    pub hash: [u8; 32],
    /// Epoch milliseconds; `None` = does not expire.
    pub expires_at_ms: Option<u64>,
}

pub fn sha256(data: &[u8]) -> [u8; 32] {
    Sha256::digest(data).into()
}

/// 64 hex characters → 32 bytes.
pub fn parse_hash_hex(hex: &str) -> Option<[u8; 32]> {
    if hex.len() != 64 || !hex.is_ascii() {
        return None;
    }
    let mut out = [0u8; 32];
    for (i, byte) in out.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(out)
}

#[derive(Debug, PartialEq, Eq)]
pub enum Auth {
    Ok(String),
    Missing,
    Invalid,
    Expired,
}

/// Checks an `Authorization` header value against the known token hashes.
pub fn authenticate(header: Option<&str>, tokens: &[TokenEntry], now_ms: u64) -> Auth {
    let Some(value) = header else {
        return Auth::Missing;
    };
    let value = value.trim();
    let token = match value.split_once(' ') {
        Some((scheme, rest)) if scheme.eq_ignore_ascii_case("bearer") => rest.trim(),
        _ => return Auth::Invalid,
    };
    if token.is_empty() || token.len() > MAX_TOKEN_LEN {
        return Auth::Invalid;
    }
    let presented = sha256(token.as_bytes());
    // Compare against every entry without an early exit.
    let mut found: Option<&TokenEntry> = None;
    for entry in tokens {
        let equal: bool = entry.hash.ct_eq(&presented).into();
        if equal && found.is_none() {
            found = Some(entry);
        }
    }
    match found {
        None => Auth::Invalid,
        Some(entry) if entry.expires_at_ms.is_some_and(|at| at <= now_ms) => Auth::Expired,
        Some(entry) => Auth::Ok(entry.id.clone()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(id: &str, token: &str, expires_at_ms: Option<u64>) -> TokenEntry {
        TokenEntry {
            id: id.into(),
            hash: sha256(token.as_bytes()),
            expires_at_ms,
        }
    }

    #[test]
    fn hex_round_trip() {
        let hash = sha256(b"abc");
        let hex: String = hash.iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(parse_hash_hex(&hex), Some(hash));
        assert_eq!(parse_hash_hex("zz"), None);
        assert_eq!(parse_hash_hex(&"g".repeat(64)), None);
    }

    #[test]
    fn accepts_the_right_token_only() {
        let tokens = [
            entry("a", "tm_one", None),
            entry("b", "tm_two", Some(2_000)),
        ];
        assert_eq!(
            authenticate(Some("Bearer tm_one"), &tokens, 1_000),
            Auth::Ok("a".into())
        );
        assert_eq!(
            authenticate(Some("bearer  tm_two "), &tokens, 1_000),
            Auth::Ok("b".into())
        );
        assert_eq!(
            authenticate(Some("Bearer tm_three"), &tokens, 1_000),
            Auth::Invalid
        );
        assert_eq!(
            authenticate(Some("Basic tm_one"), &tokens, 1_000),
            Auth::Invalid
        );
        assert_eq!(authenticate(Some("tm_one"), &tokens, 1_000), Auth::Invalid);
        assert_eq!(authenticate(Some("Bearer "), &tokens, 1_000), Auth::Invalid);
        assert_eq!(authenticate(None, &tokens, 1_000), Auth::Missing);
    }

    #[test]
    fn expired_and_revoked_tokens_fail() {
        let tokens = [entry("b", "tm_two", Some(2_000))];
        assert_eq!(
            authenticate(Some("Bearer tm_two"), &tokens, 2_000),
            Auth::Expired
        );
        assert_eq!(authenticate(Some("Bearer tm_two"), &[], 0), Auth::Invalid);
    }

    #[test]
    fn overlong_tokens_are_rejected_before_hashing() {
        let long = format!("Bearer {}", "x".repeat(MAX_TOKEN_LEN + 1));
        assert_eq!(authenticate(Some(&long), &[], 0), Auth::Invalid);
    }
}
