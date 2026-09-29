//! Native shell of Taschenmesser. The app itself is the web frontend in `../src`; this crate only
//! provides the window and the plugins that `web/src/core/platform/tauri` wraps behind the
//! `PlatformService` interface. Keep it thin: logic belongs into the (tested) TypeScript side.

#[cfg(desktop)]
mod update;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        // Android self-update (download + installer intent); a stub that reports `unsupported` elsewhere.
        .plugin(tauri_plugin_apk_installer::init());

    // Desktop self-update (signature-verified by the plugin; see update.rs).
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(update::PendingUpdate::default())
        .invoke_handler(tauri::generate_handler![
            update::check_update,
            update::install_update
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running Taschenmesser");
}
