// Webview commands only. The NsdManager search (`discover` in the Kotlin plugin) is deliberately
// NOT listed: without a permission the ACL refuses it to the web app, and only Rust calls it
// (`run_mobile_plugin`), so announcements never reach the webview (tests in `src/lib.rs`).
const COMMANDS: &[&str] = &["wifi_state", "register_listener", "remove_listener"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
