//! mDNS announcement of the hub (`_nemo-sync._tcp.local`), CONCEPT §4.
//!
//! * Instance and host name are random and new on every start (never the PC's name).
//! * TXT carries only `v=1` and `h=<daily hint>` (`crate::hint`, shared with the devices that match
//!   it): the first 8 bytes (hex) of `HMAC-SHA256(key = SHA-256(hub static public key),
//!   msg = "YYYY-MM-DD" UTC)`; clients accept yesterday, today and tomorrow ([`hints_around`]).
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

pub use crate::hint::{daily_hint, day_of, hint_for_date, hints_around, utc_date};
use crate::hub::netpolicy::Bind;
use crate::noise::PublicKey;
use mdns_sd::{IfKind, ServiceDaemon, ServiceInfo};
use std::collections::HashMap;
use std::net::IpAddr;

pub const SERVICE_TYPE: &str = "_nemo-sync._tcp.local.";

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
