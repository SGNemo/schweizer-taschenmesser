//! Network adapters in plain words: type, state, the one useful IPv6 address and rates.

use crate::{Iface, IfaceKind};
use std::collections::HashMap;
use std::net::{Ipv4Addr, Ipv6Addr};

/// An IPv6 address with the facts needed to decide whether it is the "main" one.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RawV6 {
    pub addr: Ipv6Addr,
    /// Privacy extension address that changes regularly.
    pub temporary: bool,
    /// Old address that is being replaced.
    pub deprecated: bool,
}

#[derive(Clone, Debug, Default)]
pub struct RawAdapter {
    pub name: String,
    pub description: String,
    /// IANA ifType (6 Ethernet, 71 Wi-Fi, 24 loopback, 131 tunnel, 53 virtual); 0 = unknown.
    pub if_type: u32,
    pub up: bool,
    pub v4: Vec<Ipv4Addr>,
    pub v6: Vec<RawV6>,
}

const IF_ETHERNET: u32 = 6;
const IF_LOOPBACK: u32 = 24;
const IF_WIFI: u32 = 71;

/// What kind of adapter this is. Virtual adapters (Hyper-V, WSL, VPN, Docker, VMs) are muted in the UI.
pub fn kind_of(name: &str, description: &str, if_type: u32) -> IfaceKind {
    let text = format!("{name} {description}").to_lowercase();
    const VIRTUAL: [&str; 12] = [
        "vethernet",
        "hyper-v",
        "virtualbox",
        "vmware",
        "vmnet",
        "wsl",
        "docker",
        "veth",
        "virbr",
        "tap-",
        "wireguard",
        "tailscale",
    ];
    if VIRTUAL.iter().any(|v| text.contains(v)) || name.starts_with("br-") {
        return IfaceKind::Virtual;
    }
    match if_type {
        IF_WIFI => IfaceKind::Wifi,
        IF_ETHERNET => IfaceKind::Ethernet,
        IF_LOOPBACK => IfaceKind::Other,
        0 => {
            if text.contains("wi-fi") || text.contains("wlan") || text.contains("wireless") {
                IfaceKind::Wifi
            } else if text.contains("ethernet") || name.starts_with("en") || name.starts_with("eth")
            {
                IfaceKind::Ethernet
            } else if name.starts_with("wl") {
                IfaceKind::Wifi
            } else {
                IfaceKind::Other
            }
        }
        _ => IfaceKind::Other,
    }
}

fn useful_v4(a: &Ipv4Addr) -> bool {
    !a.is_loopback() && !a.is_link_local() && !a.is_unspecified()
}

fn useful_v6(a: &Ipv6Addr) -> bool {
    !a.is_loopback() && !a.is_unspecified() && (a.segments()[0] & 0xffc0) != 0xfe80
}

/// Turns the raw facts into what the UI shows. Link-local and loopback addresses are dropped;
/// temporary and deprecated IPv6 addresses move to `ipv6_other` ("alle anzeigen").
pub fn classify(raw: &RawAdapter) -> Iface {
    let mut ipv4: Vec<String> = raw
        .v4
        .iter()
        .filter(|a| useful_v4(a))
        .map(|a| a.to_string())
        .collect();
    ipv4.sort();
    ipv4.dedup();

    let mut primary: Option<String> = None;
    let mut other: Vec<String> = Vec::new();
    for v in raw.v6.iter().filter(|v| useful_v6(&v.addr)) {
        let s = v.addr.to_string();
        if primary.is_none() && !v.temporary && !v.deprecated {
            primary = Some(s);
        } else {
            other.push(s);
        }
    }
    other.sort();
    other.dedup();

    Iface {
        name: if raw.name.is_empty() {
            raw.description.clone()
        } else {
            raw.name.clone()
        },
        kind: kind_of(&raw.name, &raw.description, raw.if_type),
        up: raw.up,
        ipv4,
        ipv6: primary,
        ipv6_other: other,
        ssid: None,
        signal_percent: None,
        down_bytes_per_sec: None,
        up_bytes_per_sec: None,
    }
}

/// Adapters worth showing: connected ones, or any with an address. Loopback never.
pub fn visible(list: Vec<Iface>) -> Vec<Iface> {
    let mut out: Vec<Iface> = list
        .into_iter()
        .filter(|i| {
            i.kind != IfaceKind::Other || !i.ipv4.is_empty() || i.ipv6.is_some()
        })
        .filter(|i| !i.ipv4.is_empty() || i.ipv6.is_some() || !i.ipv6_other.is_empty())
        .collect();
    // Real adapters first, virtual ones last; then by name.
    out.sort_by(|a, b| {
        (a.kind == IfaceKind::Virtual)
            .cmp(&(b.kind == IfaceKind::Virtual))
            .then_with(|| a.name.cmp(&b.name))
    });
    out
}

/// Bytes per second from two counter readings; `None` for the first reading or a counter reset.
pub fn rate(prev: u64, now: u64, secs: f64) -> Option<u64> {
    if secs <= 0.0 || now < prev {
        return None;
    }
    Some(((now - prev) as f64 / secs).round() as u64)
}

