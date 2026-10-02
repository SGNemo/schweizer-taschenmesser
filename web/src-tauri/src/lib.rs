//! Native shell of Nemo. The app itself is the web frontend in `../src`; this crate only
//! provides the window and the plugins that `web/src/core/platform/tauri` wraps behind the
//! `PlatformService` interface. Keep it thin: logic belongs into the (tested) TypeScript side.

#[cfg(desktop)]
mod capture;
#[cfg(desktop)]
mod disk;
#[cfg(desktop)]
mod local_api;
#[cfg(desktop)]
mod oauth;
#[cfg(desktop)]
mod portable;
#[cfg(desktop)]
mod system;
#[cfg(desktop)]
mod update;
#[cfg(desktop)]
pub mod vault_bridge;
#[cfg(desktop)]
pub mod vault_host;
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
        .and_then(|exe| portable::data_dir(&exe, &app.config().identifier))
    {
        builder = builder.data_directory(dir);
    }
    // Dev-Preview: say so in the title bar (the stable build keeps the configured title).
    if portable::is_dev_identifier(&app.config().identifier) {
        builder = builder.title("Nemo Dev");
    }
    // Started by "start with Windows" (see capture.rs): stay in the tray.
    if std::env::args().any(|a| a == capture::AUTOSTART_FLAG) {
        builder = builder.visible(false);
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

    let builder = tauri::Builder::default();

    // Must be registered first. A second start (double click, "start with Windows" while the app
    // sits in the tray) hands over to the running instance instead of opening a second one that
    // would share the same profile and lose the hotkey. `portable::startup` above has already
    // waited for the previous process after a self-update, so an update relaunch is not mistaken
    // for a second instance.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        capture::show_main(app);
    }));

    let builder = builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        // Android self-update (download + installer intent); a stub that reports `unsupported` elsewhere.
        .plugin(tauri_plugin_apk_installer::init())
        // OS keystore, biometric gate for the vault key, screenshot protection (Android).
        .plugin(tauri_plugin_secure_store::init())
        // Text and links shared from other Android apps (ACTION_SEND).
        .plugin(tauri_plugin_share_intent::init());

    // Desktop self-update (signature-verified by the plugin; see update.rs).
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Quick capture: global hotkey and "start with Windows" are driven from capture.rs.
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![capture::AUTOSTART_FLAG]),
        ))
        .manage(capture::CaptureState::default())
        .on_window_event(capture::on_window_event)
        .manage(update::PendingUpdate::default())
        .manage(oauth::OAuthListener::default())
        .manage(local_api::LocalApi::default())
        .manage(disk::DiskScans::default())
        .manage(system::SystemMonitor::default())
        .manage(vault_bridge::VaultBridge::default())
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
            disk::disk_place_sizes,
            disk::disk_recycle_size,
            disk::disk_node_path,
            disk::disk_reveal,
            disk::disk_find_duplicates,
            disk::disk_duplicates_cancel,
            disk::disk_can_delete,
            disk::disk_delete_plan,
            disk::disk_delete,
            disk::disk_delete_cancel,
            system::system_info,
            system::system_processes,
            system::system_disk_io,
            system::system_open_task_manager,
            capture::capture_set_hotkey,
            capture::desktop_set_vault_hotkey,
            vault_bridge::vault_bridge_start,
            vault_bridge::vault_bridge_respond,
            vault_bridge::vault_bridge_stop,
            vault_bridge::vault_bridge_register,
            vault_bridge::vault_bridge_status,
            vault_bridge::vault_bridge_unregister,
            capture::capture_hide,
            capture::capture_read_clipboard,
            capture::desktop_set_close_to_tray,
            capture::desktop_set_tray_labels,
            capture::desktop_set_autostart,
            capture::desktop_autostart_enabled,
            capture::desktop_info,
            capture::desktop_show_main
        ]);

    // Windows creates the main window itself (portable data folder); every desktop OS then sets up
    // the hidden capture window and the tray.
    #[cfg(desktop)]
    let builder = builder.setup(|app| {
        #[cfg(windows)]
        create_main_window(app)?;
        capture::setup(app)
    });

    builder
        .run(tauri::generate_context!())
        .expect("error while running Nemo");
}
