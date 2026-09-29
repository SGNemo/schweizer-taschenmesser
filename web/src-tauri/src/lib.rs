//! Native shell of Taschenmesser. The app itself is the web frontend in `../src`; this crate only
//! provides the window and the plugins that `web/src/core/platform/tauri` wraps behind the
//! `PlatformService` interface. Keep it thin: logic belongs into the (tested) TypeScript side.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        // Android self-update (download + installer intent); a stub that reports `unsupported` elsewhere.
        .plugin(tauri_plugin_apk_installer::init())
        .run(tauri::generate_context!())
        .expect("error while running Taschenmesser");
}
