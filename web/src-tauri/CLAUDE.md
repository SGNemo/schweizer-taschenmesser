# web/src-tauri/ – native shell (Tauri 2, Rust)

Thin shell around the web app; logic that can be Tauri-free lives in `crates/` and `plugins/` (`ls crates plugins`) so Linux can test it. Map: `docs/architecture/`.

- **Checks (in `web/src-tauri/`):** `cargo fmt --check && cargo clippy --all-targets --locked -p <crate> -- -D warnings && cargo test --locked -p <crate>` (CI's full `-p` list: job "Native shell" in `.github/workflows/ci.yml`); Windows-only code: `cargo check -p taschenmesser-disk-scan --target x86_64-pc-windows-msvc`. New crate → add to the `-p` lists in `.github/workflows/ci.yml`.
- **New command:** handler in `src/lib.rs` + `build.rs` `COMMANDS` + grant in `capabilities/desktop.json` (desktop only) or `default.json` (shared); the capture window gets only `capabilities/capture.json`. `tests/commands.rs` guards all three.
- **Never change:** bundle identifier `io.github.sgnemo.taschenmesser` (Dev-Preview `.dev` flavor comes from `tauri.dev.conf.json`), updater endpoint/pubkey, keystore alias.
- **Disk guard** (`crates/disk-scan/src/guard.rs`): do not weaken; delete takes node ids, block list runs at plan and at delete; second confirmation (large/permanent) checked in Rust.
- **LAN sync and remote control** (`crates/lan-sync`, `crates/remote-input`): own listener, never the Local API's; private addresses of the identified home network only (fail-closed; pairing window: RULES.md); input simulation only in `crates/remote-input` (Windows only), reached only from the hub's input session, no Tauri command simulates input; `crates/lan-sync` stays free of `unsafe`, logging and OS input APIs. Full text before any change: `docs/RULES.md` "LAN sync", `docs/rules/remote-control.md`.
- **Local API** (`crates/local-api`): loopback only, no bind-address setting, no CORS, never log tokens/bodies.
- **Vault bridge** (`crates/vault-bridge`, `src/vault_host.rs`): the exe is the native messaging host when argv[1] starts with `chrome-extension://`; per-user pipe, request/response only, never log bodies. Windows check: `cargo check -p taschenmesser-vault-bridge --target x86_64-pc-windows-msvc`.
- **Updater:** `src/update.rs` accepts the dev manifest/exe only at the fixed `dev-preview` release path; `src/portable.rs` re-verifies the minisign signature before swapping the exe.
- Frontend only reaches Rust through `web/src/core/platform/tauri/**` (`getPlatform()`).
