# Remote control – the phone steers the PC over the paired home network (concept)

Branch `design/remote-control-concept`, 2026-11-10. Status: **concept, no product code**; every decision in §11 is provisional until Sven answers §12. Packages: [PACKAGES.md](PACKAGES.md). Prototype: [proto/](proto/run.mjs). Builds on [sync-lan/CONCEPT.md](../sync-lan/CONCEPT.md) (hub, pairing, trust list) and the LAN rule in [RULES.md](../../RULES.md).

Sven's wish: „Ich benutze Unified Remote, um mit dem Handy meinen PC zu steuern. Das will ich in Nemo haben – die Geräte sind im Netzwerk eh gepaart. Maus steuern, Medien (Ton) steuern: lauter, leiser, nächster Song usw.“

## 0. In one paragraph

A paired Android phone opens a **second, own session** to the PC's existing LAN hub (same listener, same port, same Noise `IK` keys and trust list, own handshake mode, own message tags, never mixed with sync). The PC accepts input only from a device that has the **remote grant**, which is off by default and can be set only at the PC, in two levels: _Medien und Lautstärke_ (no input simulation at all: audio endpoint, media session, lock) and _Maus und Tastatur_ (`SendInput`). While a device controls, the PC shows who it is and one click ends it. The phone gets a module `remote` with three pages (Medien, Touchpad, Tastatur). Nothing is read from the PC except volume, mute, playing/paused and locked.

## 1. What exists (inventory, verified in code)

| Fact | Where |
|---|---|
| Hub: TCP, `std::net` threads, `u16` length frames, raw Noise (`snow` 0.10, `Noise_IK_25519_ChaChaPoly_BLAKE2s`), prologue `nemo-lan-sync/1` + mode byte (1 pairing, 2 session), `TCP_NODELAY` on both sides | `crates/lan-sync/src/noise/`, `transport/mod.rs`, `transport/client.rs` |
| After the handshake: control tags 1–4, app tags from `0x10`; only `0x10` request / `0x11` response exist; an unknown app tag **closes** the connection | `noise/frame.rs`, `hub/router.rs` (`Connection::on_frame`) |
| Strict lockstep: the phone asks, the hub answers; `LanClient` holds one `Link` behind a mutex, so every request of the phone is serialized; every sync request takes the store mutex | `src/lan_client.rs`, `hub/handler.rs` |
| Limits: 32 connections, 4 per IP, 20 handshakes per IP and minute, idle close after 120 s, frames ≤ 65 535 bytes after the first authenticated frame | `transport/mod.rs`, `hub/router.rs`, `noise/frame.rs` |
| Trust list entry `{ key, name, lastSeen, revoked }`, **no per-device flags**; file `lan-sync/trust.json` (`v: 1`), atomic writes; a revoke closes open sessions, every send/receive re-checks the list | `trust/mod.rs`, `trust/file.rs`, `endpoint.rs` |
| The hub listens only with a paired device or an open pairing window, only on the home network (Windows NLA id), only private IPv4; never on non-Windows | `hub/netpolicy.rs`, `src/lan_sync_net.rs` |
| The crate forbids `unsafe`, logging, `tokio`, sockets outside `src/transport`, and a `tauri` dependency (source-level tests) | `crates/lan-sync/tests/rules.rs` |
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
| Louder, quieter, mute | Medien, later the phone's own volume keys (package 5) | − / + next to the thumb; each tap one step |
| Next track, previous track | Medien | left and right of play/pause |
| Click "Skip intro", pick another episode | Touchpad (phone held sideways) | slide = pointer, tap = click |
| Type a search word | Tastatur | type on the phone, read it, _Senden_ |
| Leave the room | Medien → _PC sperren_ | one tap, no confirmation (locking only ever reduces access) |

**Medien (portrait, one hand, default page).** Bottom third, three buttons in a row (the FOCUS limit): _Zurück_ · _Wiedergabe / Pause_ (large, centre) · _Weiter_. Above it one row: _Leiser_ · _Ton aus_ · _Lauter_. Top: one still line „PC-Sven · verbunden · Lautstärke 42 %“. _PC sperren_ sits in the page menu. Every button is ≥ 56 px, has a text label and gives one short haptic tick (switchable).

**Touchpad (landscape, the whole screen is the pad, immersive, keep-awake).** Fixed gestures, no settings page needed to learn them (a one-time, dismissible legend on first open):

