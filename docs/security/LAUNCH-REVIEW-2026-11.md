# Launch security review 2 (2026-11-21)

Reviewed commit: `develop` at `7ef17176` (merge of #1033). Baseline of the previous review: `d48a4fe` ([LAUNCH-REVIEW-2026-10-06.md](LAUNCH-REVIEW-2026-10-06.md)); since then 5 972 files changed, 174 Tauri commands (103 new), ten new native crates. Method: one read-only reviewer per area in parallel; every finding from **medium** up was re-read line by line by the lead before it went into this report. Nothing was tested against a foreign host; Windows- and Android-only code was read and (three crates) checked for the Windows target, not run. Ratings as before: **critical / high / medium / low / info**.

Threat model: attacker with the device (locked/unlocked), with the sync server, in the same Wi-Fi/LAN, with a paired or formerly paired device, a malicious website (extension, import API, browser module), a malicious file (backup, import, feed, mail HTML, received file, torrent, download), a malicious supporter code, a compromised release, a second local Windows user.

Follow-ups: prompts for everything not fixed here in [LAUNCH-REVIEW-2026-11-PACKAGES.md](LAUNCH-REVIEW-2026-11-PACKAGES.md); hand tests `SEC-…` in [../MANUAL-TESTS.md](../MANUAL-TESTS.md).

## Verdict per channel

Rule: an open critical or high finding in a channel = **no**; medium = condition (fix before the release, or the maintainer accepts it with a reason); low/info = list. The recommendation for each medium: **fix, do not accept** – R1, SC2, SC3, DL3, X2, S5 (in the apps), AI1; **accept for 1.0** – S13, V5, X4, S5 in the PWA; DL1 and DL2 – fix, or accept once the DL10 point of package 3 is merged. The decision stays with the maintainer.

| Channel | Verdict | Open findings that decide it | Way to "yes" |
|---|---|---|---|
| Windows exe | **no** | high: SC1. Medium: SC3, R1, DL1–DL3, X2, S5, AI1, V5; PC1, M1, D6 (fixed, to merge) | 1. Close SC1. 2. Merge the three fix PRs. 3. Packages 2 (R1), 1 (SC3) and 3 (DL1–DL3; DL1 and DL2 can be accepted instead only once the DL10 point of package 3 is in, because until then another device can switch torrent on). 4. X2, S5, AI1: fix (packages 5–7) or accept in writing. V5: recommendation accept |
| Android APK | **no** | high: SC1. Medium: SC2, SC3, S13, S5, AI1, V5; D6 (fixed, to merge). R1 is a PC finding; on the phone the reset leaves the pairing entries (list under R1–R3) | 1. Close SC1. 2. Merge the fix PRs. 3. Package 1 (SC2, SC3); package 2 also clears the phone side. 4. S13 and V5: recommendation accept; S5, AI1: fix or accept in writing |
| PWA | **yes with conditions** | medium: S5, AI1, V5; D6 (fixed, to merge) | S5: accept with the documented reason (in the browser IndexedDB stays the only store; package 6 changes the apps, not the PWA). AI1: package 7 (recommendation) or accept in writing. V5: accept. Merge the texts PR. Lows: R6 (no CSP for the self-hosted PWA), Q2 |
| Sync server | **yes** | none from medium up. Lows: N9, R8 | list only: say in the server doc how to publish on `127.0.0.1` behind a tunnel (package 10) |
| Browser extension | **yes with conditions** | medium: X2, X4 (open since October) | package 5, or accept both as documented limits in VAULT-EXTENSION.md (recommendation: fix X2, accept X4) |
| Website | **no** | high: SC1. Medium: D6, D8 (fixed, to merge) | 1. close SC1. 2. Merge the privacy-texts PR. Not security: legal placeholders in [../legal/LAUNCH-LEGAL-CHECKLIST.md](../legal/LAUNCH-LEGAL-CHECKLIST.md) (3 done, 14 open) |

SC1 has one closing condition everywhere in these documents: **every step of the private note is done**. It decides the Windows exe, the Android APK and the website. PWA and sync server are built by the user from the repository; the extension has no release channel yet (open decision 4 in CHATS.md) – if it ships as a release file it inherits SC1. For every channel the same sentence holds: each medium listed in its row is either merged as a fix or accepted in writing in the release issue (recommendations: see the rule above). Order of work after SC1: merge the three fix PRs, then package 2 (R1), package 1 (SC2, SC3), package 3 (DL1–DL3, DL10), then packages 5–7.

No critical finding. One high finding (SC1). The Dev-Preview that friends already run is affected by every finding below that is not marked "preview module". None of the findings described in this document works without a user action, a paired device, script execution inside the app or presence in the same network (H1, H2, H10: denial of service and fingerprinting only).

### Blockers, in the order of work

1. **SC1** – release pipeline, high. Details and steps are not in this repository (public repo, no fix in this PR): they were handed to the maintainer privately. Until it is closed: no release.
2. **PC1, M1, D6, D8** – fixed in the three fix PRs of this review (below); they only need a merge.
3. **R1** – "Alle Daten löschen" leaves the home-network hub running and trusted (medium, package 2) – **fixed (#1046)**.
4. **SC2, SC3** – dev and production APK share one keystore; dry runs see production keys (medium, hard-limit area, package 1; the parked draft PR #542 touches the same secrets) – **fixed (#1050)**; SC3 residual (secrets on the runner of a dry-run job) stays with #542.
5. **DL1–DL3** – torrent overwrites existing files, peer listener outlives the module, no Mark-of-the-Web (medium, package 3, with DL10) – **fixed (#1047)**.
6. **X2, X4, S5, S13, AI1, V5** – known or residual mediums: decide fix or accept (packages 4–7, V5 in package 10; recommendation: accept S13, V5 and X4, fix X2, S5 in the apps and AI1).

### Fixed in this review (three PRs, each with a test that was red before)

| PR branch | Findings | Test |
|---|---|---|
| `fix/security-web-inputs` | M1 mail images only from public https hosts (home-router names included), every redirect judged again; M3 attachment name; M4 feed link scheme; R4 push link stays in the app; R7 diagnostics scrubber | `core/mail/sanitize.test.ts`, `core/mail/fileName.test.ts`, `core/net/publicUrl.test.ts`, `core/platform/tauri/redirect.test.ts`, `feeds.page.test.tsx`, `pushPayload.test.ts`, `core/diagnostics/scrub.test.ts` |
| `fix/security-windows-spawn` | PC1 system tools by full path | `tests/commands.rs` `no_program_is_started_by_bare_name` + Windows unit tests |
| `fix/security-privacy-texts` | D6, D8 (list completed; the claim "every connection" is gone on the page, its heading and the start-page link; the page points to the in-app list), D10, D12, D14, D16, D17, D18, D19, D20, D7 | `core/legal/legal.test.ts` |

## Findings

"Who": **chat** = a normal package; **Sven merges** = inside a hard-limit area (signing, secrets, gitleaks, artifact audit, `release.yml`, sync encryption, crypto, vault logic, `guard.rs`) or GitHub settings. "Accept" means the recommendation is to accept the finding for 1.0 in writing. Paths are relative to `web/src-tauri/` for Rust and `web/src/` for TypeScript unless they start with another top-level folder.

### Medium and above

| ID | Sev | Area | Finding (attacker → effect) | Evidence | Fix size | Who |
|---|---|---|---|---|---|---|
| SC1 | high | release pipeline | Details private | private note | private note | Sven |
| SC2 | medium | pipeline | Dev-Preview and release sign the APK with the same keystore (old P2, APK half; old P3 residual). The dev pipeline therefore handles the production APK key | `.github/workflows/dev-preview.yml:413-416`, `.github/workflows/release.yml:382-385` | M (re-keys the dev app) | **fixed (#1050)**; Sven creates `ANDROID_DEV_*` before merging |
| SC3 | medium | pipeline | Dry runs on `develop` put the production updater key into the audit step's environment and sign the dry-run APK whenever the key exists. Code merged to `develop` → repo scripts run next to production keys | `.github/workflows/release.yml:295-304,379-385,406-415` | S | **fixed (#1050)** for steps; residual: a job that references a secret can still receive it on the runner, closed only by separate signing jobs (#542) |
| R1 | medium | reset / LAN sync | "Alle Daten löschen" runs only in the web layer: no native call. The hub keeps listening until the app quits; trust list, remote and exchange grants, `hub.db` and both keyring slots stay. A paired phone keeps pulling the full data set; once home-network sync is switched on again the old devices are trusted again and the wiped PC is re-seeded; whoever gets the PC (same Windows account) finds `hub.db` plus the data key | `web/src/core/reset/device.ts:84-110` (no platform call besides secrets/biometrics), `src/lan_sync.rs:348-406,511`, `src/remote.rs:238-242`, `src/exchange.rs:99-134` | M | **fixed (#1046)**; Sven merges (deletes LAN key storage) |
| DL1 | medium | torrent | `overwrite: true`; a single-file torrent is written straight into the chosen folder. Malicious torrent + a same-named file → the user's file is overwritten. The HTTP downloader never overwrites | `crates/torrent/src/engine.rs:209-214,226` | S | **fixed (#1047)** |
| DL2 | medium | torrent | The peer listener binds `0.0.0.0` (random port) and, once started, keeps running with DHT and seeding after leaving the page, switching the module off or closing to tray; no "home network only" or metered rule. Inherent to torrent while it is on; the finding is that "off" does not stop it | `crates/torrent/src/engine.rs:101-104`, `src/torrent.rs:118-126`, `modules/downloads/routes/TorrentSection.tsx:136-141` (only caller of `stop`) | M | **fixed (#1047)** |
| DL3 | medium | downloads | No Mark-of-the-Web on files from the HTTP downloader or torrents, so SmartScreen and Office Protected View do not trigger as for a browser download | no `Zone.Identifier` writer in `web/src-tauri` (only a name test in `crates/lan-sync/src/exchange/name.rs:309`); `crates/downloader/src/worker.rs:289` | S–M | **fixed (#1047)** |
| PC1 | medium | Windows shell | `reg`, `taskmgr.exe`, `explorer.exe` started by bare name: Windows looks next to the app's exe first. Portable exe in Downloads + a downloaded file of that name → runs without SmartScreen when the torrent section opens (`association_status`), on "reveal" or "open Task Manager" | `crates/os-association/src/lib.rs:149`, `src/system.rs:87`, `crates/disk-scan/src/system.rs:205`; `crates/pc-tune/src/tools.rs:60-66` already did it right | S | **fixed** (`fix/security-windows-spawn`) |
| M1 | medium | mail (preview module) | "Bilder laden" (or `images: 'always'`) fetched up to 20 sender-chosen URLs with the raw platform fetch: `http:` allowed, no public-host rule → blind GETs to router/IoT/loopback; body read whole before the size check | `core/mail/sanitize.ts:220-251` (body read at `:238-239` before the size test), `modules/mail/components/MailFrame.tsx:47-67` | S | **fixed** (`fix/security-web-inputs`) |
| D6 | medium | privacy texts (in every app and on the website) | In-app notices, DATA-FLOWS and both website privacy pages said Gmail "headers only / never the content / read only"; the Mail module reads whole messages and attachments, caches bodies and, with opt-in scopes, modifies and sends | code `connectors/google/gmail.ts:261,271,288,296,312,329-344`, `connectors/google/index.ts:58-82`; texts `strings.legal.ts:74,174,324,424`, `docs/legal/DATA-FLOWS.md:16`, `site/src/pages/datenschutz.astro:55`, `site/src/pages/en/privacy.astro:53` | docs | **fixed** (`fix/security-privacy-texts`) |
| D8 | medium | privacy texts (website, user docs, README) | The website page that says "every connection Nemo makes", the user doc and the README list left out maps hosts, the built-in browser and its search engine, downloads, torrent, web push, home-network sync and Spotify's image servers; the start page said entries leave the device only by sync to the own server or an AI question | `site/src/i18n/de.ts:113,128-137,179`, `site/src/i18n/en.ts:107,120-128,169`, `docs/user/security.md:16-24`, `README.md:173-174`; code see network inventory | docs | **fixed** (same PR) |
| AI1 | medium | AI router | The October fix stops fallback inside one call. After a provider error (cooldown) the **next** message or "try again" goes to provider 2 with the whole conversation, including data attached earlier – possibly a "may train" free tier; the UI promises "your configured provider" | `core/ai/router.ts:105-121,148`, pinned as intended in `core/ai/router.test.ts:152`; `modules/chat/engine.ts:98-105`; `strings.ts:7650,7688` | S/M | **fixed (#1059)**: a chat stays with its provider; paused → calm message + "Anderen Anbieter wählen" |
| X2 | medium | vault bridge | Open since October: the first-instance flag is set, but it is used up by the first failed attempt (`first.swap(false)`), and the server loop retries every 100 ms without it – so when another process already holds the pipe name, Nemo ends up serving beside it instead of stopping | `crates/vault-bridge/src/ipc.rs:218-226,247-248,263-265`, `crates/vault-bridge/src/server.rs:107-114` | M | **fixed (#1054)** |
| X4 | medium | extension | Open since October: overlay host can be hidden or covered by the page (same-site UI redress) | `extension/src/content/ui.ts:21-32` | M | **accepted for 1.0 by Sven** (documented in VAULT-EXTENSION.md) |
| S5 | medium | sync | Open since September: the sync token lives in IndexedDB `_secrets.syncConfig`, not in the OS secret store (the service worker reads only the key from that record) | `core/sync/service.ts:120,131,144`, `sw.ts:55-68` | M | **fixed in the apps (#1057)**; PWA: IndexedDB stays the store (accepted, reason in `core/sync/names.ts`) |
| S13 | medium | Android update | Open: the expected APK digest is the unsigned `.sha256` asset of the same release; authenticity rests on GitHub + TLS and Android's same-certificate check. Recommendation: **accept** for 1.0 (the OS refuses an APK signed with another key), revisit with package 4 | `core/update/github.ts:18-28,113`, `core/platform/tauri/updater.ts:106-128` | M | Sven merges |
| V5 | medium (residual) | backup | Envelope types and the 64 MB cap are checked; the data part is still not validated against the collection schema, and `pages/settings/BackupSection.tsx:65` reads the file before the cap. Recommendation: accept for 1.0 (own file, preview, safety copy) | `core/backup/backup.ts:16-31,100,124-126` | M | accept (or package 10) |

### Low and info, by area

**Home-network sync (B1).** The sentences of the LAN-sync rule hold in code (not run on a device: SEC-3), with four caveats: H4, H6, H10, and the home-network change is confirmed by the web app only (`src/lan_sync.rs:712`).

| ID | Sev | Finding | Evidence | Size |
|---|---|---|---|---|
| H1 | low | Connection slots (32, 4 per address) are taken at accept, the rate limit counts only complete first messages; a replayed first message of a paired phone idles 120 s. About 8 addresses in the subnet block sync for everyone | `crates/lan-sync/src/transport/mod.rs:51-55,311,504`, `crates/lan-sync/src/endpoint.rs:158`, `hub/router.rs:112` | S |
| H2 | low | "Wi-Fi only" is a label: each sync round while the app is open dials the pinned private `ip:port` on every network, and when that fails the phone searches for the hub by mDNS (`_nemo-sync._tcp`) on whatever Wi-Fi it is on, at most every 30 s. Both are a stable fingerprint on foreign networks; no data, no identity (`IK`) | `src/lan_client.rs:43-47,205-209,234-250`, `core/sync/service.ts:365,416`, `pages/settings/LanClientSection.tsx:129` | S |
| H3 | low | Unpairing revokes and closes sessions (≤ 200 ms) but neither rotates the data key nor offers it; a lost device keeps the key for any ciphertext it later obtains. Rotation revokes nobody | `src/lan_sync.rs:650-670,674-697`, `crates/lan-sync/src/hub/handler.rs:157` | S–M, Sven merges (sync encryption) |
| H4 | low | The pairing window has no total lifetime (renewed every 2 s until cancel): hub listens on every "Private" network meanwhile | `crates/lan-sync/src/pairing/mod.rs:321,400,641`, `src/lan_sync.rs:283` | S |
| H5 | low | A failed write of `trust.json` keeps a revocation in memory only; the UI swallows the error; after a restart the device is trusted again | `crates/lan-sync/src/trust/file.rs:220-227`, `pages/settings/LanHubSection.tsx:112` | S |
| H6 | low | The confirmation on the PC is a click in the webview; the UI passes the code back itself, so the compare in `confirm` proves nothing. Not a native dialog, unlike remote-control grants | `src/lan_sync.rs:584-620`, `pages/settings/LanHubSection.tsx:436` | M |
| H10 | low | "Never `0.0.0.0`" holds for the hub's TCP listener, not for discovery: while the hub runs, the mDNS library keeps wildcard UDP sockets on `0.0.0.0:5353` and `[::]:5353` and has joined the multicast group on every interface. It only *receives* queries there; announcements go out on the bound addresses only. The crate's comment says so, the rule text does not | `crates/lan-sync/src/discovery.rs:7-13` | M (bind per interface) or reword the rule; Sven decides |
| H7–H9 | info | Hub public key is a presence oracle for a revoked device (documented); `lan_hub_start` returns the raw data key each round; first pairing stores the network of the first private default-route interface | `crates/lan-sync/src/discovery.rs:29,71`; `src/lan_sync.rs:437-450`; `src/lan_sync.rs:126,305` | – |

**Remote control (B2).** Every sentence of `docs/rules/remote-control.md` holds in code (not run on Windows: SEC-4, SEC-10): default off, widening only through a Rust ticket plus native dialog (`src/remote.rs:255-261,296-300`), locked PC drops input, power and programs (`crates/lan-sync/src/input/session.rs:339,364,386,415`, `src/remote_power.rs:202`), countdown native, programs by slot and epoch only, replay stopped by Noise nonces.

| ID | Sev | Finding | Evidence | Size |
|---|---|---|---|---|
| F1 | low | The native grant dialog sets no default button; if the OS default is "allow", one stray Enter grants. Not verified (needs Windows): SEC-10 | `src/remote.rs:837-855` | S |
| F2 | low | Grant and master-switch dialogs lack the same-hub check the notice and program dialogs have; an answer after a hub restart is written through the old store | `src/remote.rs:876-923,929-998` vs `:1033-1037,1107-1112` | S |
| F3 | low | The page's file scope is `$APPDATA/**`; the grant files are outside it only because Windows separates Local and Roaming. No test pins that (also NS7) | `capabilities/default.json:53-70`, `src/capture.rs:766-771` | S |
| F4–F7 | info | Program path checked once, UNC accepted; a mouse/keyboard grant reaches everything the user can (say so in the rule); a paired, not granted device learns OS and switch state; one controller slot | `src/remote_programs.rs:101-107`; `crates/lan-sync/src/input/session.rs:339-349,217-228` | – |

**Exchange phone ↔ PC (B3).** File transfer is **not live** at this commit: the shell builds the exchange without files (`src/exchange.rs:161`), only text and links travel. Consent, home-network rule, revocation and encryption hold.

| ID | Sev | Finding | Evidence | Size |
|---|---|---|---|---|
| E1 | low | Hub rate limit lives in memory; 16 KiB × 300/h × 30 days can grow the phone-to-PC table to gigabytes; the page loads all rows | `crates/lan-sync/src/exchange/control.rs:152,229`, `modules/exchange/routes/ExchangePage.tsx:263-270` | S |
| E2 | low | The phone has no rate limit against a malicious paired PC | `src/exchange_client.rs:168-176`, `src/exchange_store.rs:26,222` | S |
| E3 | low | Module off (sync while closed, safe mode) never reaches the native switch: the hub keeps accepting items | `modules/exchange/services.ts:256-262`, `core/modules/services.ts:27-41`, `src/exchange.rs:133-137,412-439` | S |
| E4 | low | Pausing a grant does not drop the outbox (the concept says it does) | `src/exchange.rs:198-203,354-378` | S |
| E5 | low | Peer-chosen device name in the native grant dialog (lookalike names, U+2028) | `src/exchange.rs:206-220` | S |
| E6–E9 | info | For the file packages: limit counts finished files only, name cleaning has no caller yet, no symlink/MotW/open code; bidi characters in text; items in plaintext files for up to 30 days | `crates/lan-sync/src/exchange/transfer.rs:123-152,222-225`, `name.rs:23-27` | with 2b-2 |

**Browser module (B4, preview, off by default).** No capability names a tab label or a remote origin (`tests/commands.rs:105-130`); scheme allow-list in Rust; pop-ups denied; downloads never saved by the webview; permission requests denied on Windows (read in code, not run: SEC-9); filter list bundled; no vault access. The module also exists on Android, where a page opens in a Chrome custom tab with only the address passed.

| ID | Sev | Finding | Evidence | Size |
|---|---|---|---|---|
| B1 | low | Unbounded `seen` set and event flood from a page can stall the main UI | `src/browser.rs:659-696`, `modules/browser/tabsStore.ts:128-155` | S |
| B2 | low | `http://tauri.localhost` / `ipc.localhost` are not denied as hosts; not verified at runtime (SEC-9) | `crates/browser-filter/src/policy.rs:16-22`, `src/browser.rs:224-260` | S |
| B3 | low | The tab starts loading before the request hook is installed; a failed hook leaves the tab unfiltered without a sign | `src/browser.rs:223,354-356`, `src/browser_win.rs:17-22,31` | S |
| B4, B5 | low | No permission handler off Windows (not shipped); private tabs have no own data folder | `src/browser_win.rs`, `src/browser.rs:331-332` | S |
| B6, B7 | info | Tauri's init script is present in every webview (comment says otherwise; `invoke` is rejected by the ACL); commands callable while the module is off | `src/browser.rs:1-3` | – |

**Downloads and torrent (B5; module stable, on by default on desktop, torrent part off).**

| ID | Sev | Finding | Evidence | Size |
|---|---|---|---|---|
| DL4 | low | No host rule and no redirect re-check: a confirmed download can be bounced to a LAN or loopback address (blind GET, body to a file) | `crates/downloader/src/manager.rs:205-208`, `worker.rs:91-96,106` | **fixed (#1047)**; M |
| DL5 | low | Tracker URLs from a magnet or torrent are contacted during the preview | `crates/torrent/src/engine.rs:66-75,141-157` | **fixed (#1047)**; M |
| DL6 | low | `downloads_add` / `torrent_add` take any existing absolute folder from the webview (script in the main webview → file into the Startup folder); `torrent_configure` bypasses the notice | `src/downloads.rs:113-125`, `src/torrent.rs:166-183` | **fixed (#1047)**; M |
| DL7 | low | No size cap, free-space check or read timeout; preview cache never evicted | `crates/downloader/src/worker.rs:92,141,253-258` | **partly fixed (#1047)**: read timeout, bounded preview cache; no size cap or free-space check; S |
| DL8 | low | Bidi overrides stay in names; reserved-name gaps (`CON .txt`, `COM¹`); torrent folder name unchecked | `crates/downloader/src/name.rs:37,57-61`, `crates/torrent/src/engine.rs:416-434` | **fixed (#1047)**; S |
| DL9 | low | `downloads.json` keeps full URLs (credentials, signed tokens); reloaded unchecked, so an edited file makes "remove + delete data" delete another path | `crates/downloader/src/manager.rs:113-125,223,292-295` | **fixed (#1047)**; S |
| DL10 | low | The Downloads settings live in the synced settings: another device with the data key, a merged backup, or the sync server when end-to-end encryption was switched off (the same holds for module switches, MOD2, and bookmark addresses, Q3) can switch the torrent part, DHT and UPnP on and set the default target folder. The peer listener then opens the next time the Downloads page is opened (after its notice, unless this PC acknowledged the notice before), and a pre-filled folder such as the Startup folder is accepted natively (DL6) and gets no Mark-of-the-Web (DL3). "Torrent off by default" is therefore a default, not a guarantee | `modules/downloads/settings.ts:7-11,25-33,42-47`, `core/settings/settings.ts:9` | **fixed (#1047)**; S (device-local keys, native check of the folder) |
| DL11 | info | Unchecked multiplications | `src/torrent.rs:133,136` | **fixed (#1047)**; S |

**This PC / tweaks / OS entry points (B6).** `git diff d48a4fe..7ef17176 -- '**/guard.rs'` is empty. Closed catalogue, HKCU only, no elevation, journal native-only, association on click, launch arguments only pre-fill a dialog.

| ID | Sev | Finding | Evidence | Size |
|---|---|---|---|---|
| PC2 | low | A tampered journal makes "undo" write attacker-chosen bytes at four writable places (no privilege gain) | `crates/pc-tune/src/reg.rs:113-141`, `journal.rs:571-600` | S |
| PC3 | low | Unbounded recursion in the Steam file parser (crash only) | `crates/disk-scan/src/steam.rs:14,137-170` | S |
| PC4, PC5 | info | Panic text is free text (scrubbed twice, UNC now covered by R7); the typed delete confirmation became a boolean, still enforced in Rust | `src/panic_log.rs:21-36`, `crates/disk-scan/src/delete.rs:98-104` | – |

**Mail, music, calendar, feeds, maps, weather (B7).** OAuth: PKCE S256, state checked in Rust, loopback only, no client secret shipped (user-entered, secret store), refresh token only in the secret store, Google revoke on disconnect. Mail HTML: DOMPurify, sandboxed frame without scripts, in-frame CSP, images blocked by default, unsubscribe only as an https link after a dialog, raster previews only.

| ID | Sev | Finding | Evidence | Size |
|---|---|---|---|---|
| M2 | low | `fetchPublic` judges only the first URL; redirects are followed on the desktop (also `redirect: 'error'` in `core/mail/localAi.ts:100` has no effect there) | `core/net/fetchPublic.ts:142-146` | S–M |
| M3 | low | Attachment name went unsanitised into the save dialog – **fixed** | `modules/mail/components/ThreadView.tsx:75-79` | – |
| M4 | low | Feed `siteUrl` without scheme check as `href` – **fixed** | `modules/feeds/routes/MainPage.tsx:240` | – |
| M5 | low | = old T5: loopback OAuth listener single-threaded, 5 s timeout; new fixed port for Spotify can be pre-bound (fails closed) | `src/oauth.rs:109-141,182-213` | S |
| M6 | low | Mail links open without showing the real host | `modules/mail/components/MailFrame.tsx:73-79` | S |
| M7, M8 | info | Spotify has no revoke endpoint (say so); stale "read-only" and "no iframes" comments | `connectors/spotify/index.ts:76-81`, `connectors/google/gmail.ts:1-4` | docs |

**AI and local model (B8).** `exclusion.test.ts` is driven by the registry and current (13 modules without `aiSchema`); `privacy.test.ts` uses fixed fixtures, so the six new modules with an `aiSchema` (clock, fitness, habits, maps, routines, timetrack) are covered by construction (schema-only prompt), not by recognisable seed data. No implicit cloud send found: chat titles, mail summaries and planner replanning are local. Local API and MCP unchanged. Open: AI1 (above), A5.

| ID | Sev | Finding | Evidence | Size |
|---|---|---|---|---|
| A5 | low | Still open: the model file is not re-hashed at load | `src/local_llm.rs:289-295` | M |
| A9–A11 | info | Feeds `feed` collection is in the data API; download allow-list covers the first URL only (hash still pinned); "local only" for mail text is judged by host | `modules/feeds/manifest.ts:37-45`, `src/local_llm.rs:45-55`, `core/mail/localAi.ts:129-136` | – |

**Planner sources, quick capture, import (B9).** Share target and launch arguments only pre-fill; mail never writes by itself; importers write only their own collections after a preview; CSV export neutralises formulas.

| ID | Sev | Finding | Evidence | Size |
|---|---|---|---|---|
| Q1 | low | Cubic backtracking in `parseAddress` on a raw `From` header (3 s at 2 000 leading tabs); not verified that Gmail delivers such a header | `core/mail/address.ts:5`, `connectors/google/gmail.ts:167,195` | S |
| Q2 | low | A note with a remote image beacons when opened in the PWA (the desktop CSP blocks it) | `modules/notes/editor/imageNode.ts:32-35` | S–M |
| Q3 | low | Bookmark `url` from sync or a share file is not scheme-checked before it becomes an `href` | `modules/bookmarks/schema.ts:19`, `components/BookmarkRow.tsx:188` | S |
| Q4, Q5 | info | One-tap invoice from a mail with a spoofed display name; quadratic trims inside the import worker | `modules/mail/invoiceRow.ts:65-75` | – |

**Preview modules and what runs by default (B10).** Preview: browser, chat, clock, exchange, fitness, mail, maps, music, remote. A fresh install enables calendar, finance, invoices, subscriptions, todos, weather, lists, budgets, routines, device and (desktop) downloads; no preview module. Native `setup` opens no network listener (`src/lib.rs:351-361`). What opens and stops each listener: the **LAN hub** (with remote control and exchange) follows the sync configuration, not a module, and `startSync()` runs outside the safe-mode guard (`main.tsx:71-79`) – it also listens in safe mode and with every module off; the **Local API** follows its own device-local setting (off by default) and runs only while AI is switched on; the **torrent engine** is started by the Downloads page and stopped only by its own switch or app exit (DL2); the **vault-bridge pipe** is the only listener tied to a module service (`modules/accounts/service.ts`) plus a device-local switch; the **OAuth loopback** listener lives from the start of a login until the callback (at most 15 minutes), or until the next login or app exit if the login is abandoned (`src/oauth.rs:147-158,223`). Four things do exist from the start: the single-instance hand-over (a second start passes its arguments to the running app, which only pre-fills the Downloads dialog, `src/lib.rs:120-124`); the native-messaging host mode (while the registry entry of the extension bridge exists, the allowed extension's browser can start the exe as a relay, also with the vault module off – it opens no listener, `src/main.rs:10-11`, `src/vault_host.rs`); the hidden quick-capture window, which shares the main window's profile and so its database (`src/capture.rs:154-170`; it has two commands of its own); and the PC side of remote control, which is a settings switch (off by default), not tied to the preview module `remote` on the phone. Dev and stable builds have the same default modules and maturity filter; they differ in keys, bundle id, dev tools, seed and possibly the bundled local model. MOD1 (info): **no native command checks module state** (`src/lib.rs:181-323`) – "off" and "preview" reduce the UI, not the native surface; all but four commands are granted to webview `main` only (the capture and remote-power windows get two each, by window label), so this matters only after script execution in the main webview (none found; CSP `script-src 'self' 'wasm-unsafe-eval'`) or through synced module and settings rows that drive legitimate native calls (MOD2, DL10). MOD2 (info): `_modules` rows sync, so a device holding the data key can switch a module on for another device. Consequence for the verdict: a finding in a preview module still counts where its native part is reachable from `main`; M1 was therefore fixed rather than parked as "stays off".

**Native shell (part C).** Capabilities: `main` only (by `webviews`), capture window 2 commands, power window 2, no `remote` scope; CSP `script-src 'self' 'wasm-unsafe-eval'`, `frame-src`/`object-src`/`form-action` none; no devtools, no global Tauri; ACL test in step with handlers. Full command inventory: kept outside the repo (174 rows), weak inputs are DL6 and NS9. One capability is the common cause behind M1 and M2: `http:default` allows every `http://` and `https://` host and port for `main` (`capabilities/default.json:86-101`), so for the plugin fetch the public-host rule exists only in app code (`core/net/fetchPublic.ts`). The CSP half (`connect-src https: http:`) was accepted in October (T1) because plain-HTTP sync servers and feeds need it; the plugin scope itself was never decided – decide it with package 10. DL4 has its own cause: the native downloader is a separate HTTP client with no host rule.

| ID | Sev | Finding | Evidence | Size |
|---|---|---|---|---|
| NS2 | low | Updater manifest version is unsigned: an older validly signed exe can be served as newer (rollback) | `src/update.rs:146-163`, `src/portable.rs:91-103` | M, Sven merges |
| NS3 | low | The APK installer's URL check is not flavour-aware: a stable app may fetch the dev APK (installs as a second app after confirmation) | `plugins/apk-installer/src/validate.rs:6-36` | S |
| NS4 | low | Only the pre-merge manifest is asserted (`allowBackup="false"`); cleartext is printed, the merged manifest of the shipped APK (permissions, exported components) never checked | `web/scripts/lib/androidManifest.ts:20-33`, `.github/workflows/release.yml:354-357` | S, **fixed (#1050)** |
| NS5 | low | No `dataExtractionRules`: device-to-device transfer can copy the database | `web/scripts/lib/androidManifest.ts:20-33` | S |
| NS6 | low | Notifications set no visibility: reminder titles show on the lock screen unless the OS hides them | `core/platform/tauri/index.ts:103-107,139-147` | S |
| NS7 | low | = F3; on Android `exchange/inbox.json` is inside the page's file scope | `capabilities/default.json:59-70`, `src/exchange_client.rs:91-97` | S |
| NS8 | low | = old V4: Android clipboard without the sensitive flag | `core/platform/tauri/index.ts:175-182` | S |
| NS9, NS10 | info | `disk_scan_start` takes any root (read-only); 29 desktop grants duplicated for all platforms; stale capability description | `src/disk.rs:146-155`, `capabilities/default.json:8-36` | – |

**Web layer, server, reset, diagnostics (part C).**

| ID | Sev | Finding | Evidence | Size |
|---|---|---|---|---|
| R2 | low | Reset leaves partner-share codes `share.code.<id>` in the secret store | `core/reset/device.ts:17-43`, `core/share/pairs.ts:30,69,88` | **fixed (#1046)**; Sven merges |
| R3 | low | Reset does not unsubscribe push: the server keeps delivering up to two weeks of reminders | `core/notifications/push.ts:154,266-271` | **fixed (#1046)** |
| R4 | low | Push payload link `//host` left the app – **fixed** | `core/notifications/pushPayload.ts:56` | – |
| R5 | low | Backup and share merge accept far-future stamps: such fields then win against every later edit on all synced devices, and pushes containing them are refused with a clock error (sync stalls). A partner's share file is merged into every synced table except the vault and core tables, not only the modules of the pair. Low because both need a file the user merges after a preview, and ids are unknown to the sender | `core/backup/backup.ts:13-31,121-129`, `core/share/share.ts:94-96,280` | S |
| R6 | low | The self-hosted PWA ships without CSP, `frame-ancestors` or nosniff | `web/index.html`, `server/src/app.ts:150-153,558-563` | S–M |
| R7 | low | Diagnostics scrubber stopped at the first space of a Windows user folder; UNC paths survived – **fixed** | `core/diagnostics/errorLog.ts:48-51` | – |
| R8 | low | Push endpoint is checked for private addresses at subscription only (DNS rebind at send) | `server/src/app.ts:404-424` | M |

"Alle Daten löschen" – not cleared before #1046 (R1–R3; now cleared except the PC-care journal while something can be undone, models unless ticked, downloaded files): `lan-sync/` (`trust.json`, `hub.db`, `home.json`, `port`, `remote.json`, `remote-notice.json`, `remote-programs.json`, `exchange/*`), keyring slots of the hub, `lan-client:` entries on the phone, `downloads.json`, `torrent-state/`, `browser-profile/` (a clear command exists, it is not called), `models/`, `pc-care/journal.json`, `logs/panic.log`, the native-messaging manifest and its registry entry, `share.code.*`, the push subscription on the server. Cleared: database, `tm-*` local storage, AI keys, all connector secrets, PIN, biometric and app-lock seals, vault seal (V1), auto-backup passphrase.

**Supporter codes.** The in-app check is unchanged since October: signatures are verified offline (`core/supporter/verify.ts`), the test key is accepted only in the E2E build, names from a code are sanitised (`packages/supporter-codes/src/code.ts:133,167`), and the status gates only palettes and the badge. The webhook requires its rate limiter and refuses the test key id. No finding.

**Supply chain and pipeline (part D).**

| ID | Sev | Finding | Evidence | Size |
|---|---|---|---|---|
| SC4 | low | The publishing build restores caches | `.github/workflows/release.yml:212-219,328,338-342` | S, **fixed (#1050)** for `release.yml`; the Dev-Preview keeps its caches (accepted: dev key only) |
| SC5 | low | `libsqlite3-sys` 0.30.1, RUSTSEC-2026-0459 (needs write access next to the hub database; not realistically reachable) | `web/src-tauri/Cargo.lock`, `crates/lan-sync/src/store.rs:97` | M |
| SC6 | low | The pin test does not read `.github/actions/*/action.yml` (all five `uses:` there are pinned today) | `web/scripts/lib/actionsPinned.test.ts:11` | S |
| SC7 | low | Dependabot misses the root and `scripts/agents` npm projects, two crate lockfiles and one Gradle project; no audit job in CI | `.github/dependabot.yml` | S |
| SC8–SC11 | info | Ratchet proxy approval ends 2026-11-22; the artifact audit passes on an empty folder; one stale line in `.gitleaksignore`; the licence list ships ids and links, no licence texts (Apache-2.0 §4) | `web/scripts/ratchet.mjs:52-54`, `web/scripts/audit-release.mjs:38-46`, `.gitleaksignore:17`, `web/src/core/about/licenses.json` | S–M; SC9 and SC10: Sven merges; SC9 **fixed (#1050)**, SC10 proposal in #1050 |

Audit results (run on this commit):

- `npm audit --omit=dev`: 0 in `web`, `server`, `extension`, repo root, `scripts/agents`, `packages/vault-core`, `packages/supporter-codes`, `services/supporter-webhook`. `mcp`: 2 moderate (`hono`, `@hono/node-server` through the MCP SDK; the wrapper uses stdio only – not reachable). `site`: 1 moderate (`astro` 7.3.6; static output, not reachable; PR #827 fixes it).
- `cargo audit` against [DEPS-AUDIT-2026-11-08.md](DEPS-AUDIT-2026-11-08.md): gone – `zip`, `rustls` (4), `rustls-webpki`, `webpki-roots`. Still there – `ringbuf` RUSTSEC-2026-0293 (torrent), `glib`, `tokio` unsound, unmaintained `unic-*`/`zvariant*`, 3 yanked. New – SC5; `quinn-proto`/`quinn-udp` (lockfile only, not in the build graph); `chrono` unmaintained (via `librqbit-dht`); `rustix` unsound (not in the Windows tree).
- Licences (project: MIT): `librqbit` 9.1.0 Apache-2.0; `llama-cpp-2` MIT OR Apache-2.0; no GPL/AGPL/LGPL-only crate; the browser filter list is hand-written, no third-party list bundled; `check:licenses` passes.
- Workflows: all 77 external `uses:` pinned to a commit SHA; no `pull_request_target`, `workflow_run` or `issue_comment` trigger; no event text inside `run:`; fork PRs get no secrets; the `full-ci` label requires the head repo to be this repo; the production exe is signed only on publish; dev and stable updater keys differ and CI enforces it.
- gitleaks v8.21.2 over all refs (3 853 commits): 0 leaks with the ignore file, 11 without – all test fixtures (fake vault entries, example TOTP secret, a public VAPID key, a truncated PEM in the audit test, invented tokens). No key file was ever added in the history. No secret value appears in this report.
- Dev-Preview artifacts (`1.0.0-dev.3639+28cb1a1`, 2026-11-16): `.sha256` equals the published digest, the manifest signature equals the `.sig` asset, the key id matches the dev key. The two binaries (93 MB) were not downloaded.

**Public repository (part E).** E-mail addresses: only example/test domains plus the deliberately public maintainer contact. IBANs: test values. Seeds and fixtures invented. `docs/meta/agents-v3/**` and `scripts/agents/**`: placeholders only. `site/public/.well-known/security.txt`: valid, expires 2027-10-01. The controller is no placeholder in the repo: name and address come from build variables and the production build fails without them. D15 (info): `claude-lock.json:3-7` and `services/supporter-webhook/wrangler.toml:23` publish organization, workspace, agent and KV ids (identifiers, no credentials) – decide whether to keep. The notes repo was looked at for the board lines only; it holds no finding text from this review.

**Promises against code (part F).** Besides D6 and D8:

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| D7 | low | Mail remote images (tracking pixel on "Bilder laden") and the optional Gmail poll were in no promise document – **fixed** for in-app notices, DATA-FLOWS, website and user docs in the texts PR | `core/mail/sanitize.ts:220`, `modules/mail/notifyService.ts:49-88` |
| D9 | low | Opt-in breach check sends 5 hex characters of each password's SHA-1 to api.pwnedpasswords.com; undocumented everywhere | `modules/accounts/breach.ts:9,72`, `modules/accounts/settings.ts:17-33` |
| D10 | low | "Sync only through your own server" ignored home-network sync, exchange and remote control (listener + mDNS) – **fixed** in the texts PR (website, user docs, README, DATA-FLOWS and the in-app `sync` notice; an own row for exchange and remote control is left to package 11) | `docs/user/security.md:8`, `docs/user/faq.md:24`, `README.md:173`, `site/src/i18n/de.ts:113`, `crates/lan-sync/src/discovery.rs:1-28` |
| D11 | low | Bookmark and tab previews fetch pages automatically (opt-in settings); DATA-FLOWS and the in-app browser notice say "never in the background" | `modules/bookmarks/preview.ts:50-58`, `modules/browser/tabPreviews.ts:25-29`, `docs/legal/DATA-FLOWS.md:21`, `strings.legal.ts:118,368` |
| D12 | low | Spotify scopes are broader than the site text – **fixed** (ledger, privacy pages, user docs) | `connectors/spotify/index.ts:121-166` |
| D13 | info | Stale: `docs/legal/data-flows-hinweise.md:9`; the in-app host list lacks api.anthropic.com (`core/net/catalogue.ts:31-38`) | – |
| D14 | low | SECURITY.md scope did not name the new parts – **fixed** | `SECURITY.md` |
| D16 | low | The website privacy pages said about AI "never your entries; in chat the chat text goes to the provider" – the chat can attach module data after a preview (the in-app notice says so) – **fixed** in the texts PR | `modules/chat/engine.ts:98-105`, `site/src/pages/datenschutz.astro:54`, `site/src/pages/en/privacy.astro:52`, `docs/user/faq.md:24`, `site/src/i18n/de.ts:202-204` (data page heading "The AI does not see your entries … nothing more", reworded) |
| D17 | low | User docs said the server "only sees collection, IDs and timestamps" with end-to-end encryption; field names are readable too – **fixed** | `server/src/store.ts:8,117`, `docs/user/security.md:8` |
| D18 | low | The sync guide said the PC "only listens on your home network" (the mDNS sockets of H10 listen on every interface) and that keys "are never synced"; the in-app sync notice said keys are never transferred – at pairing the data key goes once, encrypted, to the paired device – **fixed** in the texts PR ("accepts connections", the one exception named) | `docs/user/sync.md:13,102`, `strings.legal.ts:38,288`, `crates/lan-sync/src/pairing/mod.rs:31,108-109` |
| D19 | low | The start-page headline and the README tagline said "your data stays on your device" without a condition – **fixed** in the texts PR ("your data lives on your device; only what you set up goes online"). Left: the social preview image still carries the old line (`web/scripts/gen-social.mjs:49,55`, `docs/brand/social-preview.png`); regenerate and upload it with package 11 | `site/src/i18n/de.ts:56`, `site/src/i18n/en.ts:50`, `README.md:12`, `README.de.md:12` |
| D20 | low | The backup guide said "an edited file is refused"; the checksum is a plain SHA-256 that anyone can recompute, and a file without one passes as unprotected – **fixed** in the texts PR ("a damaged file is noticed") | `docs/user/backup.md:29`, `core/backup/encrypted.ts:113-125`, `core/backup/verify.ts:116-123` |

## Status of the earlier findings (LAUNCH-REVIEW-2026-10-06, AUDIT-2026-09-30)

No regression. Verified at the code, not from the old status table.

| Finding | Status today | Evidence / test |
|---|---|---|
| X1 | fixed, Windows hand test still open (SEC-1) | `crates/vault-bridge/src/ipc.rs:200-204` |
| X2, X4 | X2 **fixed (#1054)**, X4 **accepted** (medium, table above) | – |
| X3, X5–X8 | fixed | `modules/accounts/bridge/bridgeHandler.test.ts:253,460`, `extension/test/background.test.ts:116`, `extension/test/forms.test.ts:188`; no test for the `isTrusted` guard itself |
| N1–N8, N10–N12, S3, S4, S7, S8, S17 | fixed | `core/db/hlc.test.ts:51`, `server/test/api.test.ts:152`, `core/sync/service.test.ts:136`, `core/sync/cursorRepair.test.ts` |
| N9 / S10 | **open** (low) | `server/docker-compose.yml:15`, `server/src/index.ts:26`, `server/Dockerfile:6` |
| S5 | **fixed in the apps (#1057)**, PWA accepted (medium) | table above |
| V1 | fixed for the vault seal; the same gap is new for LAN keys (R1) | `core/reset/device.test.ts:67` |
| V2, V3, V6–V8, V11 | fixed | `plugins/secure-store/src/desktop/sealed.rs`, `core/crypto/crypto.test.ts:125-141` |
| V4 | **open** (low, = NS8) | `core/platform/tauri/index.ts:175-181` |
| V5 | partly (residual, table above) | – |
| V9 | unchanged (info): no rollback protection for vault ciphertext | – |
| V10 | by decision: vault CSV export is not neutralised | `modules/accounts/csv.ts:33` |
| L1, L2 | fixed | `crates/local-api/tests/server.rs:256,360` |
| W1–W3 | fixed | `services/supporter-webhook/test/webhook.test.ts:87,250-260` |
| T1–T4 | fixed (T2: `allowBackup` asserted, cleartext only reported → NS4) | `core/platform/tauri/csp.test.ts`, `plugins/apk-installer/src/validate.rs:60` |
| T5 | **open** (low, = M5) | `src/oauth.rs:109-141,182-213` (bind at `:134`) |
| T6, T7, T8 | unchanged (info): portable exe at a drive root protects the drive; pre-update copy is plaintext without a backup passphrase; `$APPDATA/**` file scope | `core/update/backup.ts:42-50`, `capabilities/default.json:53-74` |
| A1 | fixed inside one call; residual AI1 | `core/ai/router.test.ts:142` |
| A2–A4, A6 | fixed | `connectors/ics/ics.test.ts:107`, `core/ai/config.test.ts:100`, `core/connectors/service.test.ts:280` |
| A5 | **open** (low) | `src/local_llm.rs:289-295` |
| P1, P6 | fixed | `web/scripts/lib/actionsPinned.test.ts:30`, `.github/workflows/ci.yml:277-282` |
| P2 | **exe: fixed** – the dev updater key is a real, different key (stable id `3CDE…277E`, dev id `FA42…B9CE`) and CI stops when they are equal (`.github/workflows/dev-preview.yml:180-196`). **APK: open** (SC2) | – |
| P3 | partly: release dry runs do not sign the exe; rest is SC2/SC3 | – |
| P5 | **open** (low): no build provenance | – |
| S13 | **open** (medium, recommendation: accept) | table above |
| D1–D5 | fixed | `docs/user/security.md`, `SECURITY.md:15` |
| Website controller placeholder | no placeholder in the repo; build variables, production build fails without them | `site/src/legal.js:22-40`, `npm run check:legal`: 0 open |
| Not re-verified | X10, X11, N8, L3–L7, W4–W8, A7, A8, P4, P7–P13 (info items) | – |

Hand tests of October: none is ticked in MANUAL-TESTS.md. LR1 (pipe, second user), LR2 (Hello + reset) and LR3 (APK update, without the wrong-digest step) exist; the Android clipboard check, "dev preview is not offered to a stable install" and the run-log check had no entry. X11 there expects "belegt", which X2 says cannot happen on Windows. All are now covered by `SEC-1` to `SEC-14`.

## Not checked, because …

- **Windows and Android runtime behaviour** (firewall prompt, NLA network identity and whether a foreign network with a cloned gateway gets the same id, WebView2 defaults in browser tabs, the default button of the native dialogs, lock-screen notifications, Hello): needs hardware → `SEC-…` hand tests.
- **Dependency internals** not on this machine: `librqbit` (how metainfo file paths with `..`, absolute paths or reserved names are handled – the key open question behind DL1; LSD/uTP defaults; whether `stop` closes the listener), `ureq` and `tauri-plugin-http` (redirect defaults), `tauri-plugin-updater`, `rfd`, `mdns-sd`, llama.cpp GGUF parsing (impact of A5 is assumed, not shown).
- **The merged Android manifest of a real APK** (`gen/android` is not tracked, no build was run); Gradle dependencies; the server's Docker base image.
- **The two Dev-Preview binaries** (93 MB): signature and APK content not verified here; the repo's audit ran on the three small assets only.
- **GitHub settings not readable from here:** Actions permissions, environments and their secrets, Dependabot and code-scanning alerts, who has write access. Listed for the maintainer below.
- **File receive of the exchange module:** the code does not exist yet; review again with packages 2b-2/2c.
- **Not read in full:** ICS, vCard, bank and fitness importers; TipTap link schemes; chat markdown; maps parsers (`pmtiles`, `mvt`, Overpass); weather cadence; `HubSearch.kt`; `crates/disk-scan` scan/tree diffs; `system-info` unsafe blocks; the middle of `ci.yml` and `codeql.yml` (grepped for secrets, triggers, expressions only); MCP sources (history shows dependency bumps only).
- **Screenshots and other binaries** in the repo were not opened; the git history was scanned for secrets, not for removed personal data.
- **Tests:** apart from the tests of the three fix PRs and the cross-check of three crates for the Windows target, no suite was run for this report.
- **Legal:** the state of LAUNCH-LEGAL-CHECKLIST.md is only listed (3 done, 14 open: imprint variables, legal basis column, imprint duty, reachable e-mail, own processing, in-app texts, Ko-fi page, tax, Google verification, four licence items, trademark). No legal advice.

## Network inventory (what the code contacts)

"Named" after the texts PR: W = website ledger (the privacy page names the main flows and points to the ledger), U = `docs/user/security.md`, F = `docs/legal/DATA-FLOWS.md` and the in-app notices.

| Destination | When | What is sent | Named |
|---|---|---|---|
| github.com, api.github.com, release asset hosts | start/foreground, at most daily, default on, switch | request for manifest and releases | W U F |
| api.frankfurter.dev | opening the currency tool | request | W U F |
| open-meteo.com (forecast, geocoding, air quality) | after a place is chosen; ~30 min | place name, position rounded to ~1 km | W U F |
| api.ipify.org | click (two places) | request | W U F |
| huggingface.co and its CDN | model download after confirmation | request | W U F |
| AI providers (OpenAI, Gemini, Groq, Mistral, OpenRouter, Anthropic, own URL), Ollama on loopback | assistant and chat with a stored key | question, date, field names; chat text; attached data after a preview | W U F (in-app host list lacks api.anthropic.com: D13) |
| Google (accounts, oauth2, www.googleapis.com, gmail.googleapis.com) | after connecting; calendar ~30 min; mail on opening, optional poll | OAuth; calendar ids; mail search, ids, outgoing mail with the extra scopes | W U F |
| Spotify (accounts, api) and image servers (i.scdn.co, mosaic.scdn.co, image-cdn-*.spotifycdn.com) | after connecting; poll ≤ 30 s while visible; covers when shown | OAuth; playback, library and playlist calls; image request | W U F |
| OpenStreetMap tiles, Nominatim, routing.openstreetmap.de, api.transitous.org, overpass-api.de (each replaceable) | Maps module: view, search, route, own map | tile numbers, search text, route endpoints, bounding box | W U F |
| ICS and feed addresses (browser: through `/v1/proxy` of the own server) | subscription ~30 min; feed lookup on click | request | W U F |
| Own sync server | after setup: start, ~60 s, on change | field changes (end-to-end encrypted with a passphrase), token | W U F |
| Web push: own server → the browser vendor's push service | when switched on | reminder title, text, link | W F |
| Built-in browser: opened pages, search engine (default DuckDuckGo) | Windows and Android (there a Chrome custom tab), module on, on input | what a browser sends | W U F |
| Downloads: the file's server; torrent: peers, trackers, DHT, optional UPnP; listener on all interfaces | Windows, on click; torrent part off by default | request; IP address and info hash | W U F |
| Home network: hub TCP listener on private addresses of the home network; mDNS announcement on those addresses (the library's UDP sockets on port 5353 are wildcard, H10); phone → pinned private address, and an mDNS search on the current Wi-Fi when that fails (H2) | hub: while a pairing window is open or a device is paired; data after pairing | sync, exchange, input inside a Noise channel | W U F |
| Sender-chosen image hosts in a mail | "Bilder laden" or setting "always" | request (with the fix: public https only, redirects judged again) | W U F |
| Link and bookmark previews, reader view, tab previews | opt-in settings or click | second request for the page and its preview image | – (D11) |
| api.pwnedpasswords.com | opt-in breach check in the vault | first 5 hex characters of a SHA-1 | – (D9) |
| System browser links (Google/Apple Maps, WhatsApp, Ko-fi, Genius, provider consoles, unsubscribe and mail links) | click | the address | F |
| Local only: Local API (loopback, off by default), MCP (stdio), extension (native messaging) | – | – | – |
| Operator side: Cloudflare Pages (website), Ko-fi → Cloudflare Worker → Resend | visiting the site; voluntary support | connection data; amount, e-mail, optional name | W F |

## For the maintainer in GitHub

SC1 has its own private note and is not part of this list. Seen from outside on 2026-11-21: private vulnerability reporting **on**; secret scanning **on** with push protection **on** (non-provider patterns and validity checks off); Dependabot security updates **on**. Not readable from this session: Actions permissions, environments, Dependabot and code-scanning alerts, collaborators and tokens.

1. `develop` ruleset: add the required status checks (open item 2 in CHATS.md).
2. Settings → Actions → General: workflow permissions "read", "allow GitHub Actions to create and approve pull requests" off, workflows from fork pull requests need approval.
3. Secret scanning: switch on non-provider patterns and validity checks. Look at the open code-scanning and Dependabot alerts: a push on 2026-11-22 reported 19 open Dependabot alerts on the default branch `main` (1 critical, 1 high, 13 moderate, 4 low); `main` is far behind `develop`, whose production audits are clean (above).
