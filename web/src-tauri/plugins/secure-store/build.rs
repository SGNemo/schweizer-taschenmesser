const COMMANDS: &[&str] = &[
    "available",
    "set",
    "get",
    "delete",
    "biometric_seal",
    "biometric_unseal",
    "biometric_has",
    "biometric_delete",
    "set_secure_window",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
