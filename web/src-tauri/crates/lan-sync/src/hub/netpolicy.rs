//! Where the hub may listen (CONCEPT §4/§5), as pure functions over an abstract interface list.
//! The OS-facing implementations (Windows network list, gateway MAC elsewhere) come with package
//! 2b-2 and only fill [`NetworkInfo`]. Everything is fail-closed: an unreadable interface list or
//! home-network store, an unknown network, or no qualifying interface means **no listener**.
//!
//! v1 is IPv4 only (the QR carries four address bytes): RFC 1918 and link-local. Loopback,
//! unspecified, CGNAT (100.64/10), public, multicast, broadcast and every IPv6 address (also
//! IPv4-mapped ones) are refused.

use std::net::{IpAddr, Ipv4Addr};

/// Category the OS gives the network (Windows: Private/Public/Domain).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NetCategory {
    Private,
    Public,
    Domain,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IfaceInfo {
    pub ip: IpAddr,
    pub prefix: u8,
    /// Virtual adapters (WSL2, Docker, Hyper-V) have none.
    pub has_default_route: bool,
    pub category: NetCategory,
    /// Stable id of the network (Windows network id, else a hash of the gateway MAC); `None` = unknown.
    pub network_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NetError;

pub trait NetworkInfo {
    fn interfaces(&self) -> Result<Vec<IfaceInfo>, NetError>;
}

/// The one stored home network. Changed only on explicit user action (not here).
pub trait HomeNetworkStore {
    fn home_network_id(&self) -> Result<Option<String>, NetError>;
}

/// Addresses the hub may bind to or accept from.
pub fn is_allowed_hub_addr(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_private() || v4.is_link_local(),
        IpAddr::V6(_) => false,
    }
}

/// One address the hub binds, with its subnet for the peer check.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Bind {
    ip: Ipv4Addr,
    prefix: u8,
    /// The interface is on the stored home network (see [`decide`]). Remote-control input is
    /// accepted only on such a bind; sync and pairing do not look at it.
    home: bool,
}

impl Bind {
    /// `prefix` must be 1..=32: a /0 would match every peer.
    pub fn new(ip: Ipv4Addr, prefix: u8) -> Option<Bind> {
        (1..=32).contains(&prefix).then_some(Bind {
            ip,
            prefix,
            home: false,
        })
    }

    /// Whether this bind is on the stored home network. Only [`decide`] ever says yes.
    pub fn is_home(&self) -> bool {
        self.home
    }

    pub(crate) fn with_home(mut self, home: bool) -> Bind {
        self.home = home;
        self
    }

    pub fn ip(&self) -> Ipv4Addr {
        self.ip
    }

    pub fn prefix(&self) -> u8 {
        self.prefix
    }

    pub fn contains(&self, peer: Ipv4Addr) -> bool {
        let mask = u32::MAX << (32 - u32::from(self.prefix));
        u32::from(self.ip) & mask == u32::from(peer) & mask
    }
}

/// A peer may talk to the hub only from a private/link-local address inside a bound subnet.
pub fn peer_allowed(peer: IpAddr, binds: &[Bind]) -> bool {
    match peer {
        IpAddr::V4(v4) if is_allowed_hub_addr(peer) => binds.iter().any(|b| b.contains(v4)),
        _ => false,
    }
}

/// What the user currently asks for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Wanted {
    pub pairing_window_open: bool,
    pub paired_devices: usize,
}

impl Wanted {
    /// The hub listens only while a window is open or at least one device is paired.
    pub fn listening(&self) -> bool {
        self.pairing_window_open || self.paired_devices > 0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OffReason {
    NothingWanted,
    /// Interface list or home-network store unreadable.
    NetworkUnreadable,
    /// Devices are paired but no home network is stored.
    NoHomeNetwork,
    /// A network category of "Public" was the only candidate (status "blocked" in the UI).
    PublicNetwork,
    NoQualifyingInterface,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Decision {
    Off(OffReason),
    /// Sorted, no duplicates.
    On(Vec<Bind>),
}

fn qualifies(i: &IfaceInfo) -> Option<Bind> {
    match i.ip {
        IpAddr::V4(ip)
            if is_allowed_hub_addr(i.ip)
                && i.has_default_route
                && i.category == NetCategory::Private
                && (1..=30).contains(&i.prefix) =>
        {
            Bind::new(ip, i.prefix)
        }
        _ => None,
    }
}

/// The set of addresses to bind right now, or why not.
///
/// * An open pairing window listens on the current private networks (it has to work for the very
///   first pairing, before a home network is stored).
/// * Otherwise (paired devices only) only on interfaces whose network id equals the stored home
///   network; an interface without a network id never matches.
/// * Every bind says whether it is on the stored home network ([`Bind::is_home`]). That flag changes
///   nothing about where the hub listens; remote-control input is accepted only where it is set.
pub fn decide(info: &dyn NetworkInfo, home: &dyn HomeNetworkStore, wanted: Wanted) -> Decision {
    if !wanted.listening() {
        return Decision::Off(OffReason::NothingWanted);
    }
    let Ok(ifaces) = info.interfaces() else {
        return Decision::Off(OffReason::NetworkUnreadable);
    };
    // The stored home network is read also while a window is open: it does not decide where the
    // window listens, only which binds are flagged `home` (fail-closed: unreadable or none = no
    // bind is home, so no input session anywhere).
    let stored = home.home_network_id();
    let home_id = if wanted.pairing_window_open {
        None
    } else {
        match &stored {
            Err(_) => return Decision::Off(OffReason::NetworkUnreadable),
            Ok(None) => return Decision::Off(OffReason::NoHomeNetwork),
            Ok(Some(id)) => Some(id.as_str()),
        }
    };
    let is_home = |i: &IfaceInfo| match (&stored, i.network_id.as_deref()) {
        (Ok(Some(h)), Some(id)) => h == id,
        _ => false,
    };
    let mut binds: Vec<Bind> = ifaces
        .iter()
        .filter(|i| match home_id {
            Some(h) => i.network_id.as_deref() == Some(h),
            None => true,
        })
        .filter_map(|i| qualifies(i).map(|b| b.with_home(is_home(i))))
        .collect();
    binds.sort();
    // one listener per address; two interfaces on one address are home only if both are
    binds.dedup_by(|later, kept| {
        let same = later.ip == kept.ip && later.prefix == kept.prefix;
        if same {
            kept.home &= later.home;
        }
        same
    });
    if !binds.is_empty() {
        return Decision::On(binds);
    }
    let public_only = ifaces
        .iter()
        .any(|i| i.category == NetCategory::Public && is_allowed_hub_addr(i.ip));
    Decision::Off(if public_only {
        OffReason::PublicNetwork
    } else {
        OffReason::NoQualifyingInterface
    })
}
