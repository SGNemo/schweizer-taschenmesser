# Decisions in full – features – browser extension and vault bridge

Part of [features](features.md). Index of areas: [DECISIONS](../DECISIONS.md).

## Browser extension & vault bridge (2026-10)
- **App as the only source.** Entries are read and written only through the app's vault (`decryptAll`, `saveEntry` → normal repo/outbox), so sync brings extension-created entries to the phone without a special path. The extension keeps in memory only the bridge session and per-tab pending saves (5 min, dropped on tab close); no `chrome.storage`, no web storage.
- **Native messaging instead of loopback.** The local import API (`crates/local-api`) rejects every request with an `Origin` header and has no CORS; extension fetches carry one. Opening a vault endpoint there would mean weakening a security rule. Native messaging gives a fixed allowlist (`allowed_origins`), a per-user pipe and no open port.
- **Host as a mode of the portable exe.** One signed file, no second artifact for audit/update; `main.rs` runs the relay before Tauri starts when the first argument is the extension origin. A moved portable folder only means re-registering the path (done at start when the bridge is on). A separate small binary was rejected (second signed artifact, easy to forget when moving the folder). Unverified on hardware: GUI-subsystem exe as host (stdio handles).
- **Lockstep protocol, no push.** A synchronous Windows pipe handle serialises read and write, so every connection is request/response; the extension polls `status` while it holds data. Session id + strictly increasing `seq` + unique request id; strict Zod schemas on both sides.
- **Brave first (Chromium MV3); Chrome, Edge and Chromium registered too, Firefox only a written proposal.** Brave reads only its own registry key, so the native-messaging host is written under all four keys.
- **Extension zip is a CI artifact only; release integration is a written proposal** – `release.yml` stays untouched until the maintainer decides.
- **Pairing.** First contact: the app shows the extension id and a 6-digit code, the popup shows the same code; confirming stores the id device-locally in `_meta` (not synced, not in backups). No key material in the extension.
- **One pipe name per user, shared by Dev-Preview and release:** the browser registers only one host; the second app to start fails to bind ("belegt") instead of stealing the channel.
- **Origin matching in `packages/vault-core`** (`tldts`, private suffixes count): used by the app handler and the extension; scheme/port always strict.
- **Form detection is a score**, not a rule: `autocomplete=new-password` +5, two password fields +5, sign-up button/heading text +5, terms checkbox +1; current-password −4, login text −4, "forgot password" link −3; ≥ 5 = registration. Links are ignored for the text signals ("Already have an account? Log in"), provider buttons ("Sign in with Google") too. Limits in [../security/VAULT-EXTENSION.md](../security/VAULT-EXTENSION.md).
- **`data-nemo-ignore`** opts a field/form/page out; the web app sets it on `<body>` so the extension never sees the vault's master password.
- **Strength in the extension = generator entropy** (the value is random, not user-chosen); the app keeps zxcvbn for user-chosen passwords.
- **Clipboard:** copy in an offscreen document, clear after 30 s only if unchanged (needs `clipboardRead`).
