const COMMANDS: &[&str] = &["set_immersive", "set_keep_awake"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
