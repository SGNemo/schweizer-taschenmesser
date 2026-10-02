# web/src-tauri/ – native shell (Tauri 2, Rust)

Thin shell around the web app; logic that can be Tauri-free lives in `crates/` (`local-api`, `disk-scan`, `system-info`, `vault-bridge`) so it is testable on Linux. Map: `docs/architecture/{desktop,native}.md`.

- **Checks (in `web/src-tauri/`):** `cargo fmt --check && cargo clippy --all-targets --locked -p taschenmesser -p taschenmesser-local-api -p taschenmesser-disk-scan -p taschenmesser-system-info -p taschenmesser-vault-bridge -- -D warnings && cargo test --locked -p <crate>`; Windows-only code: `cargo check -p taschenmesser-disk-scan --target x86_64-pc-windows-msvc`. New crate → add to the `-p` lists in `.github/workflows/ci.yml`.
- **New command:** handler in `src/lib.rs` + `build.rs` `COMMANDS` + grant in `capabilities/desktop.json` (desktop only) or `default.json` (shared); the capture window gets only `capabilities/capture.json`. `tests/commands.rs` guards all three.
- **Never change:** bundle identifier `io.github.sgnemo.taschenmesser` (Dev-Preview `.dev` flavor comes from `tauri.dev.conf.json`), updater endpoint/pubkey, keystore alias.
- **Disk guard** (`crates/disk-scan/src/guard.rs`): do not weaken; delete takes node ids, block list runs at plan and at delete; typed confirmation is checked in Rust.
- **Local API** (`crates/local-api`): loopback only, no bind-address setting, no CORS, never log tokens/bodies.
- **Vault bridge** (`crates/vault-bridge`, `src/vault_host.rs`): the exe is the native messaging host when argv[1] starts with `chrome-extension://`; per-user pipe, request/response only, never log bodies. Windows check: `cargo check -p taschenmesser-vault-bridge --target x86_64-pc-windows-msvc`.
- **Updater:** `src/update.rs` accepts the dev manifest/exe only at the fixed `dev-preview` release path; `src/portable.rs` re-verifies the minisign signature before swapping the exe.
- Frontend only reaches Rust through `web/src/core/platform/tauri/**` (`getPlatform()`).
