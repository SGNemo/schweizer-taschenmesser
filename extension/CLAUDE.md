# extension/ – Nemo browser extension (Brave/Chromium, MV3)

No vault, no storage: the desktop app is the only source (native messaging → `web/src-tauri/crates/vault-bridge`). Recipe: [docs/howto/browser-extension.md](../docs/howto/browser-extension.md); threat model: [docs/security/VAULT-EXTENSION.md](../docs/security/VAULT-EXTENSION.md).

- **Checks:** `npm run format:check && npm run lint && npm run typecheck && npm test`; `npm run build:e2e` then `npm run e2e` (needs `web/` installed, stop own `vite preview`).
- **Never:** `chrome.storage`, `localStorage`/`sessionStorage`, `Math.random`, logging of messages/URLs/user names, a page origin taken from a message, fill/copy/save without a click, a "list all entries" message. ESLint enforces the first three.
- Texts German in `src/strings.ts`; shared code via `@nemo/vault-core` (`packages/vault-core`); the content script stays free of schema libraries (size).
- The extension id comes from `key` in `manifest.json`; changing it means changing `EXTENSION_ID` (vault-core) and `manifest.rs` (host allowlist) in the same commit.
