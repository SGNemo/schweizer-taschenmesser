const COMMANDS: &[&str] = &["take_pending"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
