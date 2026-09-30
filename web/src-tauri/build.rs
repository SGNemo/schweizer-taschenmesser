/// Every app command, so that capabilities can grant them per window (`allow-<name>`). A command
/// missing from this list cannot be invoked by any window; `tests/commands.rs` compares the list
/// with the `generate_handler!` block in `src/lib.rs`.
const COMMANDS: &[&str] = &[
    "check_update",
    "install_update",
    "oauth_listen_start",
    "oauth_listen_wait",
    "local_api_start",
    "local_api_stop",
    "local_api_set_tokens",
    "local_api_respond",
    "disk_list_drives",
    "disk_scan_start",
    "disk_scan_cancel",
    "disk_scan_pause",
    "disk_scan_drop",
    "disk_children",
    "disk_node",
    "disk_query",
    "disk_known_places",
    "disk_node_path",
    "disk_reveal",
    "disk_find_duplicates",
    "disk_duplicates_cancel",
    "disk_can_delete",
    "disk_delete_plan",
    "disk_delete",
    "disk_delete_cancel",
    "system_info",
    "system_processes",
    "capture_set_hotkey",
    "capture_hide",
    "capture_read_clipboard",
    "desktop_set_close_to_tray",
    "desktop_set_tray_labels",
    "desktop_set_autostart",
    "desktop_autostart_enabled",
    "desktop_info",
    "desktop_show_main",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build");
}
