//! Finding the pinned hub again after the PC got a new address (CONCEPT §4, package 4). Only after
//! a round failed with a network error: the platform browses `_nemo-sync._tcp` (Android: the
//! `lan-watch` plugin's `NsdManager`), this module keeps the announcements that carry the pinned
//! hub's daily hint, and the caller tries them with a pinned Noise `IK` session. A match is only a
//! candidate: a host without the hub's private key cannot finish the handshake, so a copied
//! announcement leads nowhere. Nothing here logs or formats an address, a hint or a key.

use crate::client::ClientError;
use crate::hint::hints_around;
use crate::noise::PublicKey;
use crate::qr;
use std::net::{Ipv4Addr, SocketAddrV4};

/// One `_nemo-sync._tcp` service as the platform's browser resolved it (raw, unchecked).
#[derive(Clone, PartialEq, Eq)]
pub struct Found {
    pub ipv4: Ipv4Addr,
    pub port: u16,
    /// TXT `v`.
    pub version: Option<String>,
    /// TXT `h`.
    pub hint: Option<String>,
}

impl std::fmt::Debug for Found {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Found(..)")
    }
}

/// At most this many addresses are tried per search (a busy network cannot make a round slow).
pub const MAX_CANDIDATES: usize = 3;

/// The addresses worth a handshake: `v=1`, a hint of the pinned hub (yesterday/today/tomorrow), a
/// private IPv4 address, a port, not the address that just failed; no duplicates, at most
/// [`MAX_CANDIDATES`].
pub fn candidates(
    found: &[Found],
    hub: &PublicKey,
    unix_secs: u64,
    failed: SocketAddrV4,
) -> Vec<SocketAddrV4> {
    let hints = hints_around(hub, unix_secs);
    let mut out: Vec<SocketAddrV4> = Vec::new();
    for f in found {
        let addr = SocketAddrV4::new(f.ipv4, f.port);
        let ok = f.version.as_deref() == Some("1")
            && f.hint
                .as_deref()
                .is_some_and(|h| hints.iter().any(|x| x.eq_ignore_ascii_case(h)))
            && f.port != 0
            && qr::is_private_v4(f.ipv4.octets())
            && addr != failed
            && !out.contains(&addr);
        if ok {
            out.push(addr);
            if out.len() == MAX_CANDIDATES {
                break;
            }
        }
    }
    out
}

