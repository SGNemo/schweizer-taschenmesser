# web/src-tauri/ – native shell (Tauri 2, Rust)

Thin shell around the web app; logic that can be Tauri-free lives in `crates/` (`local-api`, `disk-scan`, `system-info`) so it is testable on Linux. Map rows: `docs/architecture/desktop.md`, `docs/architecture/native.md`.

- **Checks (in `web/src-tauri/`):** `cargo fmt --check && cargo clippy --all-targets --locked -p taschenmesser -p taschenmesser-local-api -p taschenmesser-disk-scan -p taschenmesser-system-info -- -D warnings && cargo test --locked -p <crate>`; Windows-only code: `cargo check -p taschenmesser-disk-scan --target x86_64-pc-windows-msvc`. New crate → add to the `-p` lists in `.github/workflows/ci.yml`.
- **New command:** handler in `src/lib.rs` + `build.rs` `COMMANDS` + grant in `capabilities/desktop.json` (desktop only) or `default.json` (shared); the capture window gets only `capabilities/capture.json`. `tests/commands.rs` guards all three.
- **Never change:** bundle identifier `io.github.sgnemo.taschenmesser` (Dev-Preview `.dev` flavor comes from `tauri.dev.conf.json`), updater endpoint/pubkey, keystore alias. Signing keys never in the repo.
- **Disk guard** (`crates/disk-scan/src/guard.rs`): do not weaken; delete takes node ids, block list runs at plan and at delete; typed confirmation is checked in Rust.
- **Local API** (`crates/local-api`): loopback only, no bind-address setting, no CORS, never log tokens/bodies; blocked and unknown modules answer identically.
- **Updater:** `src/update.rs` accepts the dev manifest/exe only at the fixed `dev-preview` release path; `src/portable.rs` re-verifies the minisign signature before swapping the exe.
- Frontend only reaches Rust through `web/src/core/platform/tauri/**` (`getPlatform()`).
