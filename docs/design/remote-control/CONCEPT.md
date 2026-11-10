# Remote control – the phone steers the PC over the paired home network (concept)

Branch `design/remote-control-concept`, 2026-11-10. Status: **concept, no product code**; Sven answered §12 on 2026-11-10 (all four recommendations), so §11 is decided. Packages: [PACKAGES.md](PACKAGES.md). Prototype: [proto/](proto/run.mjs). Builds on [sync-lan/CONCEPT.md](../sync-lan/CONCEPT.md) (hub, pairing, trust list) and the LAN rule in [RULES.md](../../RULES.md).

Sven's wish: „Ich benutze Unified Remote, um mit dem Handy meinen PC zu steuern. Das will ich in Nemo haben – die Geräte sind im Netzwerk eh gepaart. Maus steuern, Medien (Ton) steuern: lauter, leiser, nächster Song usw.“

## 0. In one paragraph

A paired Android phone opens a **second, own session** to the PC's existing LAN hub (same listener, same port, same Noise `IK` keys and trust list, own handshake mode, own message tags, never mixed with sync). The PC accepts input only from a device that has the **remote grant**, which is off by default and can be set only at the PC, in two levels: _Medien und Lautstärke_ (no input simulation at all: audio endpoint, media session, lock) and _Maus und Tastatur_ (`SendInput`). Input is accepted only on the stored home network. While a device controls, the PC shows who it is and one click ends it. The phone gets a module `remote` with three pages (Medien, Touchpad, Tastatur). Nothing is read from the PC except volume, mute, playing/paused and locked. Precondition: the phone is paired with this PC's hub, i.e. home-network sync is in use (§7).

## 1. What exists (inventory, verified in code)

| Fact | Where |
|---|---|
| Hub: TCP, `std::net` threads, `u16` length frames, raw Noise (`snow` 0.10, `Noise_IK_25519_ChaChaPoly_BLAKE2s`), prologue `nemo-lan-sync/1` + mode byte (1 pairing, 2 session), `TCP_NODELAY` on both sides | `crates/lan-sync/src/noise/`, `transport/mod.rs`, `transport/client.rs` |
| After the handshake: control tags 1–4, app tags from `0x10`; only `0x10` request / `0x11` response exist; an unknown app tag **closes** the connection | `noise/frame.rs`, `hub/router.rs` (`Connection::on_frame`) |
| Strict lockstep: the phone asks, the hub answers; `LanClient` holds one `Link` behind a mutex, so every request of the phone is serialized; every sync request takes the store mutex | `src/lan_client.rs`, `hub/handler.rs` |
| Limits: 32 connections, 4 per IP, 20 handshakes per IP and minute, idle close after 120 s, frames ≤ 65 535 bytes after the first authenticated frame | `transport/mod.rs`, `hub/router.rs`, `noise/frame.rs` |
| Trust list entry `{ key, name, lastSeen, revoked }`, **no per-device flags**; file `lan-sync/trust.json` (`v: 1`), atomic writes; a revoke closes open sessions, every send/receive re-checks the list | `trust/mod.rs`, `trust/file.rs`, `endpoint.rs` |
| The hub listens only with a paired device or an open pairing window, only on the home network (Windows NLA id), only private IPv4; never on non-Windows | `hub/netpolicy.rs`, `src/lan_sync_net.rs` |
| The hub writes only a reply to a frame (or the pairing key); there is no outbound path, the client is strict request/response; an unknown handshake mode is dropped **silently** (`HandshakeDrop::BadMode`); `SessionRegistry` knows sessions by peer only (closing a peer closes all its sessions); the frame cap is raised to 65 535 only for `Mode::Session` | `transport/mod.rs` (`drive`), `noise/mod.rs` (`raise_cap`), `trust/mod.rs` |
| An open pairing window may listen on the **current** private network, not only the home network | `hub/netpolicy.rs` (`decide`), RULES "LAN sync" |
| The crate forbids `unsafe`, logging, `tokio`, sockets outside `src/transport`, a clock in `src/hub`, and a `tauri` dependency (source-level tests) | `crates/lan-sync/tests/rules.rs` |
| Phone side is Rust behind four commands (`lan_client_*`); the PWA has no LAN client | `src/lan_client.rs`, `core/platform/web.ts` |
| No input simulation, no session-lock detection anywhere; `windows` 0.61 is a dependency but without `Win32_UI_Input_KeyboardAndMouse`; `enigo` is absent | `web/src-tauri/Cargo.toml`, grep |
| Tray icon with a menu filled by the web app; top bar chips `SyncBadge`, `FocusIndicator` | `src/capture.rs`, `web/src/layout/TopBar.tsx` |
| `manifest.platforms` accepts `'web' \| 'desktop' \| 'android'`; no module is phone-only yet (`browser` is `['desktop','android']`); a module may have zero collections (`disk`: `seed: { none: 'live-data' }`) | `core/modules/types.ts`, `modules/disk/manifest.ts` |
| Keep-awake and immersive exist in the seam (`display`), haptics only as bare `navigator.vibrate`, no orientation lock, phone volume keys are not readable | `core/platform/types.ts`, `plugins/screen-mode` |

## 2. Usage picture

Scenes (usage diary: evening, sofa, PC at the desk or at the TV, phone in one hand):

| Scene | Page | What the hand does |
|---|---|---|
| Pause the film, the doorbell rings | Medien | one big button in the thumb zone, found without looking |
| Louder, quieter | the phone's own volume keys while the page is open; Medien | the keys under the finger; or the two widest buttons at the bottom edge |
| Next track, previous track | Medien | left and right of play/pause |
| Click "Skip intro", pick another episode | Touchpad (upright in one hand or sideways) | slide = pointer, tap = click |
| Type a search word | Tastatur | type on the phone, read it, _Senden_ |
| Leave the room | Medien → menu → _PC sperren_ | two taps, no confirmation (locking only ever reduces access) |

**Medien (portrait, one hand, default page).** Lowest row, two wide buttons: _Leiser_ (left) · _Lauter_ (right) – the pair a thumb finds blind, and nothing between them that could be hit by mistake. Row above, three buttons (the FOCUS limit): _Vorheriger_ · _Wiedergabe / Pause_ (large, centre) · _Nächster_. Holding _Leiser_/_Lauter_ repeats the step (at most 5 per second, one haptic tick at the start). _Lauter_ and the phone's volume-up key also lift a mute. Top: one still line – „PC-Sven“ before and without a connection, „PC-Sven · verbunden · Lautstärke 42 %“ with one, „… · Ton aus“ while muted. _Ton aus_ and _PC sperren_ sit in the page menu. While a session is open (all three pages) the phone's volume keys change the PC's volume (switchable), and only then a quiet line under the state says so: „Lautstärketasten steuern den PC“. After an idle close a key press counts as a touch: it reopens the session (always at the media level, so a key never raises a prompt) and is sent. In every other state of the table in §7 the keys stay the phone's own. Every button is ≥ 56 px, has a text label and gives one short haptic tick (switchable).

