//! The daily mDNS hint of a hub (CONCEPT §4). On every target: the hub announces it (`discovery`),
//! a paired device matches it to find its hub again after the PC got a new address
//! (`rediscover`; Android: `NsdManager` results from the `lan-watch` plugin).
//!
//! * Hint = the first 8 bytes (hex) of `HMAC-SHA256(key = SHA-256(hub static public key),
//!   msg = "YYYY-MM-DD" UTC)`. Only a device that knows the hub key can match it; devices accept
//!   yesterday, today and tomorrow ([`hints_around`]).
//! * Nothing here logs a key or a hint.

use crate::noise::PublicKey;
use sha2::{Digest, Sha256};

pub(crate) fn hmac_sha256(key: &[u8], msg: &[u8]) -> [u8; 32] {
    const BLOCK: usize = 64;
    let mut k = [0u8; BLOCK];
    if key.len() > BLOCK {
        k[..32].copy_from_slice(&Sha256::digest(key));
    } else {
        k[..key.len()].copy_from_slice(key);
    }
    let mut inner = Sha256::new();
    inner.update(k.map(|b| b ^ 0x36));
    inner.update(msg);
    let mut outer = Sha256::new();
    outer.update(k.map(|b| b ^ 0x5c));
    outer.update(inner.finalize());
    outer.finalize().into()
}

/// `YYYY-MM-DD` (UTC) of a day count since 1970-01-01 (proleptic Gregorian, Hinnant's algorithm).
pub fn utc_date(days_since_epoch: i64) -> String {
    let z = days_since_epoch + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}-{m:02}-{d:02}")
}

/// The hint of one UTC date, 16 hex characters.
pub fn hint_for_date(hub: &PublicKey, date: &str) -> String {
    let key = Sha256::digest(hub.as_bytes());
    let mac = hmac_sha256(&key, date.as_bytes());
    mac[..8].iter().map(|b| format!("{b:02x}")).collect()
}

/// Day number (since the epoch) of a unix time in seconds.
pub fn day_of(unix_secs: u64) -> i64 {
    i64::try_from(unix_secs / 86_400).unwrap_or(0)
}

pub fn daily_hint(hub: &PublicKey, unix_secs: u64) -> String {
    hint_for_date(hub, &utc_date(day_of(unix_secs)))
}

/// Yesterday, today, tomorrow: what a client accepts.
pub fn hints_around(hub: &PublicKey, unix_secs: u64) -> [String; 3] {
    let d = day_of(unix_secs);
    [-1, 0, 1].map(|o| hint_for_date(hub, &utc_date(d + o)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hub() -> PublicKey {
        PublicKey::from_bytes([7u8; 32])
    }

    const NOON: u64 = 1_794_052_800; // 2026-11-07 12:00 UTC

    #[test]
    fn hmac_matches_rfc_4231_case_2() {
        let mac = hmac_sha256(b"Jefe", b"what do ya want for nothing?");
        let hex: String = mac.iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(
            hex,
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
        );
        // a key longer than one block is hashed first (RFC 4231 case 6 shape)
        let long = hmac_sha256(
            &[0xaa; 131],
            b"Test Using Larger Than Block-Size Key - Hash Key First",
        );
        let hex: String = long.iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(
            hex,
            "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54"
        );
    }

    /// Values computed with the Node prototype (`docs/design/sync-lan/proto/channel.mjs` `dailyHint`).
    #[test]
    fn hint_matches_the_prototype() {
        assert_eq!(hint_for_date(&hub(), "2026-11-07"), "8cabc03f7ec44c28");
        assert_eq!(hint_for_date(&hub(), "1970-01-01"), "00f9893b39bb376f");
        assert_eq!(hint_for_date(&hub(), "2024-02-29"), "70b8c427367baf52");
    }

    #[test]
    fn dates_come_out_right_including_leap_days() {
        assert_eq!(utc_date(0), "1970-01-01");
        assert_eq!(utc_date(19_782), "2024-02-29");
        assert_eq!(utc_date(20_399), "2025-11-07");
        assert_eq!(utc_date(-1), "1969-12-31");
        assert_eq!(utc_date(11_016), "2000-02-29");
    }

    #[test]
    fn the_hint_rotates_daily_and_the_window_covers_three_days() {
        assert_eq!(daily_hint(&hub(), NOON), "8cabc03f7ec44c28");
        assert_ne!(daily_hint(&hub(), NOON), daily_hint(&hub(), NOON + 86_400));
        let around = hints_around(&hub(), NOON);
        assert_eq!(around[1], daily_hint(&hub(), NOON));
        assert_eq!(around[0], daily_hint(&hub(), NOON - 86_400));
        assert_eq!(around[2], daily_hint(&hub(), NOON + 86_400));
        // a different hub key never matches
        let other = PublicKey::from_bytes([8u8; 32]);
        assert!(!hints_around(&other, NOON).contains(&around[1]));
    }
}
