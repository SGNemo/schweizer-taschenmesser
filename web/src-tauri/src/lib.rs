//! Native shell of Taschenmesser. The app itself is the web frontend in `../src`; this crate only
//! provides the window and the plugins that `web/src/core/platform/tauri` wraps behind the
//! `PlatformService` interface. Keep it thin: logic belongs into the (tested) TypeScript side.

#[cfg(desktop)]
mod disk;
#[cfg(desktop)]
mod local_api;
#[cfg(desktop)]
mod oauth;
#[cfg(desktop)]
mod portable;
#[cfg(desktop)]
mod update;
#[cfg(desktop)]
mod webview2;

/// Windows creates the main window itself (config `tauri.windows.conf.json` sets `create: false`) so
/// that portable mode can point WebView2 at a `data/` folder next to the executable.
#[cfg(windows)]
fn create_main_window(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or("no window configured")?;
    let mut builder = tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?;
    if let Some(dir) = std::env::current_exe()
        .ok()
        .and_then(|exe| portable::data_dir(&exe))
    {
        builder = builder.data_directory(dir);
    }
    builder.build()?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Windows: explain a missing WebView2 runtime instead of failing silently, then tidy up after an update.
    #[cfg(windows)]
    {
        if !webview2::ensure_runtime() {
            return;
        }
        if let Ok(exe) = std::env::current_exe() {
            let args: Vec<String> = std::env::args().collect();
            portable::startup(&exe, &args);
        }
    }

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        // Android self-update (download + installer intent); a stub that reports `unsupported` elsewhere.
        .plugin(tauri_plugin_apk_installer::init())
        // OS keystore, biometric gate for the vault key, screenshot protection (Android).
        .plugin(tauri_plugin_secure_store::init());

    // Desktop self-update (signature-verified by the plugin; see update.rs).
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(update::PendingUpdate::default())
        .manage(oauth::OAuthListener::default())
        .manage(local_api::LocalApi::default())
        .manage(disk::DiskScans::default())
        .invoke_handler(tauri::generate_handler![
            update::check_update,
            update::install_update,
            oauth::oauth_listen_start,
            oauth::oauth_listen_wait,
            local_api::local_api_start,
            local_api::local_api_stop,
            local_api::local_api_set_tokens,
            local_api::local_api_respond,
            disk::disk_list_drives,
            disk::disk_scan_start,
            disk::disk_scan_cancel,
            disk::disk_scan_pause,
            disk::disk_scan_drop,
            disk::disk_children,
            disk::disk_node,
            disk::disk_query,
            disk::disk_known_places,
            disk::disk_node_path,
            disk::disk_reveal,
            disk::disk_find_duplicates,
            disk::disk_duplicates_cancel,
            disk::disk_can_delete,
            disk::disk_delete_plan,
            disk::disk_delete,
            disk::disk_delete_cancel
        ]);

    #[cfg(windows)]
    let builder = builder.setup(create_main_window);

    builder
        .run(tauri::generate_context!())
        .expect("error while running Taschenmesser");
}
