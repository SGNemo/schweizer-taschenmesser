const COMMANDS: &[&str] = &[
    "set_immersive",
    "set_keep_awake",
    "set_volume_keys",
    // the `volume-key` event of the Android plugin
    "register_listener",
    "remove_listener",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
