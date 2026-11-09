# feat/lan-second-pc – for the next chat:

- A second PC pairs as a client of the hub PC: `lan_client_*` now on desktop too (shared handler in `src-tauri/src/lib.rs`, grant in `capabilities/default.json`; `mobile.json` deleted). Keys via secure-store `lan-client:` (desktop = keyring / Credential Manager).
- One path per device is checked twice: `enableLanHub`/`lan_hub_start` → `client-paired`; `pairWithPc`/`lan_client_pair` → `hub-on`.
- Pairing flow lives in `web/src/pages/settings/usePairWithPc.tsx` (shared by `LanClientSection` and the "Mit einem anderen PC koppeln" link in `LanHubSection`). On desktop, `SyncSection` shows `LanClientSection` once `via === 'lanClient'`.
- Not built (optional in the brief): mDNS re-discovery of a hub that moved (desktop has `crates/lan-sync/src/discovery.rs`, mdns-sd). Today a moved hub IP = "Gleicht ab, sobald dein PC …" until re-paired. Good next small package.
- Unverified: WebView2 webcam permission prompt in the real exe (MANUAL-TESTS L16). If WebView2 denies silently, `camera-denied` shows the Windows camera settings line.
