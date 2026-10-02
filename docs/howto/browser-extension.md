# Browser extension (Brave) and vault bridge

Threat model: [../security/VAULT-EXTENSION.md](../security/VAULT-EXTENSION.md). Commands run in `extension/` unless stated.

## Build and test
- `cd extension && npm ci`; `npm run format:check && npm run lint && npm run typecheck && npm test`.
- `npm run build` → `dist/` (release flavour, closed shadow root); `npm run build:e2e` → `dist-e2e/` (open shadow root so Playwright can reach the overlay); `npm run zip` → `nemo-extension-<version>.zip` (reproducible, no dependency).
- E2E: `npm run e2e` loads `dist-e2e` into Chromium (`/opt/pw-browsers/chromium`), serves the real web app (e2e build, :4173, started by the config) as "the desktop app" and relays the native host over HTTP into `window.__tmVaultBridge`. Stop any own `vite preview` first.
- Shared code: `packages/vault-core` (generator, origin matching, protocol); web and extension alias it (`@nemo/vault-core`) and resolve `zod` / `tldts` from their own `node_modules`.

## Load in Brave and connect (users: [../user/browser-erweiterung.md](../user/browser-erweiterung.md))
1. Download `nemo-extension-<version>.zip` (CI artifact `nemo-extension`), unpack. `brave://extensions` → developer mode → "Load unpacked" → the unpacked folder. The id must read `olgcnfjmihlmpgjepkfbdjcpenckemaj` (fixed by `key` in `extension/manifest.json`).
2. In the desktop app: Tresor → "Browser-Erweiterung" → switch on. This writes the host manifest (`<data>/native-messaging/io.github.sgnemo.taschenmesser.vault.json`) and HKCU entries for Brave, Chrome, Edge, Chromium (Brave does not read Chrome's key) and starts the pipe.
3. Click the extension icon: it shows a 6-digit code; confirm it in the app dialog "Erweiterung verbinden?" (same code). Done once per id.

## Flows
- **Sign-up:** focus the password field of a registration form → overlay with a generated password (strength, re-roll, settings, passphrase) → "Verwenden" fills all password fields of the form and opens the save card (name, user name/e-mail, site) → "Im Tresor speichern". Locked/not running: the data stays in memory (tab, 5 min); "Erneut versuchen" after unlocking.
- **Submitted form:** unknown login → "Diesen Login im Tresor speichern?"; known user with another password → "Passwort aktualisieren?". Only after a click.
- **Login:** key button in the field (or popup → Ausfüllen) lists entries of the site; a click fills user name and password; TOTP into a one-time-code field or copy from the popup (cleared after 30 s).
- Settings (vault settings): which sites count as matching (same domain / exact host), generator length and classes for new passwords.

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| "Nemo wurde nicht gefunden" | App not running, bridge switched off, or the other Nemo instance owns the pipe. Start the app, switch "Browser-Erweiterung" on. |
| Works in Chrome, not Brave | Brave reads only its own registry key; switching the bridge off and on rewrites all four. |
| Portable folder moved / exe replaced | The registered path is stale: the app repairs it at start when the bridge is on; or press "Neu eintragen" in the dialog. |
| Popup says "nicht zugelassen" | The extension id differs from the allowlisted one (loaded from a different folder without the manifest `key`, or a store build). |
| Nothing appears on a page | Form not recognised (multi-step login, closed shadow root, no submit event), `data-nemo-ignore`, or the page is `chrome://`. Brave Shields do not block the content script; if a site breaks, test with Shields off and report. |

## Native host registration (developer)
`crates/vault-bridge`: `manifest.rs` (host manifest, registry keys), `registry.rs` (Windows), `host.rs` (stdio relay), `ipc.rs` (pipe/socket), `server.rs` (app side). The executable runs as host when its first argument starts with `chrome-extension://` (`web/src-tauri/src/main.rs`, `vault_host.rs`) – no window, no Tauri. New command → `build.rs` `COMMANDS` + `capabilities/desktop.json`.

## Release zip (proposal, not wired)
`release.yml` is untouched. To ship the zip: add a job that runs `npm ci && npm run build && npm run zip` in `extension/`, add `Nemo-Extension.zip` to `web/scripts/lib/releaseAssets.ts` and the workflow, run it through `audit-release.mjs --path`, add the job to `needs` of `release` and `summary`. Store publication (Chrome Web Store, Edge add-ons) would assign its own id: the host allowlist would then need that id too.
