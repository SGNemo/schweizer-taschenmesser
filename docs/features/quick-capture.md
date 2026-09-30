# Schnellerfassung (Quick Capture)

Einträge in Sekunden anlegen, ohne das passende Modul zu öffnen. Der Parser läuft komplett lokal (kein Netzwerk, keine Cloud-KI), gibt nichts ins Log aus und schreibt nur in Module, die eingeschaltet sind. Der Tresor (`accounts`) ist als Ziel ausgeschlossen.

## Benutzung

| Wo                            | Wie                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| In der App (alle Plattformen) | Schnell-Hinzufügen-Button (Plus unten rechts) → Eingabefeld oben im Blatt. Auch über `/?capture=1` (PWA-Shortcut „Schnell erfassen“). |
| Windows-App                   | Globales Tastenkürzel (Standard `Strg+Umschalt+Leertaste`) oder Tray-Symbol → kleines Eingabefenster.                                 |
| Android-App                   | Text oder Link in einer anderen App „Teilen“ → Taschenmesser → Vorschlag, Speichern mit einem Tipp.                                   |
| PWA                           | Share-Target `/share` (wie bisher), jetzt mit Parser-Vorschlag.                                                                       |

Im Eingabefenster: **Enter** speichert, **Tab / Umschalt+Tab** oder **↑/↓** wechseln den Typ, **Esc** schließt. Nach dem Speichern erscheint eine Bestätigung mit „Rückgängig“.

### Was erkannt wird

- **Datum/Zeit:** heute, morgen, übermorgen, Wochentage („Freitag“, „nächsten Montag“), „am 3.10.“, „3. Oktober“, „in 2 Stunden“, „in 3 Tagen“, „nächste Woche“, „Ende des Monats“, „15 Uhr“, „14:30“, „halb 8“, „heute Abend“. Ein Datum ohne Jahr in der Vergangenheit rutscht ins nächste Jahr (mit Hinweis).
- **Wiederholung:** „jede Woche“, „täglich“, „jeden Monat“, „jeden 1.“, „jeden Montag“, „alle 2 Wochen“, „jedes Jahr“.
- **Beträge:** „12,50 €“, „12 EUR“, „€ 5“, „1.234,56 €“ (Einnahme bei „Gehalt“, „erhalten“, „+“).
- **Typ:** Datum + Uhrzeit → Termin (Kalender); „erinnere mich …“ oder Wiederholung → Erinnerung; „todo“/„aufgabe“ oder Text ohne Signal → ToDo (Standardziel einstellbar); URL oder „merke …“ → Merkliste; Betrag → Finanzen (nur als Entwurf, wird erst nach „Buchen“ angelegt).
- **Kurzbefehle** (erzwingen den Typ): `t ` ToDo, `k ` Kalender, `e ` Erinnerung, `m ` Merkliste, `$ ` Finanzen.

Ist die Erkennung unsicher (z. B. Link + Termin, oder Betrag + Termin), wird nichts still angenommen: die Vorschau verlangt eine Auswahl. Angenommene Werte (z. B. „Datum angenommen“, „Uhrzeit ungefähr“) erscheinen als gelbe Hinweis-Chips.

### Einstellungen (Einstellungen → Schnellerfassung)

- Standardziel für Text ohne Hinweis.
- Windows: Tastenkürzel (aufnehmen; Fehler wie „schon belegt“ werden erklärt, das alte Kürzel bleibt aktiv), „In den Tray minimieren statt beenden“, „Mit Windows starten“, „Zwischenablage beim Öffnen einfügen“. Alles standardmäßig **aus** (außer dem Kürzel selbst).
- **Wichtig:** Das Tastenkürzel funktioniert nur, solange die App läuft. Mit „In den Tray minimieren“ bleibt sie beim Schließen im Hintergrund. Beim Verstecken im Tray gilt die App als „im Hintergrund“ (Tresor-Auto-Sperre greift).
- Portable-Exe von einem USB-Stick: Der Autostart-Eintrag zeigt auf den aktuellen Speicherort; fehlt der Stick beim Anmelden, startet nichts.

