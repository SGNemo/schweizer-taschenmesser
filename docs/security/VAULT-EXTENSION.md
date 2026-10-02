# Threat model – browser extension and vault bridge

Scope: the Brave/Chromium extension (`extension/`), the native messaging host (a mode of the Nemo executable), the per-user pipe (`web/src-tauri/crates/vault-bridge`) and the app-side handler (`web/src/modules/accounts/bridge`). The app is the **only** source of data: the extension has no vault, no storage, no sync. Decisions: [../decisions/features.md](../decisions/features.md).

## Assets
Vault entries (passwords, TOTP secrets), the master password / keys (never leave the app), the user's attention (fill and save need a click).

## Data flow
`page` → content script (closed shadow DOM) → service worker → `connectNative` → host (stdio, origin stamped from the browser's argument) → named pipe (current user only) → Rust server → Tauri channel → TypeScript handler (`createBridgeHandler`) → vault (`saveEntry` / `decryptAll`) → normal storage and sync → phone.

## Threats and countermeasures
| Threat | Countermeasure | Where |
|---|---|---|
| Phishing: look-alike domain, IDN homograph, subdomain trick | Origin match on both sides: WHATWG parsing (punycode), registrable domain via the public suffix list (private suffixes such as `github.io` count as suffixes), scheme and port must match; setting "same domain" or "exact host". Never fills for another origin. | `packages/vault-core/src/origin.ts`, `bridge/handler.ts`, `lib/background.ts` |
| A page tells the extension its origin | The origin is never part of a message: the service worker takes it from the browser's `sender`; the host stamps the extension origin from its argument and overwrites any claimed one. | `lib/messages.ts`, `crates/vault-bridge/src/host.rs` |
| Page script reads the overlay or the password | Closed shadow root in the release build; fill only into the detected password fields of the form; the stored password never travels back to a page script (the save card works on title and user name only). | `content/ui.ts`, `lib/background.ts` |
| Silent fill or silent save | Fill, copy and save happen only after a click in the overlay or popup; nothing on page load or focus. Tested in E2E. | `content/main.ts`, `e2e/extension.spec.ts` |
| Fill into a foreign iframe | The origin of the sending frame is used, so an iframe only ever gets entries of its own origin; the popup fills the top frame only. | `lib/background.ts` |
| Foreign extension or process uses the bridge | `allowed_origins` holds only the fixed extension id; the app serves only that id, and only after the user confirmed it (6-digit code shown in app and popup). The pipe accepts the current user only (explicit DACL, remote clients rejected, first-instance flag against name squatting). | `manifest.rs`, `ipc.rs`, `handler.ts` |
| Replay or injected messages | `uuid` per request (never accepted twice), session id from `hello`, strictly increasing `seq`, strict Zod schemas (unknown fields rejected), 64 KB cap checked before allocating. | `protocol.ts`, `handler.ts`, `frame.rs` |
| Bulk extraction | No "list all" operation exists; `match` returns title, user name, URL and id only; `secret` returns one field of one entry that matches the page origin; 30 secrets per minute and session. | `protocol.ts`, `handler.ts` |
| Lock while the extension holds data | Locking (manual, auto-lock, background) ends every session and any open pairing; requests after the lock get `locked` and no data. The extension keeps pending saves only in memory (per tab, 5 minutes, dropped when the tab closes). | `service.ts`, `handler.ts`, `lib/background.ts` |
| Secrets at rest in the extension | No `chrome.storage`, `localStorage`, `sessionStorage`, IndexedDB (ESLint rule, no `storage` permission, E2E asserts empty stores). | `eslint.config.js`, `manifest.json` |
| Clipboard | Copy goes through an offscreen document and is cleared after 30 s, but only if the clipboard still holds that value. | `lib/clipboard.ts` |
| Leaks through errors and logs | Replies and failures carry codes only; nothing is logged (extension, host, server, handler). | all |
| The extension on Nemo's own pages | `data-nemo-ignore` on `<body>` of the web app: the master password is never seen. | `web/index.html`, `lib/forms.ts` |
| Weak randomness | `crypto.getRandomValues` only (rejection sampling); `Math.random` is a lint error in the extension and tested as unused. | `packages/vault-core/src/random.ts` |

## Deliberately not covered
- **Malware running as the same Windows user:** it can read process memory, start the executable with the extension origin and talk to the pipe, or drive the browser. The pipe stops other users, not the same one.
- **A hostile second local user** who creates the pipe name before Nemo starts: Nemo detects this (first-instance flag) and refuses to listen, but cannot stop the host from connecting to a squatter before that.
- **A compromised browser or extension process** (it can read everything the extension can).
- **Phishing pages that the user fills by hand,** and look-alike entries the user saved for a wrong site.
- **Pages that keep their fields in a closed shadow root,** multi-step logins (e-mail page, then password page), and forms submitted without a `submit` event are not recognised (no false fill, just no offer).
- **Brave Shields** are not circumvented: content scripts run in an isolated world and are not affected by script blocking; fingerprinting protection does not touch them. Needs a check on real hardware.
- **Firefox / Safari:** not built.

## Residual risks and notes
- `clipboardRead` is requested to compare before clearing; browsers show it as a permission warning.
- The Windows-only parts (registry entries, pipe DACL, GUI-subsystem executable as host) compile on Linux and are verified only by hand: [../MANUAL-TESTS.md](../MANUAL-TESTS.md).
