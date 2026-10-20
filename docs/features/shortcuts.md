# Key map (T chords, F-keys)

Direct keys for what you reach all day. Code: `web/src/core/keyboard/` (`map.ts` rules, `prefs.ts` storage, `shortcuts.ts` handler, `labels.ts` names), `layout/useShortcuts.ts` (actions), `pages/settings/ShortcutsSection.tsx`, `ui/KeyRecorder.tsx` + `ui/Keys.tsx`, texts `strings.keys.ts`.

| Key | What |
|---|---|
| `T`, then a letter | opens a tool; fixed letters in `TOOL_CHORDS` (t timer, r calc, q qr, u units, d dates, s screenshot, c currency, z timezones, w dice, x text, i image, p pdf, v dev). Only tools that exist **and** are on; otherwise nothing happens. Window `CHORD_MS` (1.2 s), never while typing, with a modifier, in a dialog, or on the vault entry view (`data-shortcut-scope="entry"`: its own `T` copies the code) |
| F2 F3 F6 F7 F8 F9 F10 | rebindable: F2 Neu erfassen · F3 Suchen/Palette · F6 Heute · F7 Fokus starten · F8 Timer · F9 Rechner · F10 Einstellungen; Bildschirmfoto has no key by default |
| F4 | voice (source stays `core/voice/settings`, changed under Schnellerfassung → Spracheingabe) |

- **F-keys** act inside text fields too (they type nothing), also with a dialog open; a held key does not repeat the action (`e.repeat`). Keys with a modifier are never ours (Alt+F4 closes the window). **F1, F5, F11, F12** and every combination are refused in the recorder (browser/system).
- **One key, one action.** A taken key is refused with a text naming the holder (no sound, nothing moves silently); the voice key counts as a holder. "Standard" per row, "Entfernen" for no key. A tool action whose tool is off shows a toast instead of staying silent.
- **F7 "Fokus starten"** never starts a timer by itself: it returns to a running round, else opens Heute with the start button focused (`data-focus-start` on the "Nächste eine Sache" card); one Enter starts.
- **Storage:** device-local `localStorage` `tm-shortcuts` = `{ keys: { <action>: 'F9' | '' } }`, only differences from the defaults. Not synced (keyboards differ). Settings: Allgemein → Tastenkürzel.
- **Shown:** `?` sheet (fixed keys, chords of tools that are on, F-keys as set, voice key), palette (key behind `Heute`, `Einstellungen`, tools: `F8` and `T T`), settings table.
- **Recorder:** `ui/KeyRecorder` is the shared button (also used by the voice key and the global hotkeys); while it records it carries `data-hotkey-recording`, which every global handler respects.
- Global (system-wide) keys stay in `core/platform`; not part of this map.
- Tests: `core/keyboard/*.test.ts`, `ui/KeyRecorder.test.tsx`, `pages/settings/ShortcutsSection.test.tsx`, `e2e/shortcuts.spec.ts` (desktop; pixel-7 operates the section by tapping).