| Gesture | Action |
|---|---|
| one finger slides | pointer moves (relative; Windows applies its own pointer speed and acceleration, plus one sensitivity setting on the phone) |
| tap | left click |
| two taps | double click (two clicks; the PC decides by its own double-click time) |
| two-finger tap | right click |
| two fingers slide | scroll (vertical and horizontal) |
| long press, then slide | drag (left button held until the finger lifts; one haptic tick when it engages) |

Two fixed strips at the bottom edge, _Links_ and _Rechts_, click without the pad (findable by the edge of the phone, for use without looking). No pinch, no three-finger gestures in v1.

**Tastatur.** One text field, the phone's own keyboard (autocorrect, swipe typing, any language), and _Senden_: the line is typed on the PC as text. Below it one row of special keys in groups of three: _Enter_ · _Löschen_ · _Esc_ / _Tab_ · arrow keys / _Fenster wechseln_ (Alt+Tab). The field is emptied after sending, has no history and is never stored.

**Stimulus load (FOCUS-GUIDELINES).** No blinking or pulsing connection indicator, no spinner for a reconnect under one second, no sound, no red (nothing here is overdue). The state is one still text line; "not reachable" reads „PC-Sven ist gerade nicht erreichbar. Beide Geräte im selben WLAN?“ with one action _Erneut versuchen_. The session opens with the first touch and ends by itself; the user never manages a connection.

## 3. Transport

### Options

| | Option | For | Against |
|---|---|---|---|
| a | `input` as a new tag in the **existing sync session** | no second connection | input waits behind sync frames and the store mutex (table below, rows 4 and 4b); the phone's `Link` mutex is lockstep; sync code and input code share one dispatch (`Connection::on_frame`), one bug away from each other |
| **b** | **own session on the same listener and port**, same static keys and trust list, own handshake mode byte `3`, own tags (**recommended**) | no new listener, port, firewall prompt or network policy; the mode byte is part of the Noise prologue, so a sync session can never become an input session; an older hub refuses mode 3 cleanly; input never waits for sync; own limits | one more connection per phone (2 of the 4 per IP) |
| c | own port in the same crate | same isolation as b | a second listener to supervise, a second firewall rule, a second place where the bind rule must hold – more attack surface for no gain |
| d | UDP | no head-of-line blocking on a lossy Wi-Fi | new listener type, own replay window for Noise over datagrams, firewall; not needed for the 30 ms goal on a home network |

The RULES sentence "never shares a listener or port with the Local API" is untouched by all four: the Local API stays on loopback.

### Shape of the input session (option b)

