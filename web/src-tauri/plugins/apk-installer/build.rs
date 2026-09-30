const COMMANDS: &[&str] = &["can_install", "download", "download_progress", "install"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
