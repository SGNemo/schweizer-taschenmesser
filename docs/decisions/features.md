# Decisions in full – Imports/API, connectors, disk module, setup assistant

Full text (decision, reason, source). One-line summary table: [DECISIONS](../DECISIONS.md).

## Imports & AI import API
- **Preview-before-write for every import:** wizard shows per-row checkboxes, duplicates pre-deselected, invalid rows; nothing is written before confirmation; each import is one undoable batch (`_imports`, ids `imp-<batch>-<n>`). Source: architecture.md "Start data"; commit 14205c5.
- **One import format per collection derived from its Zod schema** (no second hand-kept schema); `scope.ts` is the single filter. Source: commit 4d8b3f1; architecture.md "Data contract".
- **Local AI import API: desktop only, off by default, loopback-only, transport in Rust, meaning in TypeScript.** No bind-address setting, no CORS, Host/Origin checks, hashed tokens with per-module rights, nothing logged. API imports wait as pending batches for user confirmation; changes to existing entries are never pre-ticked or auto-committed; no delete endpoint. Source: commits 4a0b230, 0944e68; architecture.md.
- **MCP wrapper is a thin separate project with no data access, not shipped in release downloads.** Token only sent to 127.0.0.1/localhost, no redirects. Source: commit c4e9b30.

## Connectors & network
- **User brings their own Google OAuth client (Desktop app type); nothing shipped in repo/binary.** OAuth via PKCE + loopback listener; Google login not on Android yet. Source: architecture.md "Connectors"; CLAUDE.md.
- **Gmail scan reads only metadata + snippet, never the body; user confirms each suggestion.** Source: architecture.md.
- **Sync-server proxy `/v1/proxy` is deliberately narrow (SSRF hardening)** – needed by the PWA for ICS/RSS; native app fetches directly. Source: commit 7e93948; architecture.md.
- **Spotify connector not built** (docs unreachable, API constraints); launcher preset opens the web player. Source: architecture.md step 6.

## Disk module & platform-only modules
- **Modules can declare `platforms`; the filter is `availableManifests()`, resolved lazily.** Module states are synced, so a desktop-only module must vanish from router, nav, dashboard and services on the other platforms, not only from the library. The platform is known only after `initPlatform()`; importing it in the registry would create a cycle through the DB, hence `core/modules/available.ts`. Source: PR #8 (2026-09-30).
- **Own recursive scan with `read_dir` + `rayon`, not `jwalk`/`walkdir`.** Folder sums come straight from the recursion (jwalk yields flat entries and would need a rebuild), cancel is per folder, errors are collected per folder, no hidden-file skipping by default. `walkdir` is single-threaded. Source: PR #8 (2026-09-30).
- **Size = space on the volume (rounded to clusters), file size shown next to it; cloud-only files count 0.** The tool answers "what eats my space". `GetCompressedFileSizeW` per file would be too slow. Source: PR #8 (2026-09-30).
- **Scan tree stays in Rust; the webview gets views by node id.** Keeps IPC small for millions of files and means a compromised webview cannot name arbitrary paths to delete. Source: PR #8 (2026-09-30).
- **Recycle bin through `IFileOperation` with an abort sink instead of the `trash` crate.** `trash` runs with `FOF_NO_UI` (includes no-confirmation) so an item the bin cannot take is deleted silently. Here `PreDeleteItem` without `TSF_DELETE_RECYCLE_IF_POSSIBLE` returns `E_ABORT`; the report offers a separate, deliberate "permanent" step. Source: `trash` 5.2.9 source; PR #8 (2026-09-30).
- **Block list checked in Rust on resolved paths, twice (plan and run), text-based rules.** Deleting takes node ids, never paths; the resolved path must equal the planned one (link swap after the scan is refused). Source: PR #8 (2026-09-30).
- **Typed confirmation is enforced in Rust** (name for one entry, `LÖSCHEN` for several) for permanent or large (> 10 GiB / > 10 000 files) deletions. Source: PR #8 (2026-09-30).
- **Per-command Tauri permissions (`AppManifest::commands`) granted on desktop only.** Before, every app command was open to the webview. Source: PR #8 (2026-09-30).
- **Scan results are never persisted, synced, backed up or given to the assistant/local API** (no collections, no `aiSchema`, `dataApi: false` + id block). Optional scan cache and MFT quick scan (admin) are ideas only. Source: PR #8 (2026-09-30).
- **`pdf-lib` 1.17.1 pinned, loaded only when the PDF tool opens.** Last release (unmaintained, MIT); the alternative is a WASM PDF engine (much bigger). Source: PR #8 (2026-09-30).
- **Pantry → shopping list through the event `shopping.requested`**; the shopping module subscribes while enabled (no module import). Source: PR #8 (2026-09-30).

## Setup assistant
- **Manual start, never forced.** Fresh empty app: a discreet welcome card ("Später" = `dismissed` for good). Existing installations: the start migration sets `dismissed` + hidden checklist, the assistant stays available in the settings. Why: no surprise for users with data. Source: task brief; `core/setup/detect.ts`.
- **Progress is device-local (`_meta` `setup.state`), holds step ids only.** Not synced, not in backups, no values/secrets (strict Zod schema, tested). Why: setup differs per device (notifications, keystore), and secrets must never leak through it.
- **Each step saves on its own "Weiter"; cancelling drops only the current draft.** No end-of-run commit, so an abort never applies half a setup. Vault is created only with a confirmed password on "Weiter".
- **Steps are contributed via `setupSteps` on module/tool/connector manifests** (`core/setup/types.ts`); ids carry the owner's id as prefix. Why: new modules extend the assistant without special cases. The vault step lives in `modules/accounts` and carries no data (exclusion test).
- **Reuse instead of rebuild:** sync/backup/connector steps embed the settings sections/cards; start data opens the existing wizard; AI keys go through `setProviderKey` (secret store), test result shows only the mapped reason.
- **Profiles set the target state, including switching modules off, but only after a visible diff and an explicit confirmation; always `keep` data.** `ModuleManifest.requires` (invoices, budgets → finance) only informs/auto-adds, never blocks.
- **`connectOAuth` takes an `AbortSignal`:** an abandoned login stores no token and writes no status (the loopback listener times out by itself). The connector card aborts on unmount.
- **First weekday is a synced setting (scope `core`, `useWeekStart`).** Currency/format/language/time zone are shown as info only (fixed: EUR, de-DE, local wall clock). AI week ranges still use Monday.
