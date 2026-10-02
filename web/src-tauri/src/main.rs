// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // The browser starts native messaging hosts with the calling origin as first argument; relay
    // and exit without ever creating a window (see `vault_host`).
    #[cfg(desktop)]
    {
        let args: Vec<String> = std::env::args().skip(1).collect();
        if taschenmesser_lib::vault_host::is_host(&args) {
            std::process::exit(taschenmesser_lib::vault_host::run(&args));
        }
    }
    taschenmesser_lib::run()
}
