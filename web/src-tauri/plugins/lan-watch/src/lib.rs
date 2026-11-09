//! Android: what home-network sync needs from the platform (CONCEPT §4, §6; package 4).
//!
//! * **Wi-Fi watch** (webview): a `ConnectivityManager.NetworkCallback` for `TRANSPORT_WIFI` emits
//!   `wifi-available` / `wifi-lost`; `wifi_state` answers whether a Wi-Fi network is connected. The
//!   web app syncs on `wifi-available` and greys out "Jetzt abgleichen" without Wi-Fi.
//! * **Hub search** (Rust only): [`LanWatch::discover`] browses `_nemo-sync._tcp` with `NsdManager`
//!   (holding a multicast lock while it runs) and returns the raw announcements to
//!   `src/lan_client.rs`, which matches them against the pinned hub. It is not a webview command
//!   (no permission exists for it), so announcements and hints never reach the web app.
//!
//! No location permission and no SSID: Android's normal permissions `ACCESS_NETWORK_STATE` and
//! `CHANGE_WIFI_MULTICAST_STATE` only (added to the generated manifest by
//! `web/scripts/android-manifest.mjs`). Nothing is logged. A stub on other platforms.

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[cfg(not(target_os = "android"))]
mod desktop;
#[cfg(target_os = "android")]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};
pub use models::*;

#[cfg(not(target_os = "android"))]
pub use desktop::LanWatch;
#[cfg(target_os = "android")]
pub use mobile::LanWatch;

/// Access to the plugin from `App`, `AppHandle` and `Window`.
pub trait LanWatchExt<R: Runtime> {
    fn lan_watch(&self) -> &LanWatch<R>;
}

impl<R: Runtime, T: Manager<R>> LanWatchExt<R> for T {
    fn lan_watch(&self) -> &LanWatch<R> {
        self.state::<LanWatch<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("lan-watch")
        .invoke_handler(tauri::generate_handler![commands::wifi_state])
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            let plugin = mobile::init(app, api)?;
            #[cfg(not(target_os = "android"))]
            let plugin = desktop::init(app, api)?;
            app.manage(plugin);
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod tests {
    const BUILD: &str = include_str!("../build.rs");
    const DEFAULT: &str = include_str!("../permissions/default.toml");
    const KOTLIN: &str = include_str!(
        "../android/src/main/java/io/github/sgnemo/taschenmesser/lanwatch/LanWatchPlugin.kt"
    );
    const SEARCH: &str = include_str!(
        "../android/src/main/java/io/github/sgnemo/taschenmesser/lanwatch/HubSearch.kt"
    );

    /// The search is Rust-only: no webview permission may exist for it.
    #[test]
    fn the_hub_search_is_not_a_webview_command() {
        let commands = BUILD
            .lines()
            .find(|l| l.starts_with("const COMMANDS"))
            .unwrap();
        assert!(!commands.contains("discover"), "{commands}");
        assert!(!DEFAULT.contains("discover"));
        assert!(
            KOTLIN.contains("fun discover("),
            "the Kotlin side still has it"
        );
    }

    /// No location permission, no SSID, no logging on the Kotlin side.
    #[test]
    fn the_kotlin_side_reads_no_ssid_and_logs_nothing() {
        for banned in [
            "ssid",
            "SSID",
            "ACCESS_FINE_LOCATION",
            "ACCESS_COARSE_LOCATION",
            "getConnectionInfo",
            "Log.",
            "println",
            "printStackTrace",
        ] {
            assert!(!KOTLIN.contains(banned), "{banned}");
            assert!(!SEARCH.contains(banned), "{banned}");
        }
    }

    /// The Kotlin search looks for exactly the type the hub announces.
    #[test]
    fn the_search_type_matches_the_hub() {
        let hub = include_str!("../../../crates/lan-sync/src/discovery.rs");
        assert!(hub.contains("SERVICE_TYPE: &str = \"_nemo-sync._tcp.local.\""));
        assert!(SEARCH.contains("SERVICE_TYPE = \"_nemo-sync._tcp\""));
    }
}
