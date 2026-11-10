# Tauri commands and the main thread – 2026-11

Inventory for UI audit package 0a-4 ([PACKAGE-0](../design/ui-audit-2026-11/PACKAGE-0.md) "Maßnahme 4", [REPORT](../design/ui-audit-2026-11/REPORT.md) H1/H5). In Tauri 2 a plain `#[tauri::command] fn` runs on the main thread; `async fn` and `#[tauri::command(async)]` run on the async runtime. **Read from the code on Linux, nothing measured**: whether a blocked main thread really stalls app assets under Windows is still the hand test (REPORT "Lade-Robustheit", Maßnahme 0).

## Numbers

| | spec (36da279e) | `develop` 657e55d | part 1 (#638) | part 2 |
|---|---|---|---|---|
| `#[tauri::command]` attributes | 120 | 120 | 120 | 120 |
| `async fn` | 33 | 33 | 33 | 33 |
| `#[tauri::command(async)]` on a plain `fn` | 0 | 3 (#625: `browser_open`, `browser_close`, `browser_clear_data`) | 18 | 46 |
| on the main thread | 87 | 84 | 69 | 41 |

- The spec's 87/33 is confirmed for its base; per file it matched too (`browser.rs` 10 → 7 after #625).
- 120 attributes are **109 commands**: 8 `llm_*` exist twice (`local-llm` feature on/off), 3 `vault_bridge_*` twice (Windows/other). Unique: 27 `async fn`, 82 in the table below.
- Rating of the 82: **yes** 40 (all off the main thread now), **no** 39, **unchecked** 0, already moved by #625: 3. Part 2 rated the 28 "unchecked": 22 yes, 6 no; it also moved `disk_delete` and two `downloads_*` commands part 1 had as "no".

## What the ratings mean

- **yes**: the code reaches for a file, the registry, the network, another process or program (start, clipboard, pipe), a keystore or SQLite; or it does work without a small fixed bound (a walk over the scan, a thread join); or it waits for a lock such a command holds.
- **no**: in-memory state, a flag, a hand-over to a thread; or work that belongs to the main thread anyway (tray, hotkeys, windows, a single call on an existing webview).
- Part 1 had a third rating, **unchecked** (short system calls nobody had timed). Part 2 rated them by what the code touches, not by a stopwatch: none of this was timed on Windows.

## Changed in part 2

No command was added, renamed or removed, so `build.rs` `COMMANDS` and the capability files are unchanged (`tests/commands.rs` checks both). Every change is the attribute `#[tauri::command(async)]`; where the main thread used to keep two calls apart, a lock does it now:

- `capture.rs`: `capture_read_clipboard`, `desktop_set_autostart`, `desktop_autostart_enabled`, `desktop_take_panic_log`, `desktop_open_data_dir`. The plugins behind them (clipboard, autostart, opener) run their own commands off the main thread too.
- `disk.rs`: `disk_children`, `disk_known_places`, `disk_reveal`: bodies unchanged, read-only.
- `disk.rs` `disk_delete`: attribute only, the body is byte-identical. Order as before: plan known → not expired → second confirmation (`confirmed_twice`, checked in Rust) → not already running (atomic flag, so two calls at once cannot both run) → fresh guard with the block list → worker. `guard.rs` is untouched. `disk_delete_checks_keep_their_order` pins the order.
- `downloads.rs`: all ten commands that reach the manager. They take a gate (`Downloads::gate`) one at a time, and the manager is opened under it, so two first calls cannot open it twice. `downloads_default_dir` stays (a path lookup).
- `system.rs`: `system_open_task_manager`.
- `vault_bridge.rs`: all but `vault_bridge_respond`. `vault_bridge_stop` keeps the server lock until the responder is cleared, so a start on another thread cannot lose its fresh responder to a stop.
- Still on the main thread on purpose: `browser_navigate`, `browser_back`, `browser_forward`, `browser_reload`, `browser_set_zoom`. The runtime runs the WebView2 call on the main thread either way (off it, the call is only posted there), so `async` would free nothing and could swap two quick "back" clicks. `tab_navigation_stays_in_call_order` pins that. If the hand test shows a hang on exactly these, the cause is WebView2 itself, not the thread.

## Changed in part 1 (#638)

- `browser_show`: `async`; calls are numbered by the page (`seq`) and an overtaken call is ignored, so a late "show" cannot put a tab over another page; returns the ids of created tabs whose webview is no longer registered (forgotten natively, the page shows "Tab neu öffnen"). A tab still being created is never reported. That a WebView2 process crash unregisters the webview stays a hypothesis: a crashed but still registered webview is not detected.
- `disk_query`, `disk_can_delete`, `disk_delete_plan`: `async`, bodies unchanged (same guard, same checks).
- all 11 `lan_*` hub commands: `async`; they already ran one at a time under the `LanSync` lock. `lan_hub_stop` now keeps that lock until the hub is down, so a start on another thread cannot build a second hub meanwhile.
- Pinned by `web/src-tauri/tests/commands.rs`.

## Open

- Calls of one kind sent at the same moment (bridge start and stop, pause and resume of a download) run one at a time, but no longer strictly in the order they were sent. The page awaits each call before the next, so this needs two clicks within the same few milliseconds.
- The download manager writes its job list from the commands and from the worker threads through the same temporary file; two writes at the same moment can collide (older than this package, crate `downloader` `persist`). Not changed.
- `find_duplicates` holds the tree's read lock for the whole search; a delete finishing meanwhile waits for the write lock, and a writer-preferring lock would then hold up every tree read. `disk_children` no longer waits on the main thread for that; `disk_node` and `disk_node_path` still do. Not changed.
- After a reload of the Nemo page the native tab entries survive while the page's tab list is empty (orphan webviews stay hidden). Not changed.
- Hand test on Windows: [MANUAL-TESTS](../MANUAL-TESTS.md) "Hauptthread frei halten" H1–H7.

## Commands that are not `async fn`

Lines as of part 2, paths under `web/src-tauri/src/`. The 27 `async fn` commands (`torrent.rs` 8, `local_llm.rs` 6, `disk.rs` 4, `lan_client.rs` 3, `system.rs` 3, `update.rs` 2, `oauth.rs` 1) are off the main thread already and not listed.

| Command | Where | Runs | Can block the main thread | Why |
|---|---|---|---|---|
| `browser_open` | `browser.rs:164` | `(async)` | – | `async` since #625 (webview creation, `add_child`) |
| `browser_navigate` | `browser.rs:451` | sync | no | no file, network or process access of its own: one WebView2 call that returns before the page loads and runs on the main thread either way (off it, the runtime only posts it there); the main thread keeps quick calls in order |
| `browser_back` | `browser.rs:492` | sync | no | as `browser_navigate`; two quick "back" clicks must stay in order |
| `browser_forward` | `browser.rs:503` | sync | no | as `browser_back` |
| `browser_reload` | `browser.rs:514` | sync | no | as `browser_navigate` |
| `browser_close` | `browser.rs:528` | `(async)` | – | `async` since #625 (closes a webview) |
| `browser_show` | `browser.rs:548` | `(async)` | yes → async | webview calls for every tab; now numbered (`seq`) and reports lost tabs |
| `browser_set_zoom` | `browser.rs:590` | sync | no | as `browser_navigate` |
| `browser_configure` | `browser.rs:603` | sync | no | replaces in-memory rules under a short lock |
| `browser_clear_data` | `browser.rs:634` | `(async)` | – | `async` since #625 (closes webviews, deletes the profile folder) |
| `capture_set_hotkey` | `capture.rs:451` | sync | no | registers a global shortcut; short, belongs to the main thread |
| `desktop_set_vault_hotkey` | `capture.rs:461` | sync | no | as `capture_set_hotkey` |
| `desktop_set_voice_hotkey` | `capture.rs:477` | sync | no | as `capture_set_hotkey` |
| `capture_hide` | `capture.rs:492` | sync | no | hides a window |
| `capture_read_clipboard` | `capture.rs:498` | `(async)` | yes → async | asks another program for its clipboard content; Windows waits while that program holds the clipboard or renders the text late |
| `desktop_set_close_to_tray` | `capture.rs:505` | sync | no | one atomic flag |
| `desktop_set_tray_labels` | `capture.rs:510` | sync | no | tray menu texts; main-thread work by nature |
| `desktop_set_tray_today` | `capture.rs:526` | sync | no | rebuilds the tray menu (a few items); main-thread work by nature |
| `desktop_set_autostart` | `capture.rs:539` | `(async)` | yes → async | registry write on Windows, a file elsewhere (autolaunch) |
| `desktop_autostart_enabled` | `capture.rs:550` | `(async)` | yes → async | registry read on Windows, a file elsewhere |
| `desktop_info` | `capture.rs:555` | sync | no | one path check |
| `desktop_data_dir` | `capture.rs:575` | sync | no | one path check |
| `desktop_take_panic_log` | `capture.rs:582` | `(async)` | yes → async | reads and removes up to two files (slow on a slow portable drive) |
| `desktop_safe_mode` | `capture.rs:597` | sync | no | argv and one environment variable |
| `desktop_open_data_dir` | `capture.rs:630` | `(async)` | yes → async | one folder check, then a shell call that starts the file manager |
| `desktop_show_main` | `capture.rs:641` | sync | no | shows a window |
| `disk_scan_start` | `disk.rs:131` | sync | no | starts its own thread (`disk-scan-main`) |
| `disk_scan_cancel` | `disk.rs:200` | sync | no | one flag |
| `disk_scan_pause` | `disk.rs:212` | sync | no | one flag |
| `disk_scan_drop` | `disk.rs:229` | sync | no | removes a map entry |
| `disk_scan_live` | `disk.rs:245` | sync | no | memory only: sums the live folders (two levels below the root) under a short lock |
| `disk_children` | `disk.rs:261` | `(async)` | yes → async | no file access, but builds, sorts and serialises up to 20 000 views per call and waits for the tree lock (see "Open", duplicates search) |
| `disk_node` | `disk.rs:272` | sync | no | one node |
| `disk_query` | `disk.rs:282` | `(async)` | yes → async | walks every node of the scan and sorts the hits (`tree.rs` `query`) |
| `disk_known_places` | `disk.rs:306` | `(async)` | yes → async | known-folder lookups and an `is_dir` per place (profile folders can sit on a network drive) |
| `disk_node_path` | `disk.rs:338` | sync | no | walks up the parents of one node |
| `disk_reveal` | `disk.rs:350` | `(async)` | yes → async | starts Explorer (process start) |
| `disk_find_duplicates` | `disk.rs:366` | sync | no | starts its own thread (`disk-duplicates`) |
| `disk_duplicates_cancel` | `disk.rs:393` | sync | no | one flag |
| `disk_can_delete` | `disk.rs:420` | `(async)` | yes → async | builds the guard: lists every running program (`system.rs` `running_programs`) |
| `disk_delete_plan` | `disk.rs:474` | `(async)` | yes → async | builds the guard (running programs) and checks up to 5000 entries, drive kind per entry |
| `disk_delete` | `disk.rs:575` | `(async)` | yes → async | builds the guard (lists running programs) before its worker starts; attribute only, body and order of the checks unchanged (pinned by a test) |
| `disk_delete_cancel` | `disk.rs:639` | sync | no | one flag |
| `downloads_watch` | `downloads.rs:71` | `(async)` | yes → async | first call of any `downloads_*` reads the state file and stats the partial files |
| `downloads_default_dir` | `downloads.rs:89` | sync | no | path lookup |
| `downloads_add` | `downloads.rs:100` | `(async)` | yes → async | checks the target folder and existing names (may be a network drive), writes the state file |
| `downloads_pause` | `downloads.rs:115` | `(async)` | yes → async | writes the state file |
| `downloads_resume` | `downloads.rs:120` | `(async)` | yes → async | writes the state file |
| `downloads_remove` | `downloads.rs:129` | `(async)` | yes → async | may delete the file, writes the state file |
| `downloads_set_limit` | `downloads.rs:140` | `(async)` | yes → async | writes the state file |
| `downloads_set_job_limit` | `downloads.rs:149` | `(async)` | yes → async | writes the state file |
| `downloads_global_limit` | `downloads.rs:159` | `(async)` | yes → async | was "no": one atomic read, but as the first call it opens the manager (file read), and it waits for the gate the others hold |
| `downloads_verify` | `downloads.rs:165` | `(async)` | yes → async | was "no": hashing runs on its own thread, but as the first call it opens the manager, and it waits for the gate |
| `downloads_reveal` | `downloads.rs:178` | `(async)` | yes → async | one file check, then starts the file manager (process start, outside the gate) |
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
| `system_open_task_manager` | `system.rs:75` | `(async)` | yes → async | starts `taskmgr.exe` (process start) |
| `vault_bridge_start` | `vault_bridge.rs:44` | `(async)` | yes → async | binds the pipe; stopping an old server connects to it (up to 6 × 50 ms) and joins its thread |
| `vault_bridge_respond` | `vault_bridge.rs:70` | sync | no | hands the answer to the waiting connection thread |
| `vault_bridge_stop` | `vault_bridge.rs:80` | `(async)` | yes → async | connects to its own pipe and joins the accept thread |
| `vault_bridge_register` | `vault_bridge.rs:105`, `vault_bridge.rs:131` | `(async)` | yes → async | registry and manifest file (Windows) |
| `vault_bridge_status` | `vault_bridge.rs:113`, `vault_bridge.rs:137` | `(async)` | yes → async | registry read and manifest file (Windows) |
| `vault_bridge_unregister` | `vault_bridge.rs:121`, `vault_bridge.rs:143` | `(async)` | yes → async | registry and manifest file (Windows) |
