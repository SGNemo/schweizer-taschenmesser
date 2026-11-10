# Hard rule – remote control (phone → PC input)

Unabridged text of the rule; short line in root [CLAUDE.md](../../CLAUDE.md), index in [RULES.md](../RULES.md). Desktop is the target, Android the controller. Rationale and threat model: [design/remote-control/CONCEPT.md](../design/remote-control/CONCEPT.md); decision: [decisions/core.md](../decisions/core.md).

- A paired device controls nothing by pairing alone.
- Input travels only in the LAN hub's input session (handshake mode 3 on the hub's listener: same keys, trust list, bind rules and limits as LAN sync; never a listener, port or bind address of its own, never the Local API; accepted only on the stored home network, never on a network that is listened on only for an open pairing window; frames ≤ 512 bytes; home binds are flagged from the stored network id, fail-closed); a sync session never carries input and an input session never carries sync data or touches the store.
- The hub accepts it only while the PC's master switch is on and only from a device whose grant is set – both off by default, stored device-local on the PC, never synced, never changeable by a network message; every widening (raising a level, un-pausing, master switch on with a stored grant, loosening an option) is confirmed in a native dialog shown by Rust and refused while a mouse/keyboard session is open, checked again when the dialog returns.
- Two levels: media/volume/lock (API calls only, no simulated input, no media keys) and mouse/keyboard; a session's level is fixed when it opens (the smaller of request and grant) and checked per event on the PC, as are the lock state (locked: at most media/volume), the rate limits and the fixed lists (keys and media commands are enum ids, never raw key codes; text has no control characters).
- While a device controls, the PC shows which one (tray, from Rust-held state the web view cannot remove) and one click ends it and pauses that grant.
- Never screen content, clipboard, files, window or track titles in either direction.
- Never log, store or put into diagnostics any input (no key, text, coordinate, click or time of use – an input session does not update `lastSeen`); the only remote-control state stored on the PC is the master switch and per device the level, the pause flag and the unlock option; throttles live in memory only.
- The phone's commands are granted to the phone only (`capabilities/mobile.json`).
- Input simulation lives only in `crates/remote-input` (Windows only; other systems answer `unsupported`; never on Android), is reached only from the hub's input session, and no Tauri command simulates input.
- `crates/lan-sync` stays free of `unsafe`, logging and OS input APIs.