/// Fills in rates by interface name (falling back to the description).
pub fn apply_rates(
    list: &mut [Iface],
    descriptions: &HashMap<String, String>,
    rates: &HashMap<String, (u64, u64)>,
) {
    for i in list {
        let r = rates.get(&i.name).or_else(|| {
            descriptions
                .get(&i.name)
                .and_then(|d| rates.get(d))
        });
        if let Some((down, up)) = r {
            i.down_bytes_per_sec = Some(*down);
            i.up_bytes_per_sec = Some(*up);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v6(s: &str, temporary: bool, deprecated: bool) -> RawV6 {
        RawV6 {
            addr: s.parse().unwrap(),
            temporary,
            deprecated,
        }
    }

    fn ethernet() -> RawAdapter {
        RawAdapter {
            name: "Ethernet".into(),
            description: "Realtek PCIe 2.5GbE Family Controller".into(),
            if_type: 6,
            up: true,
            v4: vec!["192.168.1.20".parse().unwrap(), "169.254.9.9".parse().unwrap()],
            v6: vec![
                v6("fe80::1", false, false),
                v6("2001:db8::abcd", true, false),
                v6("2001:db8::1", false, false),
                v6("2001:db8::dead", false, true),
            ],
        }
    }

    #[test]
    fn ethernet_shows_one_main_ipv6_and_hides_link_local() {
        let i = classify(&ethernet());
        assert_eq!(i.kind, IfaceKind::Ethernet);
        assert_eq!(i.ipv4, vec!["192.168.1.20"]);
        assert_eq!(i.ipv6.as_deref(), Some("2001:db8::1"));
        assert_eq!(i.ipv6_other, vec!["2001:db8::abcd", "2001:db8::dead"]);
        assert!(i.up);
    }

    #[test]
    fn virtual_adapters_are_recognised_by_name_or_description() {
        for (name, desc) in [
            ("vEthernet (WSL)", "Hyper-V Virtual Ethernet Adapter"),
            ("VirtualBox Host-Only Network", "VirtualBox Host-Only Ethernet Adapter"),
            ("docker0", ""),
            ("br-1a2b3c", ""),
        ] {
            assert_eq!(kind_of(name, desc, 6), IfaceKind::Virtual, "{name}");
        }
        assert_eq!(kind_of("WLAN", "Intel(R) Wi-Fi 6E AX211", 71), IfaceKind::Wifi);
        assert_eq!(kind_of("lo", "", 24), IfaceKind::Other);
    }

    #[test]
    fn unknown_types_are_guessed_from_the_name_on_other_systems() {
        assert_eq!(kind_of("wlp3s0", "", 0), IfaceKind::Wifi);
        assert_eq!(kind_of("enp5s0", "", 0), IfaceKind::Ethernet);
        assert_eq!(kind_of("tun0", "", 0), IfaceKind::Other);
    }

    #[test]
    fn missing_values_do_not_break_anything() {
        let i = classify(&RawAdapter::default());
        assert_eq!(i.name, "");
        assert!(i.ipv4.is_empty() && i.ipv6.is_none() && !i.up);
    }

    #[test]
    fn visible_drops_empty_adapters_and_puts_virtual_ones_last() {
        let wsl = classify(&RawAdapter {
            name: "vEthernet (WSL)".into(),
            if_type: 6,
            up: true,
            v4: vec!["172.20.0.1".parse().unwrap()],
            ..Default::default()
        });
        let eth = classify(&ethernet());
        let empty = classify(&RawAdapter {
            name: "Bluetooth".into(),
            if_type: 6,
            ..Default::default()
        });
        let loopback = classify(&RawAdapter {
            name: "Loopback".into(),
            if_type: 24,
            v4: vec!["127.0.0.1".parse().unwrap()],
            ..Default::default()
        });
        let list = visible(vec![wsl, empty, eth, loopback]);
        let names: Vec<_> = list.iter().map(|i| i.name.as_str()).collect();
        assert_eq!(names, vec!["Ethernet", "vEthernet (WSL)"]);
    }

    #[test]
    fn rates_need_two_readings_and_ignore_counter_resets() {
        assert_eq!(rate(1_000, 4_000, 3.0), Some(1_000));
        assert_eq!(rate(5_000, 4_000, 3.0), None);
        assert_eq!(rate(0, 10, 0.0), None);
    }

    #[test]
    fn rates_are_matched_by_name_or_description() {
        let mut list = vec![classify(&ethernet())];
        let mut desc = HashMap::new();
        desc.insert("Ethernet".to_string(), "Realtek".to_string());
        let mut rates = HashMap::new();
        rates.insert("Realtek".to_string(), (10u64, 20u64));
        apply_rates(&mut list, &desc, &rates);
        assert_eq!(list[0].down_bytes_per_sec, Some(10));
        assert_eq!(list[0].up_bytes_per_sec, Some(20));
    }
}
