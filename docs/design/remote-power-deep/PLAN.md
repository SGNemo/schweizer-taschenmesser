# Remote control, deep round – power, presentation, programs (plan)

Round „Tiefe & Politur“, 2026-11-15, branch family `feat/remote-power-p*`. Base: [remote-control/CONCEPT.md](../remote-control/CONCEPT.md) (packages 0–5 are on `develop`), rule [rules/remote-control.md](../../rules/remote-control.md). Sven's wish: „PC über Handy steuern braucht ‚Shut down' usw., also einfach mehr Funktionalität.“

## Current state (verified in code, 2026-11-15)

- Phone module `remote` („Fernbedienung“): tabs Medien, Touchpad, Tastatur; header menu with _Ton aus_ and _PC sperren_; widget with play/pause. PC: settings section „Fernsteuerung“, tray state, notice.
- Levels: media/volume/lock (API calls) and mouse/keyboard (`SendInput`), per device, PC-only, widening via native dialog.
- Already there: volume ±, mute, play/pause, next/previous, lock; 16 fixed keys (arrows, PageUp/Down, Esc, F11, Alt+Tab …).
- Missing: shut down, restart, sleep, hibernate, sign out, monitor off, start a program, a presentation page.

## Goal

| Wish | Decision |
|---|---|
| Ausschalten, Neu starten, Energie sparen, Ruhezustand, Abmelden | **p2a/p2b**: own per-device permission _Darf den PC ausschalten_ at the PC (default off, native dialog), the phone's own unlock prompt names the action and is the confirmation (a plain confirm dialog only on a phone without a screen lock), 10 s countdown with _Abbrechen_ at the PC, a hint first when Nemo on the PC is still working, never forced |
| Sperren | exists (media level), unchanged, no countdown |
| Monitor aus | **p2a/p2b**: media id 8 (media level, limit 1 per 10 s like lock), no countdown; header menu next to _PC sperren_ |
| Medien/Lautstärke | exists |
| Präsentation | **p3**: fourth tab (mouse/keyboard level). _Weiter_ large in the thumb zone with _Zurück_ beside it, above one row _Start_ · _Schwarz_ · _Ende_ (F5, B, Esc; two new fixed keys behind feature bit 1); hint „Das Präsentationsfenster muss am PC vorne sein.“ Works only at home (home-network rule) – said in the page and the user docs |
| Laser-Zeiger, volume keys turn slides | not built („Noch offen“ in p3) |
| Programm starten (am PC freigegebene Liste) | **p4**: list kept only on the PC (≤ 8 entries, added with the PC's file dialog, name ≤ 40 characters, plain line), phone: header menu _Programm starten …_ (sheet), empty: „Am PC unter Fernsteuerung Programme für dieses Handy auswählen.“; slot number on the wire, never a path or argument; feature bit 2 |
| Zwischenablage Handy → PC | **not built**: the hard rule says „never … clipboard … in either direction“. Today: paste into the _Tastatur_ field, _Senden_ types it at the PC. Question to Sven in the p2a PR |
| Wake-on-LAN | **not built**, „Im Nachhinein klären“ (MAC, broadcast, BIOS/NIC setting; reaches the PC while Nemo does not run) |

## Packages (one branch and PR each, in this order; each mergeable alone)

| # | Branch | Scope |
|---|---|---|
| p1 | `feat/remote-power-p1` | docs: this plan, rule text, decision; no code. Sven merges (rule change) |
| p2a | `feat/remote-power-p2a` | PC side, nothing reachable from a released phone yet: wire (both sides, tested in the crate), grant flag `remotePower`, gate, `remote-input` power commands (Windows), shell countdown (state, window `power.html` with own capability, tray entry, cancel triggers, busy bits, per-device limit), settings switch on the PC, `.changes` |
| p2b | `feat/remote-power-p2b` | phone side: `remote_client_power` (native unlock, then send), sheet _PC ausschalten …_ and _Monitor aus_ in the header menu, states, user docs de+en, `.changes` |
| p3 | `feat/remote-power-p3` | presentation tab, keys F5 and B (feature bit 1), user docs |
| p4 | `feat/remote-power-p4` | programs from the PC's list (feature bit 2), user docs |

## Wire (p2a)

- `open`: `[level]` as before, or `[level, features]`. The PC **ignores** unknown bits and echoes the ones it accepted. An old PC closes on the second byte without a word: the phone then opens once more with `[level]` and treats the PC as one without power (no page shown, nothing lost).
- `opened`: 7 bytes as before; with a features byte in the `open`, two more: `features` (accepted bits; bit 0 power) and `power` (bit 0 granted, bit 1 a countdown runs, bit 2 hibernate available).
- Phone → PC tag `0x28` `power [action, despite]`, one per frame, actions: sleep, hibernate, sign-out, restart, shut-down, cancel; `despite` 0/1 (start although the PC said `working`; only for the five countdown actions).
- PC → phone tag `0x27` `power [answer]`: exactly one per `0x28`, plus unasked from the tick when a countdown ends or is stopped at the PC. Answers: `started` · `working` (nothing started) · `pending` · `cancelled` · `done` · `not-granted` · `locked` · `limit` · `failed`.
- Monitor off is media id 8 in the existing `events` frame (sent only to a PC that echoed bit 0).

## Where what lives

- `crates/lan-sync`: decodes, gates (session open, power grant, PC not locked; `cancel` always passes), hands over through a new sink method `power(device, action, despite) -> answer`; tells pending/granted in `opened`.
- shell `src/remote_power.rs`: the countdown state machine (one at a time, hub-wide), the per-device limit (2 starts per 60 s, memory only, survives a reconnect), the busy bits (Rust: another device's LAN sync session, a download or torrent job; web view: cloud sync or backup running – a bit from the web view can only add a hint, never remove one), the window and the tray entry, the cancel triggers, and the one call into `remote-input` when the countdown ends.
- `crates/remote-input`: power commands on their own queue (never dropped when the media queue is full): `SetSuspendState`, `ExitWindowsEx` without `EWX_FORCE`, monitor off by `SendMessageTimeoutW(HWND_BROADCAST, WM_SYSCOMMAND, SC_MONITORPOWER)` – the one window message of the crate, scoped in `tests/rules.rs`.
- No Tauri command starts a power action or a program. The countdown window's capability (`capabilities/power.json`) grants status and cancel only.

## Countdown (Guardian + Advocate)

- Stops: _Abbrechen_ in the window, in the tray, from the phone; ending remote control at the PC; master switch off; the device's power grant taken away or paused; the PC locked; the window closed or not shown (no window, no action). Does **not** stop: the phone's connection dropping (“PC aus, Handy weg” must work).
- Window: one still sentence „Svens Handy schaltet diesen PC in 10 Sekunden aus.“ (action word per action), the number changes once a second, no bar, no animation, no sound, no red, one primary button _Abbrechen_. Always on top, centred, not full screen.
- Phone after `started`: „Der PC fährt herunter. Fragt ein Programm noch nach Speichern, bleibt er an.“ (per action), then the expected disconnect is shown as that calm line, not as „nicht erreichbar“.
- Locked PC: refused, phone line „PC ist gesperrt. Ausschalten geht, solange er entsperrt ist.“ (Windows locks itself after idle: sleep on a locked PC is a question to Sven, recommendation yes, sleep only.)

## Focus checklist (p2)

| # | Answer |
|---|---|
| 1 Stimulus | one menu entry and one sheet on the phone; one window at the PC only during the 10 s; nothing blinks or sounds |
| 2 Off switch | per device at the PC, default off; the countdown always has _Abbrechen_ |
| 3 Next step | every refusal names one step (allow at the PC, unlock the PC, wait) |
| 4 Wording | calm: „Gleich wieder möglich.“, „Nemo am PC lädt noch etwas herunter.“ · _Trotzdem ausschalten_ / _Warten_ |
| 5 Interruption | a dropped connection does not stop a started countdown; the phone's line says what happens |
| 6 Tests | Rust: wire, gate, limits, countdown state machine, rules; unit: sheet, states; e2e with the fake |
| 7 Readability | text + icon for every action and state |
| 8 Clicks | „PC aus vom Sofa“: menu → _PC ausschalten …_ → _Ausschalten_ → fingerprint (4 steps, then 10 s); by hand at the PC: Start → Ein/Aus → Herunterfahren (3, but at the desk) |
| 9 Removed instead | no own power page or tab; hibernate shown only where the PC has it; sign-out and hibernate below the three main actions |