Honest tap count for "pause, the doorbell rings": wake and unlock the phone, open Nemo, then one tap (home-screen widget of Nemo from package 5, or the module). A control on Android's lock screen or in the notification shade would save the first steps; it is not in this plan (§8).

**Touchpad (the page below the head is the pad; upright or sideways, the page follows the phone; keep-awake; not immersive, so Android's own gestures stay as they are).** Fixed gestures, no settings page needed to learn them (a one-time, dismissible legend on first open):

| Gesture | Action |
|---|---|
| one finger slides | pointer moves (relative; Windows applies its own pointer speed and acceleration, plus one sensitivity setting on the phone) |
| tap | left click |
| two taps | double click (two clicks; the PC decides by its own double-click time) |
| two-finger tap | right click |
| two fingers slide | scroll (vertical and horizontal) |
| hold _Links_, slide on the pad | drag (the left button is down exactly as long as the strip is held) |

Two fixed strips below the pad, _Links_ and _Rechts_, click without the pad. They sit above Android's gesture zone (bottom safe-area inset plus one spacing step), so a tap there never triggers a system gesture. No long-press drag (it collides with a slow pointer move), no pinch, no three-finger gestures in v1.

**Tastatur.** One text field with the focus (`data-autofocus`, the phone's keyboard opens at once; autocorrect, swipe typing, any language). The keyboard's own enter key sends the line **and** Enter (the search-word case in one step); the button _Senden_ sends the line without Enter. While the phone's keyboard is open the page shows only the field and _Senden_. With the keyboard closed it shows the keys: _Enter_ · _Rücktaste_ · _Esc_, then _Tab_ · _Fenster wechseln_ (Alt+Tab) · _Vollbild_ (F11), then one four-way arrow pad. Space, Home, End, page up/down and Entf are in _Mehr_. The field is emptied after sending, has no history and is never stored.

**Stimulus load (FOCUS-GUIDELINES).** No blinking or pulsing connection indicator, no spinner for a reconnect under one second, no sound, no red (nothing here is overdue). The state is one still text line; "not reachable" reads „PC-Sven ist gerade nicht erreichbar. Beide Geräte im selben WLAN?“ with one action _Erneut versuchen_. The session opens when the module comes to the foreground (being on the page is the intent; the home widget connects only on a tap) and ends by itself; after an idle close the line falls back to „PC-Sven“ and the next touch reconnects. The user never manages a connection.

## 3. Transport

### Options

| | Option | For | Against |
|---|---|---|---|
| a | `input` as a new tag in the **existing sync session** | no second connection | input waits behind sync frames and the store mutex (table below, rows 4 and 4b); the phone's `Link` mutex is lockstep; sync code and input code share one dispatch (`Connection::on_frame`), one bug away from each other |
| **b** | **own session on the same listener and port**, same static keys and trust list, own handshake mode byte `3`, own tags (**recommended**) | no new listener, port, firewall prompt or network policy; the mode byte is part of the Noise prologue, so a sync session can never become an input session; input never waits for sync; own limits | one more connection per phone (2 of the 4 per IP); the transport needs an outbound path and a duplex client (below); an older hub drops mode 3 silently |
| c | own port in the same crate | same isolation as b | a second listener to supervise, a second firewall rule, a second place where the bind rule must hold – more attack surface for no gain |
| d | UDP | no head-of-line blocking on a lossy Wi-Fi | new listener type, own replay window for Noise over datagrams, firewall; not needed for the 30 ms goal on a home network |

The RULES sentence "never shares a listener or port with the Local API" is untouched by all four: the Local API stays on loopback.

### Shape of the input session (option b)

- Handshake `Noise_IK` exactly as a sync session, prologue mode byte `3` (`MODE_INPUT`). Only a trust-list device completes it; the per-address handshake limit applies unchanged.
- **Home network only.** Mode 3 is accepted only on a bind of the stored home network. Mechanism (today `netpolicy::decide` does not read the home id while a pairing window is open and returns untagged binds): every bind carries a home flag, computed from the stored network id also while a window is open, fail-closed (id unreadable → no bind is home); the hub checks the flag per accepted connection by the address it came in on. A bind that exists only because a pairing window is open on another private network (allowed for pairing by RULES) drops mode 3. This annotates binds; it changes no bind rule. Settled in package 1a: such a connection gets the same authenticated `unknown-device` refusal as a stranger's key (no session, no transport state), so the phone's "PC too old" check below does not fire for it.
- **No trace of use.** `Session::receive` records `lastSeen` on the first authenticated frame today; an input session never does. `lastSeen` stays what it is: the last sync contact.
- First frame from the phone: `hello` (as today), then `open { level }`. The hub answers `opened` or `refused { code }` and closes. The controller slot is taken only by an accepted `open`, never by a handshake.
- **The session's level is fixed at `open`**: the smaller of the requested level and the device's grant. Every event is checked against that session level (and the grant, which may have been lowered meanwhile); there is no change of level inside a session. A pointer, key or text record on a session opened at `media` closes it, even when the grant is full. The phone opens Medien with `open { media }`; the first use of Touchpad or Tastatur closes that session – only after a needed unlock succeeded, so Medien and the volume keys keep working meanwhile – and opens a new one with `open { full }` (≈ 10 ms; that the slot is free for that moment is accepted, package 1a may keep it for the same device). A full session also carries Medien: going back to Medien keeps it until it is closed or idles, and fires no new notification. Everything the PC ties to "mouse/keyboard" – the notification, the refusal of widenings – keys off the opened level, never off the grant.
- Then **one-way** frames phone → PC, no reply per frame.
- **Everything the PC ever sends to the phone**, complete list: `opened { level, grant, unlockRequired, state }` (`grant` = this device's ceiling, so a phone with a media grant shows the Touchpad/Tastatur line at once, without a prompt or a reopen; `unlockRequired` is true only when the grant is full and the option is on) · `state { volume, mute, playing, locked }` (4 bytes, on change, at most 5 per second) · `refused { code }` / `closed { code }` with the codes `remote-off` (master switch), `not-granted`, `busy` (another device controls), `paused` (ended at the PC), `locked` (PC locked, level not usable), `unsupported` (PC is not Windows), `ended` (ended at the PC during the session), `limit` (flood).
- **Frame cap** of an input session: 256 bytes until its first authenticated frame (as every session), then 512; never 65 535.
- **Transport work this needs** (the hub writes only replies today): a per-connection outbound queue polled on the connection's tick, like the pairing `deliveries` (this is also what caps `state` at 5 per second); a duplex input client under `src/transport/` (reader thread; the lock is never held across a blocking read; still the stateful `TransportState`). `state` frames do not reset the hub's idle timer.
- **Sessions carry their mode in the registry**: ending remote control or switching the master switch off closes input sessions only; revoking a device closes all, as today. The controller slot (`busy`) is part of that registry.
- **Time** enters `input/` as a parameter: `drive` passes a monotonic duration for the buckets (`on_frame` gets wall-clock time today, which may jump); the "no clock" rule test is extended to `src/input`.
- **Targets**: the wire codec of `input/` and the duplex client compile on every target (the client declared through `#[path]` like today's `client`); gate, buckets, slot and registry stay desktop-only with the hub. The rule test `hub_modules_are_compiled_out_on_mobile` is extended accordingly.
- **Older hub**: it drops mode 3 without an answer, which looks like "not reachable". The phone therefore checks: input session fails but the sync session opens → „Nemo auf dem PC ist zu alt für die Fernbedienung. Am PC aktualisieren.“
- **Binary, fixed-size records, no JSON and no free-form strings on the input path**: a frame is a tag and up to 32 records of 4 bytes (`kind`, `a`, `b`, `flags`). Kinds: `move(dx, dy)` (`i8` each), `button(id, down|up)`, `scroll(dx, dy)`, `key(id)` from a fixed enum, `media(id)` from a fixed enum. Text is its own tag: UTF-8, ≤ 256 bytes, control characters refused. An unknown kind, id or tag closes the session.
- A sync session refuses input tags and an input session refuses sync tags (both close). The input handler never touches the store or its mutex.
- Idle close after 120 s (the transport's existing timeout); the next touch reopens (measured session setup ≈ 9 ms locally). One controlling device at a time.

### Latency

Goal for **our part**: pointer event in the page → input applied on the PC in **< 30 ms at p95** on the home Wi-Fi. What the finger feels is longer and not ours to shorten: Android's touch pipeline before the event (about one display frame: 16.7 ms at 60 Hz, 11 ms at 90 Hz, 8 ms at 120 Hz) and the PC's own display. Budget of our part: JS → Rust `invoke` (**unsicher**, not measured) · seal and write (< 1 ms) · Wi-Fi (2–10 ms typical, **unsicher**) · open, check, `SendInput` (< 1 ms).

No timer on the phone: the WebView delivers pointer moves at most once per display frame, so **each pointer event is sent at once** (its coalesced moves summed into one record) – one `invoke` and one network frame per display frame, without the waiting time a bundling timer adds (prototype row 3). Only while a write is still pending do moves keep summing (latest position wins, nothing queues up); clicks and keys are never merged or dropped by the phone.

### Measurement on a real phone (package 3, before the touchpad page)

Tool: Dev-Preview build on the phone → Einstellungen → Entwickler → „Fernbedienung: Latenz messen“ (`pages/settings/RemoteLatencyProbe.tsx`; absent from every other build). It measures what the phone can measure alone, and nothing acts on the PC.

**The question it answers is one: WebView or touch capture in the Kotlin plugin** – so it judges the `invoke`, not a total. Either way crosses the same Wi-Fi.

- **invoke** – one call per pointer event while a finger is down, page → shell → page: `send` for a session number that is never open. The shell goes the way of a real send (command, worker thread, session lookup) and answers `closed` right before it would seal and write. A round trip, so it overstates the one direction a real move needs.
- **invoke budget** – what that call may cost at p95: the goal (30 ms) − one trip to the PC (estimated) − 1 ms on the PC. The tool says "fits", "close" (up to 3 ms over: measure again and try by hand, not the fallback) or "too expensive". No verdict below a hundred calls (a p95 of a handful is just the slowest one). Three leanings: the trip estimate is too high, so the budget is too small – by about 3 ms, an assumption, not a measurement; the measured invoke is a round trip where a move needs one direction (both make the verdict stricter); and it is the best trip held against a p95, which makes the budget more generous.
- **trip, at best (estimate)** – the fastest of up to five opens of a media session ÷ 6 (an open is three exchanges: TCP, handshake, `open`/`opened`). Too high rather than too low: every open also reads two keys from the phone's key store and does the key agreement on both sides, which can add as much per "trip" as the trip itself. The first open of a run that comes about is the warm-up (keys, Wi-Fi waking up, the PC's state read may wait up to 150 ms) and is not counted.
- **spread** – p95 − p50 of those opens: how calm the Wi-Fi is right now. Shown on its own, never divided into a per-trip number.
- **input** – the pointer event's own time stamp → handler: Android, the WebView and the wait for the next display frame, which "send per event" inherits. **events/s** = events the page was handed (about the display rate) = calls the page would make. **overlap** = events that arrived while the previous call was still running (then moves are summed).

Not measured, and left to the touchpad hand test: seal and write on the phone (< 1 ms in the prototype – on one host; a real write blocks while the socket buffer is full, so on bad Wi-Fi the wait becomes per-event latency), `SendInput` on the PC, and the finger-to-pointer feeling as a whole.

Measure twice: near the router and at the far end of the flat. **The run near the router decides**; the far-end run only shows what the Wi-Fi adds (trip, spread) and its verdict does not count.

| Phone, Android, display Hz | Where | invoke p50 / p95 / max ms | invoke budget ms → verdict | events/s | overlap % | input p50 / p95 ms | open p50 / p95 ms | trip ≈ ms | spread ms | Date |
|---|---|---|---|---|---|---|---|---|---|---|
| _to be measured_ | near the router | | | | | | | | | |
| | far end | | | | | | | | | |

Reading (near the router): "fits" → the page sends per pointer event through the WebView as designed. "too expensive" → touch capture moves into the Kotlin plugin (fallback of package 3). "close" → measure again; if it stays close, build the page on the WebView path and let the hand test decide. A large spread or a high trip is the Wi-Fi, not the design, and no reason for the fallback.

### Prototype measurement

`node docs/design/remote-control/proto/run.mjs` (Node ≥ 20, no install): two processes, the PC side and the phone side, over the interface address, with the Noise-_like_ channel of the sync prototype (**not** Noise; the product uses `snow`). The phone generates touchpad moves, the PC measures _event created → applied_ on the shared monotonic clock and "applies" to a virtual cursor (nothing is injected into the OS). Measured 2026-11-10, container, both processes on one host (not real Wi-Fi), 5 rounds × 3 s per variant, Node v22.23.4, Xeon 2.1 GHz:

| Variant | p50 ms | p95 ms | max ms | frames/s | bytes/s | applied/sent |
|---|---|---|---|---|---|---|
| 1 request/response per event (today's command shape), 120 ev/s | 0.34 | 0.52 | 7.25 | 120 | – | 361/361 |
| 2 one-way frame per event, 120 ev/s | 0.32 | 0.46 | 2.6 | 120 | 7208 | 361/361 |
| 3 one-way, bundled every 8 ms, 240 ev/s | 4.57 | 8.65 | 11.76 | 123 | 10166 | 720/720 |
| 4 as 1, while sync pushes hold the same session and lock | 7.41 | 15.08 | 22.29 | 120 | – | 361/361 |
| 4b as 2 on the same session, between sync pushes | 6.66 | 14.75 | 18.22 | 120 | – | 361/361 |
| 5 as 2 on a session of its own, while sync runs | 0.28 | 0.4 | 5.43 | 120 | – | 361/361 |
| session setup (TCP + handshake + hello) | 9.02 | | 11.43 | | | |

Checks, all 5 rounds ok: `refusedWithoutGrant` (a paired device without grant: 0 of 100 events applied), `mediaGrantRejectsPointer` (media grant: 50 media events applied, 50 moves refused), `floodCapped` (5000 events at once: 253 applied, 4747 dropped by the 500/s bucket).

Reading, with the limits of the measurement:

- Rows 4 and 4b contain an **assumption**: the PC holds the connection 15 ms per sync push (`STORE_MS`), standing in for the product's SQLite commit, which was not measured. With `STORE_MS=0` rows 4 and 4b fall to row 2's level. The structural point holds either way: on a shared session input waits exactly as long as the store works; on its own session (row 5) it does not.
- A bundling timer costs its interval (row 3: p95 ≈ one 8 ms tick, free-running, not aligned to the display) – the reason the design sends per pointer event instead.
- The network share and Android's IPC are absent (one host, Node). **unsicher** until measured with a phone: the cost of one `invoke` per frame and Wi-Fi jitter. Package 3 measures both first, before building the page, and has a fallback (touch capture in the Kotlin plugin) if the WebView path misses the goal.
- Rates are small: ≤ 125 frames/s and ≈ 10 kB/s for a moving finger in the prototype's JSON; the binary records are smaller.

## 4. Permission (the core)

**Pairing is not permission.** A paired device may sync; it may control nothing until someone at the PC says so.

| Layer | Rule |
|---|---|
| Master switch | _Fernsteuerung erlauben_ on the PC, **off by default**. Off = the hub answers every `open` with `remote-off` and closes; no input code path is reachable. While it is off the per-device choices are shown but inactive, with one line saying why. |
| Grant per device | One choice per paired device: _Aus_ (default) · _Medien und Lautstärke_ · _Medien, Maus und Tastatur_. |
| Where it lives | In the PC's device-local hub files (`lan-sync/trust.json`: `remote`, `remotePaused`, `remoteUnlock`; the master switch next to it). **Never in synced settings**, never changeable by a network message. Writers, complete list: `remote_set_enabled` (master switch), `remote_set_device` (level, un-pause, unlock option), `remote_end` (sets the pause) – three desktop-only Tauri commands. |
| Widening needs the PC's own dialog | Everything that gives or gives back control is confirmed in a **native dialog shown by Rust** (`tauri-plugin-dialog`, already in the shell): raising a level, switching a paused device on again, switching the master switch on while a grant is stored, switching _Am Handy entsperren_ off. It names the device and its last sync contact: „Svens Handy darf Medien, Maus und Tastatur dieses PCs steuern.“ (media level: „… darf Medien und Lautstärke dieses PCs steuern.“) – _Erlauben_ / _Abbrechen_. Devices with the same name are numbered in the list. The web view alone can only narrow. |
| Not while being controlled | While a session of the level _Medien, Maus und Tastatur_ is open, Rust refuses every widening (`busy-controlled`), checked when the request arrives **and again when the dialog returns**. Otherwise the controlling phone could click Nemo's own dialog – Windows does not protect a normal window from simulated input. |
| Per session or per device | **Provisional: once per device** (the grant is the confirmation). A confirmation at the PC for every session would defeat the sofa case – the PC is across the room. → Question 1. |
| Phone unlock | Medien never asks: it opens a media-level session (the default page must work at once). Opening a full-level session – the first use of Touchpad or Tastatur – asks for the phone's own unlock (fingerprint or device credential) when the PC's `opened.unlockRequired` said so (it is sent on the media open too; should a full `opened` report it although no unlock happened in the window, `remote_client_open` raises the prompt before any send, or closes), **at most once in 8 hours while Nemo keeps running**, not per session (sessions close after 2 idle minutes; asking each time would break the mouse case). The prompt is raised natively inside `remote_client_open` for the level full, not by the page, so the page cannot open a full session around it; the 8-hour window lives only in that process's memory. Option per device on the PC (_Erweitert_ → _Am Handy entsperren_, default on). It is a speed bump of the unmodified app, not a proof the PC can check. |
| Visible state on the PC | While a session is open: **tray icon variant** and tooltip „Fernsteuerung aktiv: Svens Handy“ and first tray menu entry _Fernsteuerung beenden_ – all from Rust-held session state, visible with Nemo's window closed and not removable by the web app (today `desktop_set_tray_labels` and `desktop_set_tray_today` let the web view replace tooltip and menu: both must keep the remote tooltip and entry on every rebuild); plus a still chip in Nemo's top bar („Fernsteuerung: Svens Handy“). Only when a full-level session opens (never for a media-level session, whatever the grant): one quiet system notification („Svens Handy steuert jetzt Maus und Tastatur. Beenden im Tray-Menü.“; at most one per device in 30 minutes – counted in memory only –, no sound, switchable) – tray and chip are easy to miss by a second person at the PC; a media session shows no notification (it would cover the film). |
| One click ends | _Fernsteuerung beenden_ (tray, chip, settings) closes the session **and pauses that device** until someone at the PC switches it on again; the entry says so: „Svens Handy kann erst wieder steuern, wenn du es hier einschaltest.“ The phone then shows „Die Fernbedienung ist am PC pausiert. Am PC unter Einstellungen → Fernsteuerung wieder einschalten.“ Ending from the phone just closes and never pauses. |
| Automatic end | Session: idle 120 s. Revoking the device, rotating the hub key or switching the master switch off ends everything at once. No timed expiry of a grant in v1 (a silent fallback would surprise the owner; the grant is visible and one click away). |
| One controller | One device controls at a time; a second gets `busy`. _Fernsteuerung beenden_ frees the slot. |
| Never in v1 | No screenshots or screen content, no clipboard read or write, no file access, no window titles, no track titles, no key or text echo. PC → phone is exactly the list in §3. |

**Levels and what they can reach**

The second level is called _Medien, Maus und Tastatur_ everywhere in the UI (it includes the first); "mouse/keyboard" below is shorthand for what it adds.

| Level | Actions | How on Windows | Why separate |
|---|---|---|---|
| Medien und Lautstärke | play/pause, next, previous, volume step ±2 %, mute, lock PC | audio endpoint volume (Core Audio), the system's media session controls, `LockWorkStation` – **no `SendInput`, not even media keys** | no pointer, no keys, no text: the worst case is noise and annoyance |
| Medien, Maus und Tastatur | everything above + pointer, buttons, scroll, text, special keys | `SendInput` | equals sitting at the unlocked PC |

**Locked screen.** Windows does not deliver simulated input from a user process to the lock screen's desktop; the product additionally checks the lock state for every event and does not act on pointer, keys or text while it is locked (the phone learns it from the `locked` bit of the state and shows „PC ist gesperrt“; an `open` for the full level is refused with `locked`). **Provisional: media and volume keep working while locked** (music keeps playing behind a locked screen; skipping a track reveals nothing), nothing else does. Unlocking from the phone is never offered. → Question 2. Both media paths are API calls, not simulated keys, so the lock screen's input isolation does not apply to them; **unsicher** until the hand test (package 2): whether every player registers a media session – one that does not cannot be paused from the phone, and the answer to that is a question to Sven, not a silent key fallback.

**Elevated windows.** Windows ignores simulated input from a normal process to elevated windows (UAC prompts, an admin terminal). The product keeps that property: Nemo never runs elevated for this and never requests UI access.

## 5. Threat model

Assets: control of the PC's input (code execution as the user), the user's attention and hearing, the secrecy of typed text, the grant itself.

| Angreifer | Fähigkeit | Gegenmaßnahme | Rest-Risiko |
|---|---|---|---|
| Fremder im WLAN oder Gast | sieht und sendet Pakete, kennt keinen Schlüssel | unverändert LAN-Sync: Noise `IK`, nur Trust-List-Geräte, Handshake-Limit je Adresse, kleine Frames vor der Authentisierung; Modus 3 ohne Schalter = sofortige Ablehnung | Verbindungsversuche kosten etwas CPU (begrenzt) |
| Replay / Injection im LAN | zeichnet Frames auf, spielt sie erneut oder verändert sie | Transport-AEAD mit Zähler: wiederholte, umsortierte oder veränderte Frames schließen die Sitzung; Nachricht 1 ist wiederholbar, bewirkt aber nichts (Eingaben erst nach dem ersten echten Transport-Frame); Modus-Byte im Prolog trennt Sync- und Eingabe-Sitzung | keines bekannt; hängt an `snow` |
| Zweites gekoppeltes Gerät (Mitbewohner) | hat einen gültigen Schlüssel, darf synchronisieren | Freigabe je Gerät, Standard aus, nur am PC setzbar, native Bestätigung; Anzeige nennt das Gerät; ein Controller zur Zeit | wer am entsperrten PC sitzt, kann sich selbst freigeben – der sitzt aber schon am PC |
| Gerät mit voller Freigabe erweitert Rechte | klickt per Maus-Simulation in Nemos eigenen Einstellungen und im Bestätigungsdialog | solange eine Maus/Tastatur-Sitzung offen ist, lehnt Rust jedes Erhöhen, Entpausieren und Lockern ab – geprüft beim Auftrag und noch einmal, wenn der Dialog zurückkommt | nach Sitzungsende kann es nichts mehr klicken; ein Gerät mit voller Stufe kann ohnehin alles, was der Nutzer am PC kann |
| Gerät mit Medien-Freigabe blockiert den Platz | hält die eine Controller-Sitzung offen, der Besitzer bekommt `busy` | Platz erst nach angenommenem `open`; _Beenden_ am PC gibt ihn frei und pausiert das Gerät; Anzeige nennt es | Ärgernis, bis jemand am PC beendet; dasselbe gilt für wiederholtes „PC sperren“ (1 je 10 s) |
| Kompromittierte Web-Ansicht am Handy (XSS) | ruft `remote_client_send` auf | Entsperr-Abfrage sitzt nativ in Rust in `remote_client_open` für die volle Stufe, nicht in der Seite – ohne sie entsteht keine volle Sitzung, und auf einer Medien-Sitzung nimmt der PC keine Zeiger, Tasten oder Texte an; der PC prüft alles Entscheidende selbst; Befehle nur in `capabilities/mobile.json` | Handy-XSS + volle Freigabe + Heimnetz = Kontrolle über den entsperrten PC, sichtbar am PC |
| Gestohlenes oder liegengelassenes entsperrtes Handy | Nemo offen, gültiger Schlüssel und Freigabe | wirkt nur im gespeicherten Heimnetz (Modus 3 wird auch in einem Kopplungsfenster in fremdem Netz verworfen; nur private Gegenstellen); Handy-Entsperren höchstens alle 8 Stunden für die volle Stufe; Anzeige und _Beenden_ am PC; gesperrter PC nimmt nur Medien; Gerät am PC sperren (bestehend) | im Heimnetz, PC entsperrt, volle Freigabe: volle Kontrolle bis jemand am PC beendet – das ist die Funktion; die Handy-Abfrage hält nur die unveränderte App auf |
| Verändertes Handy-Programm mit kopiertem Schlüssel | umgeht alles, was das Handy prüft (Entsperren, Bündeln, Raten) | alles Entscheidende prüft der PC: Schalter, Freigabe, Stufe je Ereignis, Sperrzustand, Raten, feste Listen; Schlüssel liegt im Android-Keystore | gerootetes Handy mit voller Freigabe = volle Stufe; Sperren des Geräts am PC ist die Abhilfe |
| Tastatur als Angriffsweg | tippt Befehle (Ausführen-Dialog, Terminal) | nur volle Stufe; Tasten nur aus fester Liste (keine rohen Tastencodes vom Netz, kein Win+R, keine frei wählbaren Kombinationen); Text ohne Steuerzeichen, Enter ist eine eigene Taste; Limits (unten); gesperrter PC und erhöhte Fenster nehmen nichts an; Anzeige am PC | mit Zeiger + Text ist alles erreichbar, was der Nutzer am PC kann – die Liste bremst, sie verhindert es nicht. Deshalb ist die Stufe eine bewusste, sichtbare, widerrufbare Entscheidung |
| Flut von Ereignissen | hängt den PC auf oder macht ihn unbedienbar | je Sitzung: 500 Ereignisse/s (Token-Eimer, Stoß 250), Klicks 20/s, Tasten 30/s, Text 512 Byte/s, Medien 10/s, Sperren 1 je 10 s; Lautstärke nur in Schritten von 2 %, „lauter“ höchstens 5 Schritte/s (kein Sprung auf 100 %); Überschuss wird verworfen, anhaltende Flut schließt die Sitzung (`limit`) | kurze Störung bis zum Schließen; ein Gerät mit Medien-Freigabe kann in etwa 10 Sekunden auf volle Lautstärke drehen – deshalb ist auch die Medien-Stufe eine Freigabe |
| Kompromittierte Web-Ansicht am PC (XSS) | ruft Tauri-Befehle auf | alles, was Kontrolle gibt oder zurückgibt (erhöhen, Pause aufheben, Hauptschalter an, Entsperren aus), braucht den nativen Dialog aus Rust; es gibt **keinen** Befehl „Eingabe simulieren“ für die Web-Ansicht – der Weg vom Netz zur Eingabe läuft nur in Rust | kann Freigaben senken, pausieren oder die Anzeige im Fenster stören; Tray-Symbol, Tooltip und „Beenden“ kommen aus Rust und überstehen jeden Neuaufbau des Tray-Menüs durch die Web-Ansicht |
| Kompromittierter Nemo-Prozess am PC | läuft als der Nutzer | – (jeder Prozess des Nutzers kann `SendInput` selbst aufrufen; die Fernsteuerung gibt ihm nichts Neues) | wie bisher; Signatur und Updater-Regeln unverändert |
| Mitleser auf dem Handy oder PC (Logs, Absturzbericht, Diagnose) | liest, was protokolliert wurde | nichts wird protokolliert: keine Tasten, kein Text, keine Koordinaten, keine Ereignisse, keine Zeitpunkte – auch `lastSeen` wird von einer Eingabe-Sitzung nicht geschrieben (Quelltext-Test wie `tests/rules.rs`); Textfeld ohne Verlauf und ohne Lesehilfe; Diagnose-Negativliste um die Fernsteuerung erweitert | Tastatur-App des Handys sieht den Text wie jeden anderen |
| PC als Angreifer gegen das Handy | sendet Zustands-Frames | 4 Byte fester Aufbau, Werte geklemmt, höchstens 5 je Sekunde | keines bekannt |

**Logging – wording as proposed (background; the rule in force is [rules/remote-control.md](../../rules/remote-control.md)):** "Never log, store, count per key, or put into diagnostics, crash reports or telemetry any remote-control input: no key, no text, no pointer coordinate, no click, no media command, and no time of use. An input session leaves no trace, not even the trust list's `lastSeen`. The only remote-control state the PC ever stores is the master switch and, per device, the grant level, the pause flag and the unlock option; throttles (the phone's unlock window, the PC's notification limit) live in memory only. The phone stores its module settings (sensitivity, haptics, switches), nothing about use."

### Proposed rule lines

In force since package 0 (2026-11-10): the full text is in [rules/remote-control.md](../../rules/remote-control.md) (own file, RULES.md is at its size budget); the root line was shortened for the start-context budget without dropping a rule.

Root `CLAUDE.md` (one line, after "LAN sync"):

> **Remote control (phone → PC input):** pairing is not permission; input only over the LAN hub's own session mode (never the sync session, never a new listener, never the Local API), only on the stored home network and only for a device whose remote grant was switched on at the PC (off by default, device-local, never synced, never set over the network, every widening confirmed in a native dialog and never while a mouse/keyboard session is open); levels media/volume (no input simulation) and mouse/keyboard are separate; always visible on the PC with one click to end; fixed key and media lists, rate limits; never screen, clipboard, files or titles; never log input; simulation only in `crates/remote-input`, Windows only, no Tauri command simulates input. Full text: `docs/RULES.md`.

`docs/RULES.md` (full text):

> **Remote control (desktop is the target, Android the controller):** a paired device controls nothing by pairing alone. Input travels only in the LAN hub's input session (handshake mode 3 on the hub's listener: same keys, trust list, bind rules and limits as LAN sync; never a listener, port or bind address of its own, never the Local API; accepted only on the stored home network, never on a network that is listened on only for an open pairing window; frames ≤ 512 bytes; home binds are flagged from the stored network id, fail-closed); a sync session never carries input and an input session never carries sync data or touches the store. The hub accepts it only while the PC's master switch is on and only from a device whose grant is set – both off by default, stored device-local on the PC, never synced, never changeable by a network message; every widening (raising a level, un-pausing, master switch on with a stored grant, loosening an option) is confirmed in a native dialog shown by Rust and refused while a mouse/keyboard session is open, checked again when the dialog returns. Two levels: media/volume/lock (API calls only, no simulated input, no media keys) and mouse/keyboard; a session's level is fixed when it opens (the smaller of request and grant) and checked per event on the PC, as are the lock state (locked: at most media/volume), the rate limits and the fixed lists (keys and media commands are enum ids, never raw key codes; text has no control characters). While a device controls, the PC shows which one (tray, from Rust-held state the web view cannot remove) and one click ends it and pauses that grant. Never screen content, clipboard, files, window or track titles in either direction. Never log, store or put into diagnostics any input (no key, text, coordinate, click or time of use – an input session does not update `lastSeen`); the only remote-control state stored on the PC is the master switch and per device the level, the pause flag and the unlock option; throttles live in memory only. The phone's commands are granted to the phone only (`capabilities/mobile.json`). Input simulation lives only in `crates/remote-input` (Windows only; other systems answer `unsupported`; never on Android), is reached only from the hub's input session, and no Tauri command simulates input. `crates/lan-sync` stays free of `unsafe`, logging and OS input APIs.

## 6. PC side (Rust)

**Crates**

| Crate | Gets | Never gets |
|---|---|---|
| `crates/lan-sync` | module `input/`: wire codec (all targets); mode 3 acceptance, grant and level gate, rate limits, session state (desktop, pure, time as a parameter, tested on Linux); a trait `InputSink` it owns and calls; trust list fields; outbound queue and the duplex input client under `src/transport/` | OS input APIs, `unsafe`, logging (its `tests/rules.rs` stays as is and gains input cases) |
| **new** `crates/remote-input` | the `InputSink` for Windows: `SendInput`, audio endpoint volume, media session commands, `LockWorkStation`, lock-state query; it owns **one worker thread** (COM/WinRT initialised there, typed commands over a channel, cached volume and lock state) so a hub connection thread never blocks on the system; `cfg(not(windows))` → `unsupported` | sockets, `tauri`, `serde`, any decoding of network bytes (it takes typed enums only) |
| shell `src/remote.rs`, `src/remote_client.rs` | thin commands, tray state, native confirmation dialog; implements `InputSink` by forwarding to `remote-input` (which has its own enums and no dependency on `lan-sync`) | logic |

"The crate that listens cannot simulate input; the crate that simulates input cannot listen."

**Input simulation: `windows` crate vs `enigo`**

| | `windows` (direct `SendInput`) | `enigo` |
|---|---|---|
| Dependency | already in the tree (0.61); one more feature `Win32_UI_Input_KeyboardAndMouse` (+ audio and media features) | new crate plus its own dependencies; not in `Cargo.lock` today |
| Licence gate (`check:licenses`) | nothing new | MIT per its manifest (**unsicher**, to verify if ever chosen) |
| Surface | exactly the calls we use, ≈ 200 lines with `// SAFETY:` notes | a general "press any key, type any text" API on every OS – the opposite of fixed lists; Linux/macOS back ends we would ship unused |
| Maintenance | Microsoft's bindings, Dependabot | community project |

**Recommendation: `windows` directly**, in the new crate. Linux and macOS: later; the sink answers `unsupported`, the settings section says so.

**Mapping**

| Wire | Windows |
|---|---|
| `move(dx, dy)` | `SendInput` `MOUSEEVENTF_MOVE` (relative; the system's pointer speed and acceleration apply); the phone's sensitivity factor is applied before sending |
| `button(left\|right, down\|up)` | `MOUSEEVENTF_LEFTDOWN/UP`, `RIGHTDOWN/UP`; a double click is two clicks; a button still down when the session ends is released by the PC |
| `scroll(dx, dy)` | `MOUSEEVENTF_WHEEL` / `HWHEEL`; one wire unit = 15 of the system's delta (8 units = one notch of 120); `dy > 0` moves the view down, `dx > 0` to the right |
| text | `KEYEVENTF_UNICODE` per UTF-16 unit, down and up |
| `key(id)` | fixed enum → virtual key(s): Enter, Esc, Backspace, Tab, Space, arrows, Home, End, PageUp, PageDown, Delete, F11, Alt+Tab – exactly the keys of the page in §2; modifiers are pressed and released inside one call, never left down |
| `media(id)` | play/pause, next, previous: the system's media session controls (the current session); volume ±, mute: default audio endpoint (step 2 %). No `VK_MEDIA_*`/`VK_VOLUME_*` keys – they would be simulated input |
| lock | `LockWorkStation` (an API call, not Win+L) |

**Tauri commands (minimal).** Desktop, `capabilities/desktop.json`: `remote_status` (master switch, active device, paused devices), `remote_set_enabled`, `remote_set_device` (level, un-pause, unlock option; every widening shows the native dialog), `remote_end`. Phone, `capabilities/mobile.json` and the `cfg(mobile)` handler only (not `default.json`, where the `lan_client_*` commands sit for the second PC): `remote_client_open` (hub, level, state channel; never prompts for the media level; for the level full it raises the unlock natively first when required, §4), `remote_client_send` (one bundle), `remote_client_close`. All in `build.rs` `COMMANDS`. `tests/commands.rs` pins the desktop commands today; it does not read the mobile handler or `mobile.json` yet – package 2 extends it (and asserts the phone commands are absent from `default.json` and `desktop.json`). There is no command that takes an input event on the desktop.

## 7. Phone side (module) and the PC's settings

**Precondition.** Remote control needs the phone paired with this PC's hub, and pairing today means home-network sync: a PC that syncs through an own server, or that is itself paired as a client of another PC, has no hub and cannot be controlled. "Pairing for remote control without sync" is not in this plan (§8).

**Cut.** The PC needs no module: its part is a settings section _Fernsteuerung_ (category `verbindungen`, shown where `lanHub.supported`; `maturity: 'preview'` until package 5): master switch, per paired device one choice of three, _Erweitert_ with _Am Handy entsperren_, _Fernsteuerung beenden_ with its hint, paused devices, a link to the pairing section; without a hub one sentence and the link. The phone gets the module.

| Manifest | Value | Note |
|---|---|---|
| `id` | `remote` | UI name „Fernbedienung“ (decided); the PC's setting stays „Fernsteuerung erlauben“ |
| `platforms` | `['android']` | valid (`PlatformKind`); the first phone-only module; `'pwa'` is not a value and the browser has no LAN client. A second PC as controller: later |
| `area`, `order` | `system`, 198 | after `disk` (190) and `downloads` (195), both desktop-only – on the phone it is the area's only module |
| `identity` | hue `fern`, head `schreib` (compact: the page is a work surface), widget `status`, signature new mark `touchpad` | neighbour rule: not `slate`/`cobalt` (area), not head `fokus` (neighbour `downloads`); `fern` is a primary hue only in `pantry` (other head, other widget). `check:modules` is the judge; if identity 4.0 lands first, package 2 follows it |
| `layout` | `full` | the touchpad needs the screen |
| collections | none | `dataSchema: { collections: {} }`, `dataApi: false`, id in `BLOCKED_MODULES`, no `aiSchema`, not `searchable` – like `disk` |
| `seed` | `{ version: 1, dependsOn: [], none: 'live-data' }` | demo state: the E2E/dev fake of the platform service (`fakeRemote.ts`) offers „PC-Sven“ with volume 42 %; a real build without a paired PC shows the empty state |
| settings | sensitivity, haptics on/off, keep screen on | harmless, may sync; nothing about grants |
| `contributions` | `onboarding: noOnboarding`; no `attention`, no notifications, no calendar items | nothing here is ever urgent |
| `maturity` | `preview` until package 5 | |

Pages: `PageHeader`/`PageTitle` with three tabs _Medien_ (default) · _Touchpad_ · _Tastatur_. Device choice: the paired hub (one today); with several later, a `GroupedList`. Every state is one sentence and one next step:

| State | Sentence | Step |
|---|---|---|
| no PC paired (also: sync through a server) | „Noch kein PC gekoppelt. Die Fernbedienung braucht die Kopplung im Heimnetz.“ | _PC koppeln_ |
| not reachable | „PC-Sven ist gerade nicht erreichbar. Beide Geräte im selben WLAN?“ | _Erneut versuchen_ |
| `remote-off`, `not-granted` | „Am PC ist die Fernsteuerung für dieses Handy aus. Am PC unter Einstellungen → Fernsteuerung dieses Handy erlauben.“ | _Erneut versuchen_ |
| media granted, on Touchpad or Tastatur (the tabs stay, with this line) | „Maus und Tastatur sind am PC für dieses Handy aus.“ | _Zu Medien_ |
| unlock needed (prompt dismissed or failed; the pad stays visible and still, Medien stays usable) | „Maus und Tastatur brauchen einmal dein Entsperren.“ | _Entsperren_ |
| no screen lock set up on the phone | „Dieses Handy hat keine Bildschirmsperre. Maus und Tastatur gehen ohne Entsperren.“ (a fact line, nothing is blocked) | – |
| `paused`, `ended` | „Die Fernbedienung ist am PC pausiert. Am PC unter Einstellungen → Fernsteuerung wieder einschalten.“ | _Erneut versuchen_ |
| `busy` | „Gerade steuert ein anderes Gerät den PC.“ | _Erneut versuchen_ |
| the PC refuses the input session, sync works (`UnknownDevice`: the PC is not on its home network right now, or takes no remote control; if sync says "unpaired" too, it is the first row) | „PC-Sven nimmt hier gerade keine Fernbedienung an. Ist der PC im Heimnetz?“ – never a reason to unpair | _Erneut versuchen_ |
| `locked` (Touchpad, Tastatur) | „PC ist gesperrt. Medien und Lautstärke gehen weiter.“ | _Zu Medien_ |
| `unsupported` | „Dieser PC lässt sich nicht fernsteuern (nur Windows).“ | _Modul ausschalten_ |
| PC too old (the PC hangs up without an answer twice, a few seconds apart, while sync works) | „Nemo auf dem PC ist zu alt für die Fernbedienung. Am PC aktualisieren.“ | _Erneut versuchen_ |
| `limit` | „Verbindung kurz unterbrochen.“ | _Erneut versuchen_ |

**Platform seam.** New services `remoteHost` (desktop) and `remote` (phone) in `core/platform`, pattern of `system`: contract, Tauri bridge, web stub `unsupported`, E2E fake. Hotspot: one chat at a time.

**Widget.** Catalogue type `StatusWidget`: icon, state „PC-Sven“ (only while a session is open: „verbunden · Lautstärke 42 %“ – the number has its context and is never stale), **one** action _Wiedergabe / Pause_. More media buttons are not possible in `StatusWidget` (one action) and not wanted on the home screen; the `cover` variant with controls belongs to the music module. The widget opens no connection by being shown; only the tap does. A tap that cannot be carried out shows that state's sentence from the table above in the widget, and its step opens the module; the next tap or opening the module returns the widget to „PC-Sven“. Empty: „Noch kein PC gekoppelt.“ + _PC koppeln_.

**Focus checklist (FOCUS-GUIDELINES 1–9)**

| # | Answer |
|---|---|
| 1 Stimulus | one module on the phone, one settings section and one chip on the PC; the chip exists only during a session. Nothing moves, blinks or sounds |
| 2 Off switch | master switch (PC), module can be switched off (phone), haptics, keep-awake, volume keys and the PC's notification switchable; defaults: everything off on the PC |
| 3 Next step | one primary action per page (play/pause; the pad itself; _Senden_); empty and refused states name one step |
| 4 Wording | calm, no warning tone: „PC ist gesperrt. Medien und Lautstärke gehen weiter.“ |
| 5 Interruption | a call or a dark screen ends the session; reopening the page continues without questions; typed, unsent text stays in the field until the page is left |
| 6 Tests | Rust: gate, codec, limits, rules; unit: gestures → records; e2e with the fake: switches, refused states, reduced motion, AA |
| 7 Readability | every state as text + icon, never colour alone; buttons labelled |
| 8 Clicks | pause: 1 tap in the module or on Nemo's home widget (after waking the phone and opening Nemo, §2); volume: 0 taps (phone keys); search word: type + keyboard enter; grant on the PC: master switch + 1 choice + 1 confirmation, once |
| 9 Removed instead | no connection screen, no device scanner, no gesture settings, no connection log |

## 8. Out of scope

No screen sharing or screenshots · no file transfer · no clipboard · no Wake-on-LAN (later; needs the PC's MAC and a broadcast) · no macros, custom buttons or app-specific remotes · no Linux/macOS target · no iOS or browser controller · no control from outside the home network · no unlock of the PC · no control on Android's lock screen or in the notification shade (later, own package: the biggest step still missing for "pause at once") · no pairing for remote control without home-network sync · no track titles or covers (the music module's now-playing is the place for that).

## 9. Prototype

Files: [proto/run.mjs](proto/run.mjs) (runner, table), [proto/pc.mjs](proto/pc.mjs) (session, grant, level gate, rate bucket, virtual cursor), [proto/phone.mjs](proto/phone.mjs) (move generator, the five variants, the three checks). It reuses [`sync-lan/proto/channel.mjs`](../sync-lan/proto/channel.mjs). Left out on purpose: real input simulation, real Wi-Fi, Android IPC, mode byte 3, the binary record format (the prototype sends JSON), the native dialog. Results: §3. The checks show that the gate logic is simple to state, not that a product implementation is secure.

## 10. Package plan

[PACKAGES.md](PACKAGES.md): 0 rules (docs) → 1a hub: input session and grant → 1b PC: media sink, settings, visible state → 2 phone: module with _Medien_ and volume keys → 3 touchpad → 4 keyboard → 5 widget and polish. One package = one chat, one PR, a stop after each. Never parallel to an open LAN-sync package (hotspot `crates/lan-sync`).

## 11. Decided (2026-11-10)

1. Transport: own input session on the hub's listener, handshake mode 3, home network only, binary one-way records, frames ≤ 512 bytes (§3 option b).
2. Grant: master switch + one choice per device, two levels, PC-only, device-local, native confirmation for every widening, none while a mouse/keyboard session is open; once per device.
3. Media level without any simulated input (no media-key fallback); lock PC belongs to it.
4. Locked PC: media and volume continue, everything else is refused.
5. PC end = close + pause that device; idle close 120 s; no timed expiry of grants; one controller at a time.
6. PC → phone: the list in §3 – nothing else.
7. Input simulation with the `windows` crate in a new crate `crates/remote-input` (own worker thread); no `enigo`; Windows only.
8. Phone: module `remote`, `platforms: ['android']`, area System, no collections; PC: settings section, no module. Needs home-network sync pairing.
9. Keyboard: line mode + fixed special keys, built in package 4.
10. A session's level is fixed at `open`; Medien opens at the media level, Touchpad/Tastatur reopen at the full level. Phone unlock before a full-level open, at most once in 8 hours (memory only), native, default on, option on the PC; Medien never asks.
11. Touchpad: follows the phone's orientation, not immersive; drag by holding _Links_; moves sent per pointer event, no timer.
12. PC notification only for the full level; tray icon variant from the first PC package on.

## 12. Fragen an Sven (Empfehlung zuerst) – answered 2026-11-10: 1 einmal je Gerät · 2 ja, nur Medien · 3 eigenes Paket 4 · 4 Modul „Fernbedienung“, Einstellung „Fernsteuerung erlauben“

1. **Freigabe je Gerät oder je Sitzung?** Empfehlung: **einmal je Gerät** am PC einschalten (mit Bestätigung), danach ohne Rückfrage – vom Sofa aus kann niemand am PC bestätigen; der PC zeigt, wer steuert, und _Beenden_ pausiert das Gerät. Alternative: Maus und Tastatur jede Sitzung am PC bestätigen (sicherer, auf dem Sofa unbrauchbar).
2. **Medien und Lautstärke auch bei gesperrtem PC?** Empfehlung: **ja** (Musik läuft hinter dem Sperrbildschirm weiter; Schaden höchstens Lärm), Maus und Tastatur nie. Alternative: bei gesperrtem PC gar nichts.
3. **Tastatur in v1?** Empfehlung: **eigenes Paket 4 nach dem Touchpad** – Medien (Pakete 1a, 1b, 2) ist allein schon nutzbar, die Tastatur ist der heikelste Teil und bekommt ihren eigenen Council. Alternative: Tastatur zusammen mit dem Touchpad (ein Paket weniger, größerer PR).
4. **Name des Moduls?** Empfehlung: **„Fernbedienung“** (das Ding in der Hand, wie am Fernseher; passt zum Handy-Modul); die Einstellung am PC heißt „Fernsteuerung erlauben“ (der Vorgang). Alternative: beides „Fernsteuerung“.
