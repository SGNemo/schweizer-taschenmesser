/// Every app command the webview may call. Listing them here makes Tauri generate one
/// `allow-<command>` permission each, and a command that no capability grants cannot be invoked.
/// Keep in step with `generate_handler!` in `src/lib.rs` (the desktop capability grants them).
const APP_COMMANDS: &[&str] = &[
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
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(APP_COMMANDS)),
    )
    .expect("failed to run tauri-build");
}