## Technik (English)

```
web/src/quickCapture/
  parser/      pure TS, relative imports only (lint + isolation.test.ts). parseCapture(text, {now, defaultType})
  targets/     adapter layer: one adapter per destination, saveCapture(type, fields)
  ui/          CaptureForm (live chips, type switching), chips.ts, announceSaved.ts
  capture/     entry of the second window (capture.html): CaptureWindow
  device.ts    per-device prefs in localStorage (hotkey, close-to-tray, autostart, clipboard)
  desktop.ts   applies prefs to the shell at startup
  nativeShare.ts  Android share -> /share
web/capture.html                  second Vite input
web/src-tauri/src/capture.rs      hidden capture window, tray, hotkey, close-to-tray, autostart
web/src-tauri/plugins/share-intent  Android ACTION_SEND plugin (Kotlin) + stub
```

- **Parser:** deterministic, integer scores, `CaptureResult { type, fields, confidence, needsChoice, forced, alternatives, notes }`. `needsChoice` when the best score is below 60 or within 10 of the runner-up. No `chrono-node`: it misses "am 3.10.", recurrence and amounts, and would add ~3 MB.
- **Adapters (`targets/`):** no module imports (ESLint rule for `src/quickCapture/**`). A write goes `getManifest(id)` → `createCollectionRepo(manifest, collection)` (Zod, HLC, outbox) plus the module's `aiCreateDefaults` (inbox list, primary account). Only modules enabled in `_modules` are written; the vault is not in the allowlist (`targets.test.ts`). Manifest types and the registry are untouched.
- **Capture window:** created hidden at startup (opens instantly), same WebView2 profile as the main window (also in portable mode), so both share IndexedDB. It starts no services (sync, notifications, updater, local API); the main window syncs what it wrote through the outbox. `initCapturePlatform()` gives it the web platform plus the desktop commands only.
- **Hotkey / autostart in Rust:** commands `capture_set_hotkey`, `desktop_set_autostart`, …; no JS plugin permissions for global-shortcut or autostart exist. A new hotkey is registered before the old one is released.
- **Capabilities:** app commands are granted per window (`build.rs` app manifest). `main` gets all app commands; `capture` gets only `capture_hide` and `capture_read_clipboard`. `src-tauri/tests/commands.rs` fails when a command in `generate_handler!` is missing from `build.rs`, or when `capture.json` grants more than it should.
- **Single instance:** a second start focuses the running app (`tauri-plugin-single-instance`, registered first, after `portable::startup`, so a self-update relaunch is not mistaken for a second instance).
- **Clipboard:** read only in the capture window, only when the user turned it on, capped at 1000 characters, never logged.
- **Privacy:** typed text is never logged; errors never echo user text.

### Android app shortcut (proposal, not implemented)

Tauri 2 has no API for launcher shortcuts, so this needs native Kotlin. Two options, both inside the existing `share-intent` plugin (library manifest merge, no committed `gen/`):

1. **Static:** `res/xml/shortcuts.xml` with one shortcut (`android.intent.action.VIEW`, data `taschenmesser://capture`) and `<meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts"/>` on the launcher activity. The activity needs an intent filter for that URI; the plugin turns it into a pending "open capture" flag that the web app opens as `/?capture=1`.
2. **Dynamic:** `ShortcutManagerCompat.setDynamicShortcuts` from `ShareIntentPlugin.load` (adds `androidx.core:core` as a dependency).

Recommendation: option 1 (works before the first app start after install, no runtime code). Needs a device test: long-press on the icon.

### Suggestion for a later manifest field

A `capture` contribution per module (`{ label, collection, build(fields) }`) would let modules declare their own adapter and remove `targets/`. Not done here on purpose (manifest types and registry are owned by the parallel module work).
