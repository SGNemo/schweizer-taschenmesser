# Browser extension and vault bridge – map

Threat model: [../security/VAULT-EXTENSION.md](../security/VAULT-EXTENSION.md); recipes: [../howto/browser-extension.md](../howto/browser-extension.md); decisions: [../decisions/features.md](../decisions/features.md).

## Where things live
- `extension/` (own project, MV3: `src/background.ts` → `lib/background.ts` logic, `lib/bridgeClient.ts`, `lib/forms.ts` heuristic, `content/` overlay, `popup/`, `offscreen/`, `e2e/` with a test host); shared `packages/vault-core/` (generator, `origin.ts`, `protocol.ts`, aliased as `@nemo/vault-core`); native side `web/src-tauri/crates/vault-bridge/` (`frame`, `host`, `ipc`, `server`, `manifest`, `registry`), Tauri wiring `src/vault_bridge.rs` + host mode `src/vault_host.rs` (called from `main.rs`); app side `web/src/modules/accounts/bridge/{handler,control,pairing}.ts`, `components/BridgeDialog.tsx`, config `core/vaultbridge/config.ts`, seam `core/platform/{types,tauri/vaultBridge,fakeVaultBridge}.ts`. Threat model: [security/VAULT-EXTENSION.md](../security/VAULT-EXTENSION.md).

## Browser extension (data flow)
1. Page field focus → content script (`forms.ts` scores the form) → overlay; the user clicks.
2. Content script → service worker (`messages.ts`, origin from the browser sender) → `bridgeClient` → `connectNative` → host (the Nemo exe with the extension origin as first argument; stamps `origin`) → per-user pipe → `server.rs` → Tauri channel → `handler.ts`.
3. Handler: allowlisted id + pairing → session (`seq`, replay guard) → origin match → `decryptAll` / `saveEntry` (normal repo, outbox, sync) → phone.
4. Locking ends every session (`service.ts` watches `useSession`); the extension keeps only per-tab pending saves in memory.