/// Tries the candidates in order with `open` (a pinned `IK` session) and returns the first address
/// that answered as the hub, with what `open` returned. The hub's authenticated "unknown device"
/// ends the search (it is an answer, not a wrong host); any other failure tries the next address.
pub fn first_that_opens<T>(
    candidates: &[SocketAddrV4],
    open: &mut dyn FnMut(SocketAddrV4) -> Result<T, ClientError>,
) -> Result<Option<(SocketAddrV4, T)>, ClientError> {
    for addr in candidates {
        match open(*addr) {
            Ok(t) => return Ok(Some((*addr, t))),
            Err(ClientError::UnknownDevice) => return Err(ClientError::UnknownDevice),
            Err(_) => {}
        }
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hint::daily_hint;

    const NOON: u64 = 1_794_052_800; // 2026-11-07 12:00 UTC

    fn hub() -> PublicKey {
        PublicKey::from_bytes([7u8; 32])
    }

    fn found(ip: [u8; 4], port: u16, v: &str, h: &str) -> Found {
        Found {
            ipv4: Ipv4Addr::from(ip),
            port,
            version: Some(v.to_owned()),
            hint: Some(h.to_owned()),
        }
    }

    fn old() -> SocketAddrV4 {
        SocketAddrV4::new(Ipv4Addr::new(192, 168, 1, 20), 47_100)
    }

    #[test]
    fn only_announcements_of_the_pinned_hub_become_candidates() {
        let today = daily_hint(&hub(), NOON);
        let yesterday = daily_hint(&hub(), NOON - 86_400);
        let tomorrow = daily_hint(&hub(), NOON + 86_400);
        let stale = daily_hint(&hub(), NOON - 2 * 86_400);
        let other = daily_hint(&PublicKey::from_bytes([8u8; 32]), NOON);
        let list = [
            found([192, 168, 1, 30], 47_100, "1", &today),
            found([192, 168, 1, 31], 47_100, "1", &other),
            found([192, 168, 1, 32], 47_100, "1", &stale),
            found([192, 168, 1, 33], 47_100, "2", &today),
            found([8, 8, 8, 8], 47_100, "1", &today),
            found([100, 64, 0, 1], 47_100, "1", &today),
            found([192, 168, 1, 34], 0, "1", &today),
            found([192, 168, 1, 20], 47_100, "1", &today), // the address that just failed
            found([192, 168, 1, 30], 47_100, "1", &today), // duplicate
            found([10, 0, 0, 5], 47_101, "1", &yesterday.to_uppercase()),
            found([172, 16, 0, 9], 47_100, "1", &tomorrow),
        ];
        let got = candidates(&list, &hub(), NOON, old());
        assert_eq!(
            got,
            [
                SocketAddrV4::new(Ipv4Addr::new(192, 168, 1, 30), 47_100),
                SocketAddrV4::new(Ipv4Addr::new(10, 0, 0, 5), 47_101),
                SocketAddrV4::new(Ipv4Addr::new(172, 16, 0, 9), 47_100),
            ]
        );
    }

    #[test]
    fn missing_txt_and_a_new_port_on_the_old_address() {
        let today = daily_hint(&hub(), NOON);
        let mut no_hint = found([192, 168, 1, 40], 47_100, "1", &today);
        no_hint.hint = None;
        let mut no_version = found([192, 168, 1, 41], 47_100, "1", &today);
        no_version.version = None;
        // the same PC restarted on another port is a candidate (only the exact failed address is not)
        let new_port = found([192, 168, 1, 20], 47_200, "1", &today);
        let got = candidates(&[no_hint, no_version, new_port], &hub(), NOON, old());
        assert_eq!(
            got,
            [SocketAddrV4::new(Ipv4Addr::new(192, 168, 1, 20), 47_200)]
        );
    }

    #[test]
    fn at_most_three_candidates() {
        let today = daily_hint(&hub(), NOON);
        let list: Vec<Found> = (1..=9)
            .map(|i| found([192, 168, 2, i], 47_100, "1", &today))
            .collect();
        assert_eq!(candidates(&list, &hub(), NOON, old()).len(), MAX_CANDIDATES);
    }

    #[test]
    fn the_first_address_that_opens_wins() {
        let a = SocketAddrV4::new(Ipv4Addr::new(192, 168, 1, 30), 1);
        let b = SocketAddrV4::new(Ipv4Addr::new(192, 168, 1, 31), 1);
        let c = SocketAddrV4::new(Ipv4Addr::new(192, 168, 1, 32), 1);
        let mut tried = Vec::new();
        let got = first_that_opens(&[a, b, c], &mut |addr| {
            tried.push(addr);
            if addr == b {
                Ok("session")
            } else {
                Err(ClientError::Network)
            }
        });
        assert_eq!(got, Ok(Some((b, "session"))));
        assert_eq!(tried, [a, b]);
    }

    #[test]
    fn nothing_opens_or_the_hub_says_unknown_device() {
        let a = SocketAddrV4::new(Ipv4Addr::new(192, 168, 1, 30), 1);
        let b = SocketAddrV4::new(Ipv4Addr::new(192, 168, 1, 31), 1);
        let none: Result<Option<(SocketAddrV4, ())>, _> =
            first_that_opens(&[a, b], &mut |_| Err(ClientError::Protocol));
        assert_eq!(none, Ok(None));
        let mut tried = 0;
        let refused: Result<Option<(SocketAddrV4, ())>, _> = first_that_opens(&[a, b], &mut |_| {
            tried += 1;
            Err(ClientError::UnknownDevice)
        });
        assert_eq!(refused, Err(ClientError::UnknownDevice));
        assert_eq!(tried, 1);
        let empty: Result<Option<(SocketAddrV4, ())>, _> = first_that_opens(&[], &mut |_| Ok(()));
        assert_eq!(empty, Ok(None));
    }
}
