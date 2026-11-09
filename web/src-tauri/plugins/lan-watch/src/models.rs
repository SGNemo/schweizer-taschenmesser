use serde::{Deserialize, Serialize};

/// Whether a Wi-Fi network is connected right now (`supported` is false off Android).
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct WifiState {
    pub supported: bool,
    pub connected: bool,
}

/// One resolved `_nemo-sync._tcp` service, raw and unchecked (`lan_sync::rediscover` checks it).
/// Rust-only: no `Serialize`, and `Debug` prints nothing, so it never reaches the webview or a log.
#[derive(Clone, Deserialize)]
pub struct Service {
    /// IPv4 address as text (the Kotlin side passes IPv4 only).
    pub host: String,
    pub port: u16,
    /// TXT `v`.
    #[serde(default)]
    pub v: Option<String>,
    /// TXT `h` (the hub's daily hint).
    #[serde(default)]
    pub h: Option<String>,
}

impl std::fmt::Debug for Service {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Service(..)")
    }
}

#[cfg_attr(not(target_os = "android"), allow(dead_code))]
#[derive(Default, Deserialize)]
pub(crate) struct Discovered {
    #[serde(default)]
    pub services: Vec<Service>,
}

/// Arguments of the Kotlin `discover` call.
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DiscoverArgs {
    pub timeout_ms: u64,
}

/// Longest search Rust asks for (a failed sync round waits for it).
pub const MAX_SEARCH_MS: u64 = 5_000;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_service_prints_nothing() {
        let s = Service {
            host: "192.168.1.5".into(),
            port: 47_100,
            v: Some("1".into()),
            h: Some("00ff00ff00ff00ff".into()),
        };
        assert_eq!(format!("{s:?}"), "Service(..)");
        assert_eq!(MAX_SEARCH_MS, 5_000);
    }
}
