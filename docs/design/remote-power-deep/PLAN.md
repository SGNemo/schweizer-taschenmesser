# Remote control, deep round – power, presentation, apps (plan)

Round „Tiefe & Politur“, 2026-11-15, branch family `feat/remote-power-p*`. Base: [remote-control/CONCEPT.md](../remote-control/CONCEPT.md) (packages 0–5 are on `develop`), rule [rules/remote-control.md](../../rules/remote-control.md). Sven's wish: „PC über Handy steuern braucht ‚Shut down' usw., also einfach mehr Funktionalität.“

## Ist (verified in code, 2026-11-15)

- Phone module `remote` („Fernbedienung“): pages Medien, Touchpad, Tastatur; widget with play/pause. PC: settings section „Fernsteuerung“, tray state, notice.
- Levels: media/volume/lock (API calls) and mouse/keyboard (`SendInput`), per device, PC-only, widening via native dialog.
- Already there: volume ±, mute, play/pause, next/previous, lock PC; 16 fixed keys (arrows, PageUp/Down, Esc, F11, Alt+Tab …).
- Missing: shut down, restart, sleep, hibernate, sign out, monitor off, start an app, a presentation page.

## Ziel

| Wish | Decision |
|---|---|
| Energie: herunterfahren, neu starten, Ruhezustand, Energiesparen, abmelden | **p2**: own per-device grant „Energie“ at the PC (default off, native dialog), confirmation on the phone, 10 s countdown with _Abbrechen_ at the PC, hint when Nemo is still syncing or downloading, 1 action per 30 s, never forced (programs with unsaved work can still stop Windows) |
| Sperren | exists (media level), unchanged, no countdown |
| Monitor aus | **p2**, media level (an API call like lock; any touch at the PC wakes it), no countdown |
| Medien/Lautstärke | exists |
| Präsentationsmodus | **p3**: page _Präsentation_ on the phone (mouse/keyboard level): big _Weiter_/_Zurück_, _Start_ (F5, one new fixed key), _Ende_ (Esc), _Schwarz_ (B, one new fixed key); the phone's volume keys turn slides while the page is open |
| Laser-Zeiger | not built: needs a held modifier and the pointer at once (PowerPoint Ctrl+L) – „Noch offen“ in p3 |
| App starten aus einer am PC freigegebenen Liste | **p4**: list kept only on the PC (device-local file, ≤ 8 entries, chosen with the PC's file dialog), the phone gets names and slot numbers only, never a path; start via the shell's default verb, no arguments from the network |
| Zwischenablage Handy → PC | **not built**: the hard rule says „never … clipboard … in either direction“. What works today: paste on the phone into the _Tastatur_ field, _Senden_ types it on the PC (no PC clipboard touched). Question to Sven in the p2 PR |
| Wake-on-LAN | **not built**, „Im Nachhinein klären“ (needs the PC's MAC, a broadcast and a BIOS/NIC setting; it reaches the PC while Nemo is not running) |

## Pakete (one branch and PR each, in this order; each mergeable alone)

| # | Branch | Scope |
|---|---|---|
| p1 | `feat/remote-power-p1` | docs: this plan, rule text (third grant „Energie“, `power` reply, power records), CONCEPT pointer; no code. Sven merges (rule change) |
| p2 | `feat/remote-power-p2` | power end to end: wire (`open` features byte, `opened` power byte, record kind `power`, reply `power`), grant flag `remotePower` in `trust.json`, gate + limits, `remote-input` power commands (Windows), shell countdown window `power.html` + tray entry, PC settings switch, phone page _Energie_ (menu of Medien), `.changes` |
| p3 | `feat/remote-power-p3` | presentation page; keys `F5`, `B` added to both fixed lists |
| p4 | `feat/remote-power-p4` | apps from the PC's list |

p2 needs p1's rule; p3 and p4 build on p2's wire (`open` features byte). Order p1 → p2 → p3 → p4.

## Wire additions (p2)

- `open`: `[level]` (old phones) or `[level, features]`; feature bit 0 = „I know power“. Any other bit set = close.
- `opened`: 7 bytes as before; **8** (`… , power`) only when the `open` carried the features byte. An old PC closes on a 2-byte `open` without a word: the phone's existing „PC too old“ path says „Am PC aktualisieren“.
- Record kind 6 `power(id, despite)`: ids `monitor-off`, `sleep`, `hibernate`, `sign-out`, `restart`, `shut-down`, `cancel`; `despite` 0/1 (only for the five countdown actions: „start although Nemo is busy“).
- Reply tag `0x27` `power [answer]`: `started` · `busy` (Nemo is syncing or downloading, nothing started) · `pending` (a countdown runs already) · `cancelled` · `refused` (not granted, PC locked, limit) · `failed`.
- `monitor-off` needs the media level only; the five others and `cancel` need the power grant (`cancel` also passes without it: it only ever stops something).

## Security (Guardian lens)

- Pairing is not permission; media/full grant is not power permission: own flag, default off, set only at the PC, widening only via native dialog (refused while a mouse/keyboard session is or was open since the ticket), narrowing at once.
- Phone: confirm dialog per action; the phone's own unlock (fingerprint/PIN) before every countdown action when the phone has a screen lock – native in Rust, not in the page; a stolen unlocked phone still meets the PC's countdown, the tray entry and the home-network-only rule.
- PC: 10 s countdown in its own always-on-top window from Rust state; _Abbrechen_ there, in the tray, from the phone, by ending remote control, by switching the master switch off, by locking the PC; closing the window cancels; no window → nothing happens (fail closed).
- Locked PC: power refused (rule: locked = at most media/volume/lock); monitor off allowed.
- Never `EWX_FORCE`: Windows asks programs with unsaved work as on a normal shutdown.
- Limits: one countdown at a time, power 1 per 30 s, at most 3 drops before the session closes for flood.
- Nothing logged; no trace of which action or when.