- Handshake `Noise_IK` exactly as a sync session, prologue mode byte `3` (`MODE_INPUT`). Only a trust-list device completes it; the per-address handshake limit applies unchanged.
- First frame from the phone: `hello` (as today), then `open { level }`. The hub answers `opened { level, state }` or `refused { code }` and closes. Codes: `remote-off` (master switch), `not-granted`, `busy` (another device controls), `paused` (ended at the PC), `unsupported` (not Windows).
- Then **one-way** frames phone → PC, no reply per frame. PC → phone only `state` (volume, mute, playing, locked – 4 bytes) on change, at most 4 per second, and `closed { code }`.
- **Binary, fixed-size records, no JSON and no free-form strings on the input path**: a frame is a tag and up to 32 records of 4 bytes (`kind`, `a`, `b`, `flags`). Kinds: `move(dx, dy)` (`i8` each), `button(id, down|up)`, `scroll(dx, dy)`, `key(id)` from a fixed enum, `media(id)` from a fixed enum. Text is its own tag: UTF-8, ≤ 256 bytes, control characters refused. An unknown kind, id or tag closes the session.
- A sync session refuses input tags and an input session refuses sync tags (both close). The input handler never touches the store or its mutex.
- Idle close after 120 s (the transport's existing timeout); the next touch reopens (measured session setup ≈ 9 ms locally). One controlling device at a time.

### Latency

Goal: finger moves → pointer moves in **< 30 ms at p95** on the home Wi-Fi. Budget: WebView touch event to JS (one frame, 8–16 ms, not ours) · JS → Rust `invoke` per bundle · seal and write (< 1 ms) · Wi-Fi (2–10 ms typical, **unsicher**) · open, check, `SendInput` (< 1 ms). Events are **bundled per animation frame** on the phone (one `invoke` and one network frame per display frame, moves of one frame summed), which caps the rate at the display rate and keeps the per-event cost off the IPC bridge. When a write is still pending, moves keep summing (latest position wins, nothing queues up); clicks and keys are never merged or dropped by the phone.

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
- The network share is absent (one host). Bundling adds its interval (row 3: p95 ≈ one 8 ms tick), which leaves ≥ 20 ms of the budget for Wi-Fi. **unsicher** until measured with a phone: the cost of one `invoke` per frame on Android and Wi-Fi jitter; package 3 measures both with a hand test and has a fallback (touch capture in the Kotlin plugin) if the WebView path misses the goal.
- Rates are small: ≤ 125 frames/s and ≈ 10 kB/s for a moving finger.

## 4. Permission (the core)

**Pairing is not permission.** A paired device may sync; it may control nothing until someone at the PC says so.

| Layer | Rule |
|---|---|
| Master switch | _Fernsteuerung erlauben_ on the PC, **off by default**. Off = the hub refuses mode 3 (`remote-off`) and no input code path is reachable. |
| Grant per device | Each paired device: _Aus_ (default) · _Medien und Lautstärke_ · _Medien, Maus und Tastatur_. Two switches in the UI; the second needs the first. |
| Where it lives | In the PC's device-local hub files (`lan-sync/trust.json` field `remote`, master switch next to it). **Never in synced settings**, never changeable by any network message, never by the phone. The only writers are two desktop-only Tauri commands. |
| Raising a grant | Confirmed in a **native dialog shown by Rust** (like the disk module's second confirmation is checked in Rust), naming the device: „Svens Handy darf Maus und Tastatur dieses PCs steuern.“ The web view alone cannot raise a grant. Lowering needs no confirmation. |
| Per session or per device | **Provisional: once per device** (the grant is the confirmation). A confirmation at the PC for every session would defeat the sofa case – the PC is across the room. Offered instead per device: _Jedes Mal am PC bestätigen_ (off by default) for people who want it. → Question 1. |
| Phone unlock | For the full level the phone asks for its own unlock (fingerprint or device credential) once per session when the PC-side option _Am Handy entsperren_ is on (default on). This is a speed bump enforced by the phone app, not a proof the PC can check. |
| Visible state on the PC | While a session is open: tray icon variant and tooltip „Fernsteuerung aktiv: Svens Handy“, first tray menu entry _Fernsteuerung beenden_, a still chip in Nemo's top bar, and one quiet system notification when a device starts controlling (at most one per device per 30 minutes, no sound). Not hideable for the full level. |
| One click ends | _Fernsteuerung beenden_ (tray, chip, settings) closes the session **and pauses that device's grant** until someone at the PC switches it on again. Ending from the phone just closes. |
| Automatic end | Session: idle 120 s. Grant _Maus und Tastatur_: falls back to _Medien und Lautstärke_ after 30 days without use. Revoking the device, rotating the hub key or switching the master switch off ends everything at once. |
| One controller | One device controls at a time; a second gets `busy`. |
| Never in v1 | No screenshots or screen content, no clipboard read or write, no file access, no window titles, no track titles, no key or text echo. PC → phone is exactly: volume, mute, playing/paused, locked. |

**Levels and what they can reach**

| Level | Actions | How on Windows | Why separate |
|---|---|---|---|
| Medien und Lautstärke | play/pause, next, previous, volume step ±2 %, mute, lock PC | audio endpoint volume (Core Audio), media session controls or the fixed media virtual keys, `LockWorkStation` | no pointer, no keys, no text: the worst case is noise and annoyance |
| Maus und Tastatur | everything above + pointer, buttons, scroll, text, special keys | `SendInput` | equals sitting at the unlocked PC |

**Locked screen.** Windows does not deliver simulated input from a user process to the lock screen's desktop; the product additionally checks the lock state and refuses pointer, keys and text with `locked` (the phone shows „PC ist gesperrt“). **Provisional: media and volume keep working while locked** (music keeps playing behind a locked screen; skipping a track reveals nothing), nothing else does. Unlocking from the phone is never offered. → Question 2. **unsicher** until the hand test in package 1: whether every media path behaves the same behind the lock screen.

**Elevated windows.** Windows ignores simulated input from a normal process to elevated windows (UAC prompts, an admin terminal). The product keeps that property: Nemo never runs elevated for this and never requests UI access.

## 5. Threat model

Assets: control of the PC's input (code execution as the user), the user's attention and hearing, the secrecy of typed text, the grant itself.

| Angreifer | Fähigkeit | Gegenmaßnahme | Rest-Risiko |
|---|---|---|---|
| Fremder im WLAN oder Gast | sieht und sendet Pakete, kennt keinen Schlüssel | unverändert LAN-Sync: Noise `IK`, nur Trust-List-Geräte, Handshake-Limit je Adresse, kleine Frames vor der Authentisierung; Modus 3 ohne Schalter = sofortige Ablehnung | Verbindungsversuche kosten etwas CPU (begrenzt) |
| Replay / Injection im LAN | zeichnet Frames auf, spielt sie erneut oder verändert sie | Transport-AEAD mit Zähler: wiederholte, umsortierte oder veränderte Frames schließen die Sitzung; Nachricht 1 ist wiederholbar, bewirkt aber nichts (Eingaben erst nach dem ersten echten Transport-Frame); Modus-Byte im Prolog trennt Sync- und Eingabe-Sitzung | keines bekannt; hängt an `snow` |
| Zweites gekoppeltes Gerät (Mitbewohner) | hat einen gültigen Schlüssel, darf synchronisieren | Freigabe je Gerät, Standard aus, nur am PC setzbar, native Bestätigung; Anzeige nennt das Gerät; ein Controller zur Zeit | wer am entsperrten PC sitzt, kann sich selbst freigeben – der sitzt aber schon am PC |
| Gestohlenes oder liegengelassenes entsperrtes Handy | Nemo offen, gültiger Schlüssel und Freigabe | wirkt nur im Heimnetz (Hub lauscht nur dort, nur private Gegenstellen); Handy-Entsperren je Sitzung für die volle Stufe; Anzeige und _Beenden_ am PC; gesperrter PC nimmt nur Medien; Freigabe fällt nach 30 Tagen zurück; Gerät am PC sperren (bestehend) | im Heimnetz, PC entsperrt, volle Freigabe: volle Kontrolle bis jemand am PC beendet – das ist die Funktion; die Handy-Abfrage hält nur die unveränderte App auf |
| Verändertes Handy-Programm mit kopiertem Schlüssel | umgeht alles, was das Handy prüft (Entsperren, Bündeln, Raten) | alles Entscheidende prüft der PC: Schalter, Freigabe, Stufe je Ereignis, Sperrzustand, Raten, feste Listen; Schlüssel liegt im Android-Keystore | gerootetes Handy mit voller Freigabe = volle Stufe; Sperren des Geräts am PC ist die Abhilfe |
| Tastatur als Angriffsweg | tippt Befehle (Ausführen-Dialog, Terminal) | nur volle Stufe; Tasten nur aus fester Liste (keine rohen Tastencodes vom Netz, kein Win+R, keine frei wählbaren Kombinationen); Text ohne Steuerzeichen, Enter ist eine eigene Taste; Limits (unten); gesperrter PC und erhöhte Fenster nehmen nichts an; Anzeige am PC | mit Zeiger + Text ist alles erreichbar, was der Nutzer am PC kann – die Liste bremst, sie verhindert es nicht. Deshalb ist die Stufe eine bewusste, sichtbare, widerrufbare Entscheidung |
| Flut von Ereignissen | hängt den PC auf oder macht ihn unbedienbar | je Sitzung: 500 Ereignisse/s (Token-Eimer, Stoß 250), Klicks 20/s, Tasten 30/s, Text 512 Byte/s, Medien 10/s, Sperren 1 je 10 s; Lautstärke nur in Schritten von 2 % (kein Sprung auf 100 %); Überschuss wird verworfen, anhaltende Flut schließt die Sitzung | kurze Störung bis zum Schließen |
| Kompromittierte Web-Ansicht am PC (XSS) | ruft Tauri-Befehle auf | Freigabe erhöhen braucht den nativen Dialog aus Rust; es gibt **keinen** Befehl „Eingabe simulieren“ für die Web-Ansicht – der Weg vom Netz zur Eingabe läuft nur in Rust | kann Freigaben senken oder die Anzeige im Fenster stören; das Tray-Symbol kommt aus Rust |
| Kompromittierter Nemo-Prozess am PC | läuft als der Nutzer | – (jeder Prozess des Nutzers kann `SendInput` selbst aufrufen; die Fernsteuerung gibt ihm nichts Neues) | wie bisher; Signatur und Updater-Regeln unverändert |
| Mitleser auf dem Handy oder PC (Logs, Absturzbericht, Diagnose) | liest, was protokolliert wurde | nichts wird protokolliert: keine Tasten, kein Text, keine Koordinaten, keine Ereignisse (Quelltext-Test wie `tests/rules.rs`); Textfeld ohne Verlauf und ohne Lesehilfe; Diagnose-Negativliste um die Fernsteuerung erweitert | Tastatur-App des Handys sieht den Text wie jeden anderen |
| PC als Angreifer gegen das Handy | sendet Zustands-Frames | 4 Byte fester Aufbau, Werte geklemmt, höchstens 4 je Sekunde | keines bekannt |

**Logging – proposed hard rule, verbatim:** "Never log, store, count per key, or put into diagnostics, crash reports or telemetry any remote-control input: no key, no text, no pointer coordinate, no click, no media command, and no timing of single events. The only thing kept is the trust list's `lastSeen`."

### Proposed rule lines

Root `CLAUDE.md` (one line, after "LAN sync"):

> **Remote control (phone → PC input):** pairing is not permission; input only over the LAN hub's own session mode (never the sync session, never a new listener, never the Local API), only for a device whose remote grant was switched on at the PC (off by default, device-local, never synced, never set over the network, raising it confirmed in a native dialog); levels media/volume and mouse/keyboard are separate; always visible on the PC with one click to end; fixed key and media lists, rate limits; never screen, clipboard, files or titles; never log input; simulation only in `crates/remote-input`, Windows only, no Tauri command simulates input. Full text: `docs/RULES.md`.

`docs/RULES.md` (full text):

> **Remote control (desktop is the target, Android the controller):** a paired device controls nothing by pairing alone. Input travels only in the LAN hub's input session (handshake mode 3 on the hub's listener: same keys, trust list, bind rules and limits as LAN sync; never a listener, port or bind address of its own, never the Local API); a sync session never carries input and an input session never carries sync data or touches the store. The hub accepts it only while the PC's master switch is on and only from a device whose grant is set – both off by default, stored device-local on the PC, never synced, never changeable by a network message or by the phone; raising a grant is confirmed in a native dialog. Two levels: media/volume/lock (no input simulation) and mouse/keyboard; the level is checked per event on the PC, as are the lock state (locked: at most media/volume), the rate limits and the fixed lists (keys and media commands are enum ids, never raw key codes; text has no control characters). While a device controls, the PC shows which one (tray, outside the web view) and one click ends it and pauses that grant. Never screen content, clipboard, files, window or track titles in either direction. Never log, store or put into diagnostics any input (no key, text, coordinate, click or timing). Input simulation lives only in `crates/remote-input` (Windows only; other systems answer `unsupported`; never on Android), is reached only from the hub's input session, and no Tauri command simulates input. `crates/lan-sync` stays free of `unsafe`, logging and OS input APIs.

## 6. PC side (Rust)

**Crates**

| Crate | Gets | Never gets |
|---|---|---|
| `crates/lan-sync` | module `input/`: mode 3 acceptance, wire codec, grant and level gate, rate limits, session state (pure, tested on Linux), a trait `InputSink` it calls; trust list field `remote`; client half for the phone | OS input APIs, `unsafe`, logging (its `tests/rules.rs` stays as is and gains input cases) |
| **new** `crates/remote-input` | the `InputSink` for Windows: `SendInput`, audio endpoint volume, media commands, `LockWorkStation`, lock-state query; `cfg(not(windows))` → `unsupported` | sockets, `tauri`, `serde`, any decoding of network bytes (it takes typed enums only) |
| shell `src/remote.rs`, `src/remote_client.rs` | thin commands, tray state, native confirmation dialog, wiring sink ↔ hub | logic |

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
| `scroll(dx, dy)` | `MOUSEEVENTF_WHEEL` / `HWHEEL` in fractions of 120 |
| text | `KEYEVENTF_UNICODE` per UTF-16 unit, down and up |
| `key(id)` | fixed enum → virtual key(s): Enter, Esc, Backspace, Tab, Space, arrows, Home, End, PageUp, PageDown, Delete, F11, Alt+Tab; modifiers are pressed and released inside one call, never left down |
| `media(id)` | play/pause, next, previous: media session control, fallback the fixed keys `VK_MEDIA_PLAY_PAUSE`, `VK_MEDIA_NEXT_TRACK`, `VK_MEDIA_PREV_TRACK`; volume ±, mute: default audio endpoint (step 2 %), fallback `VK_VOLUME_*`; which path is primary is settled by package 1's hand test |
| lock | `LockWorkStation` (an API call, not Win+L) |

**Tauri commands (minimal).** Desktop, `capabilities/desktop.json`: `remote_status` (master switch, active device, paused devices), `remote_set_enabled`, `remote_set_device` (level; raising shows the native dialog), `remote_end`. Phone: `remote_client_open` (hub, level, state channel), `remote_client_send` (one bundle), `remote_client_close`. All in `build.rs` `COMMANDS`, pinned by `tests/commands.rs`. There is no command that takes an input event on the desktop.

## 7. Phone side (module) and the PC's settings

**Cut.** The PC needs no module: its part is a settings section _Fernsteuerung_ (category `verbindungen`, shown where `lanHub.supported`; `maturity: 'preview'` until package 5): master switch, per paired device the two switches and the two options, _Fernsteuerung beenden_, a link to the pairing section. The phone gets the module.

| Manifest | Value | Note |
|---|---|---|
| `id` | `remote` | UI name → Question 4 |
| `platforms` | `['android']` | valid (`PlatformKind`); the first phone-only module; `'pwa'` is not a value and the browser has no LAN client. A second PC as controller: later |
| `area`, `order` | `system`, 198 | after `disk` (190) and `downloads` (195), both desktop-only – on the phone it is the area's only module |
| `identity` | hue `fern`, head `schreib` (compact: the page is a work surface), widget `status`, signature new mark `touchpad` | neighbour rule: not `slate`/`cobalt` (area), not head `fokus` (neighbour `downloads`); `fern` is used once elsewhere (`pantry`: other head, other widget). `check:modules` is the judge; if identity 4.0 lands first, package 2 follows it |
| `layout` | `full` | the touchpad needs the screen |
| collections | none | `dataSchema: { collections: {} }`, `dataApi: false`, id in `BLOCKED_MODULES`, no `aiSchema`, not `searchable` – like `disk` |
| `seed` | `{ version: 1, dependsOn: [], none: 'live-data' }` | demo state: the E2E/dev fake of the platform service (`fakeRemote.ts`) offers „PC-Sven“ with volume 42 %; a real build without a paired PC shows the empty state |
| settings | sensitivity, haptics on/off, keep screen on | harmless, may sync; nothing about grants |
| `contributions` | `onboarding: noOnboarding`; no `attention`, no notifications, no calendar items | nothing here is ever urgent |
| `maturity` | `preview` until package 5 | |

Pages: `PageHeader`/`PageTitle` with three tabs _Medien_ (default) · _Touchpad_ · _Tastatur_; a tab the PC has not granted shows what is missing and where to switch it on („Am PC unter Einstellungen → Fernsteuerung erlauben.“). Device choice: the paired hub (one today); with several later, a `GroupedList`. Empty state without a paired PC: „Noch kein PC gekoppelt.“ → _PC koppeln_ (sync settings).

**Platform seam.** New services `remoteHost` (desktop) and `remote` (phone) in `core/platform`, pattern of `system`: contract, Tauri bridge, web stub `unsupported`, E2E fake. Hotspot: one chat at a time.

**Widget.** Catalogue type `StatusWidget`: icon, state „PC-Sven · zuletzt verbunden heute“ (while a session is open: „verbunden · Lautstärke 42 %“ – the number has its context), **one** action _Wiedergabe / Pause_. More media buttons are not possible in `StatusWidget` (one action) and not wanted on the home screen; the `cover` variant with controls belongs to the music module. The widget opens no connection by being shown; only the tap does. Empty: „Noch kein PC gekoppelt.“ + _PC koppeln_.

**Focus checklist (FOCUS-GUIDELINES 1–9)**

| # | Answer |
|---|---|
| 1 Stimulus | one module on the phone, one settings section and one chip on the PC; the chip exists only during a session. Nothing moves, blinks or sounds |
| 2 Off switch | master switch (PC), module can be switched off (phone), haptics and keep-awake switchable; defaults: everything off on the PC |
| 3 Next step | one primary action per page (play/pause; the pad itself; _Senden_); empty and refused states name one step |
| 4 Wording | calm, no warning tone: „PC ist gesperrt. Medien und Lautstärke gehen weiter.“ |
| 5 Interruption | a call or a dark screen ends the session; reopening the page continues without questions; typed, unsent text stays in the field until the page is left |
| 6 Tests | Rust: gate, codec, limits, rules; unit: gestures → records; e2e with the fake: switches, refused states, reduced motion, AA |
| 7 Readability | every state as text + icon, never colour alone; buttons labelled |
| 8 Clicks | pause from the home screen: 1 tap (widget); from the module: 1 tap; grant on the PC: 2 switches + 1 confirmation, once |
| 9 Removed instead | no connection screen, no device scanner, no gesture settings, no connection log |

## 8. Out of scope

No screen sharing or screenshots · no file transfer · no clipboard · no Wake-on-LAN (later; needs the PC's MAC and a broadcast) · no macros, custom buttons or app-specific remotes · no Linux/macOS target · no iOS or browser controller · no control from outside the home network · no unlock of the PC · no track titles or covers (the music module's now-playing is the place for that).

## 9. Prototype

Files: [proto/run.mjs](proto/run.mjs) (runner, table), [proto/pc.mjs](proto/pc.mjs) (session, grant, level gate, rate bucket, virtual cursor), [proto/phone.mjs](proto/phone.mjs) (move generator, the five variants, the three checks). It reuses [`sync-lan/proto/channel.mjs`](../sync-lan/proto/channel.mjs). Left out on purpose: real input simulation, real Wi-Fi, Android IPC, mode byte 3, the binary record format (the prototype sends JSON), the native dialog. Results: §3. The checks show that the gate logic is simple to state, not that a product implementation is secure.

## 10. Package plan

[PACKAGES.md](PACKAGES.md): 0 rules (docs) → 1 PC: channel, grant, media sink, visible state → 2 phone: module with _Medien_ → 3 touchpad → 4 keyboard → 5 widget, tray polish, phone volume keys. One package = one chat, one PR, a stop after each. Never parallel to an open LAN-sync package (hotspot `crates/lan-sync`).

## 11. Decided (provisional, until §12 is answered)

1. Transport: own input session on the hub's listener, handshake mode 3, binary one-way records (§3 option b).
2. Grant: master switch + per device, two levels, PC-only, device-local, native confirmation to raise; once per device, optional per-session confirmation.
3. Media level without input simulation; lock PC belongs to it.
4. Locked PC: media and volume continue, everything else is refused.
5. PC end = close + pause the grant; idle close 120 s; full grant falls back after 30 days unused; one controller at a time.
6. PC → phone: volume, mute, playing, locked – nothing else.
7. Input simulation with the `windows` crate in a new crate `crates/remote-input`; no `enigo`; Windows only.
8. Phone: module `remote`, `platforms: ['android']`, area System, no collections; PC: settings section, no module.
9. Keyboard: line mode (_Senden_) + fixed special keys, built in package 4.
10. Phone unlock before a full session, default on, option on the PC.

## 12. Fragen an Sven (Empfehlung zuerst)

1. **Freigabe je Gerät oder je Sitzung?** Empfehlung: **einmal je Gerät** am PC einschalten (mit Bestätigung), danach ohne Rückfrage – vom Sofa aus kann niemand am PC bestätigen; dafür Anzeige am PC, _Beenden_ pausiert die Freigabe, Maus/Tastatur fällt nach 30 Tagen ohne Nutzung zurück. Alternative: Maus/Tastatur jede Sitzung am PC bestätigen (sicherer, auf dem Sofa unbrauchbar); als Option je Gerät ist das ohnehin vorgesehen.
2. **Medien und Lautstärke auch bei gesperrtem PC?** Empfehlung: **ja** (Musik läuft hinter dem Sperrbildschirm weiter; Schaden höchstens Lärm), Maus und Tastatur nie. Alternative: bei gesperrtem PC gar nichts.
3. **Tastatur in v1?** Empfehlung: **eigenes Paket 4 nach dem Touchpad** – Medien (Paket 1 + 2) ist allein schon nutzbar, die Tastatur ist der heikelste Teil und bekommt ihren eigenen Council. Alternative: Tastatur zusammen mit dem Touchpad (ein Paket weniger, größerer PR).
4. **Name des Moduls?** Empfehlung: **„Fernbedienung“** (das Ding in der Hand, wie am Fernseher; passt zum Handy-Modul); die Einstellung am PC heißt „Fernsteuerung erlauben“ (der Vorgang). Alternative: beides „Fernsteuerung“.
