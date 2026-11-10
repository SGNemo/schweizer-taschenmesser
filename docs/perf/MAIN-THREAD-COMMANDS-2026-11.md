# Tauri commands and the main thread – 2026-11

Inventory for UI audit package 0a-4 ([PACKAGE-0](../design/ui-audit-2026-11/PACKAGE-0.md) "Maßnahme 4", [REPORT](../design/ui-audit-2026-11/REPORT.md) H1/H5). In Tauri 2 a plain `#[tauri::command] fn` runs on the main thread; `async fn` and `#[tauri::command(async)]` run on the async runtime. **Read from the code on Linux, nothing measured**: whether a blocked main thread really stalls app assets under Windows is still the hand test (REPORT "Lade-Robustheit", Maßnahme 0).

## Numbers

| | spec (36da279e) | `develop` 657e55d | this PR |
|---|---|---|---|
| `#[tauri::command]` attributes | 120 | 120 | 120 |
| `async fn` | 33 | 33 | 33 |
| `#[tauri::command(async)]` on a plain `fn` | 0 | 3 (#625: `browser_open`, `browser_close`, `browser_clear_data`) | 18 |
| on the main thread | 87 | 84 | 69 |

- The spec's 87/33 is confirmed for its base; per file it matched too (`browser.rs` 10 → 7 after #625).
- 120 attributes are **109 commands**: 8 `llm_*` exist twice (`local-llm` feature on/off), 3 `vault_bridge_*` twice (Windows/other). Unique: 27 `async fn`, 82 in the table below.
- Rating of the 82: **yes** 16 (15 moved here, `disk_delete` frozen), **no** 35, **unchecked** 28, already moved by #625: 3.

## What the ratings mean

- **yes**: the code contains work without a small fixed bound: webview calls per tab, a walk over the whole scan, listing running programs, keystore, SQLite, network writes, a thread join; or it waits for a lock such a command holds.
- **no**: in-memory state, a flag, a hand-over to a thread; or work that belongs to the main thread anyway (tray, hotkeys, windows).
- **unchecked**: short system calls whose duration under Windows nobody measured (process start, registry, clipboard, small files on a possibly slow drive, single WebView2 calls). Not changed; candidates only if the hand test still shows a hang.

## Changed in this PR

- `browser_show`: `async`; calls are numbered by the page (`seq`) and an overtaken call is ignored, so a late "show" cannot put a tab over another page; returns the ids of created tabs whose webview is no longer registered (forgotten natively, the page shows "Tab neu öffnen"). A tab still being created is never reported. That a WebView2 process crash unregisters the webview stays a hypothesis: a crashed but still registered webview is not detected.
- `disk_query`, `disk_can_delete`, `disk_delete_plan`: `async`, bodies unchanged (same guard, same checks).
- all 11 `lan_*` hub commands: `async`; they already ran one at a time under the `LanSync` lock. `lan_hub_stop` now keeps that lock until the hub is down, so a start on another thread cannot build a second hub meanwhile.
- Pinned by `web/src-tauri/tests/commands.rs`.

## Open

- `disk_delete` (`disk.rs`): builds the guard (lists running programs) on the main thread before its worker thread starts. Left untouched because the function is frozen; moving it would be the attribute only.
- `find_duplicates` holds the tree's read lock for the whole search; a delete finishing meanwhile waits for the write lock, and a writer-preferring lock would then hold up every tree read. Not changed.
- After a reload of the Nemo page the native tab entries survive while the page's tab list is empty (orphan webviews stay hidden). Not changed.

## Commands that are not `async fn`

Lines as of this PR, paths under `web/src-tauri/src/`. The 27 `async fn` commands (`torrent.rs` 8, `local_llm.rs` 6, `disk.rs` 4, `lan_client.rs` 3, `system.rs` 3, `update.rs` 2, `oauth.rs` 1) are off the main thread already and not listed.

| Command | Where | Runs | Can block the main thread | Why |
|---|---|---|---|---|
| `browser_open` | `browser.rs:164` | `(async)` | – | `async` since #625 (webview creation, `add_child`) |
| `browser_navigate` | `browser.rs:419` | sync | unchecked | one call on an existing webview; WebView2 timing not measured |
| `browser_back` | `browser.rs:460` | sync | unchecked | as `browser_navigate` |
| `browser_forward` | `browser.rs:471` | sync | unchecked | as `browser_navigate` |
| `browser_reload` | `browser.rs:482` | sync | unchecked | as `browser_navigate` |
| `browser_close` | `browser.rs:496` | `(async)` | – | `async` since #625 (closes a webview) |
| `browser_show` | `browser.rs:516` | `(async)` | yes → async | webview calls for every tab; now numbered (`seq`) and reports lost tabs |
| `browser_set_zoom` | `browser.rs:557` | sync | unchecked | as `browser_navigate` |
| `browser_configure` | `browser.rs:570` | sync | no | replaces in-memory rules under a short lock |
| `browser_clear_data` | `browser.rs:601` | `(async)` | – | `async` since #625 (closes webviews, deletes the profile folder) |
| `capture_set_hotkey` | `capture.rs:451` | sync | no | registers a global shortcut; short, belongs to the main thread |
| `desktop_set_vault_hotkey` | `capture.rs:461` | sync | no | as `capture_set_hotkey` |
| `desktop_set_voice_hotkey` | `capture.rs:477` | sync | no | as `capture_set_hotkey` |
| `capture_hide` | `capture.rs:492` | sync | no | hides a window |
| `capture_read_clipboard` | `capture.rs:498` | sync | unchecked | clipboard read; Windows waits while another program holds the clipboard |
| `desktop_set_close_to_tray` | `capture.rs:505` | sync | no | one atomic flag |
| `desktop_set_tray_labels` | `capture.rs:510` | sync | no | tray menu texts; main-thread work by nature |
| `desktop_set_tray_today` | `capture.rs:526` | sync | no | rebuilds the tray menu (a few items); main-thread work by nature |
| `desktop_set_autostart` | `capture.rs:539` | sync | unchecked | registry write (autolaunch) |
| `desktop_autostart_enabled` | `capture.rs:550` | sync | unchecked | registry read |
| `desktop_info` | `capture.rs:555` | sync | no | one path check |
| `desktop_data_dir` | `capture.rs:575` | sync | no | one path check |
| `desktop_take_panic_log` | `capture.rs:582` | sync | unchecked | reads and removes a small file; slow only on a slow portable drive |
| `desktop_safe_mode` | `capture.rs:597` | sync | no | argv and one environment variable |
| `desktop_open_data_dir` | `capture.rs:630` | sync | unchecked | starts the file manager (shell call) |
| `desktop_show_main` | `capture.rs:641` | sync | no | shows a window |
| `disk_scan_start` | `disk.rs:131` | sync | no | starts its own thread (`disk-scan-main`) |
| `disk_scan_cancel` | `disk.rs:200` | sync | no | one flag |
| `disk_scan_pause` | `disk.rs:212` | sync | no | one flag |
| `disk_scan_drop` | `disk.rs:229` | sync | no | removes a map entry |
| `disk_scan_live` | `disk.rs:245` | sync | unchecked | sums all live folders under a lock (top levels only); size not measured |
| `disk_children` | `disk.rs:261` | sync | unchecked | capped at 20 000 views, but sorts all children of each visited folder |
| `disk_node` | `disk.rs:272` | sync | no | one node |
| `disk_query` | `disk.rs:282` | `(async)` | yes → async | walks every node of the scan and sorts the hits (`tree.rs` `query`) |
| `disk_known_places` | `disk.rs:306` | sync | unchecked | a handful of `is_dir` checks |
| `disk_node_path` | `disk.rs:338` | sync | no | walks up the parents of one node |
| `disk_reveal` | `disk.rs:350` | sync | unchecked | starts Explorer |
| `disk_find_duplicates` | `disk.rs:366` | sync | no | starts its own thread (`disk-duplicates`) |
| `disk_duplicates_cancel` | `disk.rs:393` | sync | no | one flag |
| `disk_can_delete` | `disk.rs:420` | `(async)` | yes → async | builds the guard: lists every running program (`system.rs` `running_programs`) |
| `disk_delete_plan` | `disk.rs:474` | `(async)` | yes → async | builds the guard (running programs) and checks up to 5000 entries, drive kind per entry |
| `disk_delete` | `disk.rs:575` | sync | yes, frozen | builds the guard (running programs) before its thread starts; **not changed** (frozen with the `confirmed_twice` check), see "Open" |
| `disk_delete_cancel` | `disk.rs:639` | sync | no | one flag |
| `downloads_watch` | `downloads.rs:65` | sync | unchecked | first call of any `downloads_*` reads the state file and stats the partial files |
| `downloads_default_dir` | `downloads.rs:82` | sync | no | path lookup |
| `downloads_add` | `downloads.rs:93` | sync | unchecked | checks the target folder (may be a network drive), writes the small state file |
| `downloads_pause` | `downloads.rs:107` | sync | unchecked | writes the small state file |
| `downloads_resume` | `downloads.rs:113` | sync | unchecked | writes the small state file |
| `downloads_remove` | `downloads.rs:123` | sync | unchecked | may delete the file, writes the state file |
| `downloads_set_limit` | `downloads.rs:135` | sync | unchecked | writes the small state file |
| `downloads_set_job_limit` | `downloads.rs:145` | sync | unchecked | writes the small state file |
| `downloads_global_limit` | `downloads.rs:156` | sync | no | one atomic read (after the first call) |
| `downloads_verify` | `downloads.rs:162` | sync | no | hashing runs on its own thread |
| `downloads_reveal` | `downloads.rs:176` | sync | unchecked | starts the file manager |
| `lan_client_pair_cancel` | `lan_client.rs:376` | sync | no | one flag |
| `lan_hub_start` | `lan_sync.rs:417` | `(async)` | yes → async | keystore, opens the trust file and the store (SQLite), first supervisor round (network) |
| `lan_hub_stop` | `lan_sync.rs:466` | `(async)` | yes → async | joins the supervisor thread, closes every connection |
| `lan_hub_status` | `lan_sync.rs:486` | `(async)` | yes → async | cheap itself, but waits for the `LanSync` lock the slow commands hold |
| `lan_pair_open` | `lan_sync.rs:518` | `(async)` | yes → async | as `lan_hub_status` |
| `lan_pair_confirm` | `lan_sync.rs:529` | `(async)` | yes → async | writes the sealed frame to the phone's connection (network) |
| `lan_pair_cancel` | `lan_sync.rs:566` | `(async)` | yes → async | as `lan_hub_status` |
| `lan_devices` | `lan_sync.rs:577` | `(async)` | yes → async | as `lan_hub_status` |
| `lan_revoke` | `lan_sync.rs:595` | `(async)` | yes → async | writes the trust file, closes connections |
| `lan_hub_rotate` | `lan_sync.rs:610` | `(async)` | yes → async | keystore twice, empties the store |
| `lan_hub_request` | `lan_sync.rs:638` | `(async)` | yes → async | one sync request against SQLite, as large as the batch (`handler.rs` `handle_json`) |
| `lan_home_set` | `lan_sync.rs:648` | `(async)` | yes → async | reads the network interfaces, writes the home network |
| `local_api_start` | `local_api.rs:42` | sync | no | binds loopback; stopping an old server joins its accept loop (polls every 20 ms) |
| `local_api_stop` | `local_api.rs:70` | sync | no | joins the accept loop (≤ 20–50 ms) |
| `local_api_set_tokens` | `local_api.rs:80` | sync | no | swaps a list under a lock |
| `local_api_respond` | `local_api.rs:93` | sync | no | hands the answer to the waiting connection thread |
| `llm_download_cancel` | `local_llm.rs:248`, `local_llm.rs:435` | sync | no | one flag |
| `llm_cancel` | `local_llm.rs:368`, `local_llm.rs:463` | sync | no | one flag |
| `oauth_listen_start` | `oauth.rs:161` | sync | no | binds a loopback port |
| `system_game_active` | `system.rs:58` | sync | no | one shell state query |
| `system_play_tone` | `system.rs:65` | sync | no | renders a short WAV; playback on its own thread |
| `system_open_task_manager` | `system.rs:75` | sync | unchecked | starts `taskmgr.exe` |
| `vault_bridge_start` | `vault_bridge.rs:44` | sync | unchecked | binds the pipe; stopping an old server connects to it (up to 6 × 50 ms) and joins |
| `vault_bridge_respond` | `vault_bridge.rs:70` | sync | no | hands the answer to the waiting connection thread |
| `vault_bridge_stop` | `vault_bridge.rs:80` | sync | unchecked | connects to its own pipe and joins the accept thread |
| `vault_bridge_register` | `vault_bridge.rs:102`, `vault_bridge.rs:128` | sync | unchecked | registry and manifest file (Windows) |
| `vault_bridge_status` | `vault_bridge.rs:110`, `vault_bridge.rs:134` | sync | unchecked | registry read (Windows) |
| `vault_bridge_unregister` | `vault_bridge.rs:118`, `vault_bridge.rs:140` | sync | unchecked | registry and manifest file (Windows) |
