//! mDNS announcement of the hub (`_nemo-sync._tcp.local`), CONCEPT §4.
//!
//! * Instance and host name are random and new on every start (never the PC's name).
//! * TXT carries only `v=1` and `h=<daily hint>`: the first 8 bytes (hex) of
//!   `HMAC-SHA256(key = SHA-256(hub static public key), msg = "YYYY-MM-DD" UTC)`. Only a device that
//!   knows the hub key can match it; clients accept yesterday, today and tomorrow ([`hints_around`]).
//! * The daemon is told to announce **only** on the interfaces of the bound addresses (everything
//!   else is disabled right after it is created). Be exact about what that does not do: `mdns-sd`
//!   binds the wildcard sockets `0.0.0.0:5353`/`[::]:5353` and joins the multicast group on every
//!   interface *before* `disable_interface(All)` is processed, and the wildcard socket stays open.
//!   In that window and afterwards the hub may *receive* mDNS queries from any interface, but
//!   nothing is *announced* except on the bound addresses; the announcement is registered only after
//!   the interface commands.
//!
//! The announcement never contains a device name, a key or an address other than the bound ones.
//! (The hint helpers are pure and tested on any machine; [`Announcer`] needs a multicast-capable
//! interface and is exercised by hand, see MANUAL-TESTS.)

use crate::hub::netpolicy::Bind;
use crate::noise::PublicKey;
use mdns_sd::{IfKind, ServiceDaemon, ServiceInfo};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::net::IpAddr;

pub const SERVICE_TYPE: &str = "_nemo-sync._tcp.local.";

fn hmac_sha256(key: &[u8], msg: &[u8]) -> [u8; 32] {
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

/// The TXT properties: exactly `v` and `h`, nothing else, ever.
pub fn txt_properties(hub: &PublicKey, unix_secs: u64) -> Vec<(&'static str, String)> {
    vec![("v", "1".to_owned()), ("h", daily_hint(hub, unix_secs))]
}

fn random_name() -> Result<String, DiscoveryError> {
    let mut b = [0u8; 4];
    getrandom::fill(&mut b).map_err(|_| DiscoveryError::Random)?;
    Ok(format!(
        "nemo-{}",
        b.iter().map(|x| format!("{x:02x}")).collect::<String>()
    ))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiscoveryError {
    Random,
    Daemon,
}

/// A running announcement. Dropping it withdraws the service and stops the daemon.
pub struct Announcer {
    daemon: ServiceDaemon,
    fullname: String,
    day: i64,
}

impl Announcer {
    /// Announces the hub on exactly the interfaces of `binds`. `unix_secs` only picks the day of
    /// the hint; call [`Announcer::day`] and restart after midnight (the supervisor does).
    pub fn start(
        binds: &[Bind],
        port: u16,
        hub: &PublicKey,
        unix_secs: u64,
    ) -> Result<Announcer, DiscoveryError> {
        if binds.is_empty() {
            return Err(DiscoveryError::Daemon);
        }
        let name = random_name()?;
        let daemon = ServiceDaemon::new().map_err(|_| DiscoveryError::Daemon)?;
        // everything off first, then only the bound addresses
        daemon
            .disable_interface(IfKind::All)
            .map_err(|_| DiscoveryError::Daemon)?;
        let ips: Vec<IpAddr> = binds.iter().map(|b| IpAddr::V4(b.ip())).collect();
        for ip in &ips {
            daemon
                .enable_interface(IfKind::Addr(*ip))
                .map_err(|_| DiscoveryError::Daemon)?;
        }
        let props: HashMap<String, String> = txt_properties(hub, unix_secs)
            .into_iter()
            .map(|(k, v)| (k.to_owned(), v))
            .collect();
        let info = ServiceInfo::new(
            SERVICE_TYPE,
            &name,
            &format!("{name}.local."),
            &ips[..],
            port,
            props,
        )
        .map_err(|_| DiscoveryError::Daemon)?;
        let fullname = info.get_fullname().to_owned();
        daemon.register(info).map_err(|_| DiscoveryError::Daemon)?;
        Ok(Announcer {
            daemon,
            fullname,
            day: day_of(unix_secs),
        })
    }

    pub fn day(&self) -> i64 {
        self.day
    }
}

impl Drop for Announcer {
    fn drop(&mut self) {
        let _ = self.daemon.unregister(&self.fullname);
        let _ = self.daemon.shutdown();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hub() -> PublicKey {
        PublicKey::from_bytes([7u8; 32])
    }

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

    /// Values computed with the Node prototype (`docs/design/sync-lan/proto/channel.mjs` `dailyHint`):
    /// the client side (package 3) must produce exactly these.
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
        let noon = 1_794_052_800; // 2026-11-07 12:00 UTC
        assert_eq!(daily_hint(&hub(), noon), "8cabc03f7ec44c28");
        assert_ne!(daily_hint(&hub(), noon), daily_hint(&hub(), noon + 86_400));
        let around = hints_around(&hub(), noon);
        assert_eq!(around[1], daily_hint(&hub(), noon));
        assert_eq!(around[0], daily_hint(&hub(), noon - 86_400));
        assert_eq!(around[2], daily_hint(&hub(), noon + 86_400));
        // a different hub key never matches
        let other = PublicKey::from_bytes([8u8; 32]);
        assert!(!hints_around(&other, noon).contains(&around[1]));
    }

    #[test]
    fn txt_has_only_version_and_hint() {
        let props = txt_properties(&hub(), 1_794_052_800);
        let keys: Vec<&str> = props.iter().map(|(k, _)| *k).collect();
        assert_eq!(keys, ["v", "h"]);
        assert_eq!(props[0].1, "1");
        assert_eq!(props[1].1.len(), 16);
    }

    #[test]
    fn instance_names_are_random_and_anonymous() {
        let a = random_name().unwrap();
        assert!(a.starts_with("nemo-") && a.len() == 13);
        assert_ne!(a, random_name().unwrap());
    }

    #[test]
    fn no_binds_no_announcement() {
        assert!(matches!(
            Announcer::start(&[], 1234, &hub(), 0),
            Err(DiscoveryError::Daemon)
        ));
    }
}
