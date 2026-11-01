# Schnellerfassung (Quick Capture)

Einträge in Sekunden anlegen, ohne das passende Modul zu öffnen. Der Parser läuft komplett lokal (kein Netzwerk, keine Cloud-KI), gibt nichts ins Log aus und schreibt nur in Module, die eingeschaltet sind. Der Tresor (`accounts`) ist als Ziel ausgeschlossen.

## Benutzung

| Wo                            | Wie                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| In der App (alle Plattformen) | Schnell-Hinzufügen-Button (Plus unten rechts) → Eingabefeld oben im Blatt. Auch über `/?capture=1` (PWA-Shortcut „Schnell erfassen“). |
| Windows-App                   | Globales Tastenkürzel (Standard `Strg+Umschalt+Leertaste`) oder Tray-Symbol → kleines Eingabefenster. Das Tray-Menü zeigt oben „Heute“ (siehe unten). |
| Android-App                   | Text oder Link in einer anderen App „Teilen“ → Nemo → Vorschlag, Speichern mit einem Tipp. Lange auf das App-Symbol drücken → „Erfassen“, „Suchen“, „Heute“; Kachel „Nemo: Erfassen“ in den Schnelleinstellungen. |
| PWA                           | Share-Target `/share` (wie bisher), jetzt mit Parser-Vorschlag.                                                                       |

Im Eingabefenster: **Enter** speichert, **Umschalt+Enter** beginnt eine neue Zeile, **Tab / Umschalt+Tab** oder **↑/↓** wechseln den Typ, **Esc** schließt. Nach dem Speichern erscheint eine Bestätigung mit „Rückgängig“.

### Mehrere Dinge auf einmal

**Eine Zeile = ein Eintrag.** Mehrere Zeilen, Aufzählungen (`-`, `*`, `•`, `1.`) oder ein Satz wie „Milch kaufen, morgen Oma anrufen und Freitag Zahnarzt 9 Uhr“ werden zu einzelnen Einträgen. Jede Zeile zeigt ihr Ziel (änderbar über das Menü der Zeile) und ihr Datum; „Alle speichern“ legt alle auf einmal an, „Ändern“ im Hinweis danach nimmt alle zurück und holt den Text wieder ins Feld. Unklare Zeilen landen wie gewohnt im Eingang (mit „Ohne Rückfrage speichern“ aus: erst wählen), Buchungen bleiben Entwurf bis zur Bestätigung. Nicht getrennt wird bei Beträgen („12,50“), Uhrzeiten („um 9, 30 Min“), Zeitspannen („9–10 Uhr“), Wochentagslisten („Mo, Mi und Fr“), „bis 31.12.“, Klammern und Links – und immer dann, wenn ein Teil allein kein Eintrag wäre („Brot, Milch und Eier kaufen“ bleibt eins). Am Handy steht „Eine Zeile = ein Eintrag“ unter dem Feld; Diktat („neue Zeile“, „Komma“) und geteilter Text mit mehreren Zeilen funktionieren genauso.

### Tray „Heute“ (Windows-App)

Rechtsklick auf das Tray-Symbol zeigt oben bis zu 5 Dinge von heute: Überfälliges, dann heutige Termine und ToDos mit Uhrzeit (nur Titel, auf 40 Zeichen gekürzt; nie Beträge, nie Tresor, nie Notizinhalte). Ein Klick öffnet den Eintrag im Hauptfenster; „Jetzt dran anfangen“ öffnet den Fokus für das erste ToDo, „Timer 25 Minuten“ startet den Timer. Aktualisiert sich bei jeder Änderung und alle 5 Minuten. Abschaltbar unter Einstellungen → Schnellerfassung → „Heute im Tray-Menü zeigen“. Leerer Tag oder ausgeschaltet: Menü wie vorher.

### Was erkannt wird

- **Datum/Zeit:** heute, morgen, übermorgen, Wochentage („Freitag“, „nächsten Montag“), „am 3.10.“, „3. Oktober“, „in 2 Stunden“, „in 3 Tagen“, „nächste Woche“, „Ende des Monats“, „15 Uhr“, „14:30“, „halb 8“, „heute Abend“. Ein Datum ohne Jahr in der Vergangenheit rutscht ins nächste Jahr (mit Hinweis).
- **Wiederholung:** „jede Woche“, „täglich“, „jeden Monat“, „jeden 1.“, „jeden Montag“, „alle 2 Wochen“, „Mo–Fr“, „Mo und Mi“, „alle zwei Wochen Mittwoch“, „bis 31.12.“ (Ende der Wiederholung), „jedes Jahr“.
- **Endzeit und Priorität:** „14:00 bis 16:00“, „6 bis 14:30“, „10–12 Uhr“ (Ende vor dem Beginn = Nachtdienst bis zum nächsten Tag); `!hoch`, `!mittel`, `!niedrig` für ToDos. „nächsten Freitag“ ist der Freitag der nächsten Woche.
- **Beträge:** „12,50 €“, „12 EUR“, „€ 5“, „1.234,56 €“ (Einnahme bei „Gehalt“, „erhalten“, „+“).
- **Typ:** Datum + Uhrzeit → Termin (Kalender); „abgeben/einreichen/Frist“ → ToDo auch mit Uhrzeit; fester Wochen-Slot mit Uhrzeit („Mo–Fr 6 Uhr“) → Termin, tägliche Wiederholung bleibt Erinnerung; Betrag + „bis/fällig“ → Rechnung; Betrag + „monatlich/jährlich“ → Abo; „Geburtstag Anna 14.11.“ → Person; „… Ausgabe“ → Buchung; „erinnere mich …“ oder Wiederholung → Erinnerung; „todo“/„aufgabe“ oder Text ohne Signal → ToDo (Standardziel einstellbar); URL oder „merke …“ → Merkliste; Betrag → Finanzen (nur als Entwurf, wird erst nach „Buchen“ angelegt).
- **Kurzbefehle** (erzwingen den Typ): `t ` ToDo, `k ` Kalender, `e ` Erinnerung, `m ` Merkliste, `l ` Einkauf, `n ` Notiz, `r ` Rechnung, `$ ` Finanzen.
- **Rechnung:** „Rechnung Swisscom 89,90 € bis 31.10.“ oder `r 89,90 Swisscom 31.10.` legt eine offene Rechnung an (Empfänger = übrig bleibender Text, Datum = Fälligkeit, ohne Datum 14 Tage mit Hinweis „Datum angenommen“). Ohne Betrag bleibt „Rechnung“ ein normales Wort. Keine Bestätigung nötig, „Rückgängig“ entfernt sie wieder.

Ist die Erkennung unsicher (z. B. Link + Termin, oder Betrag + Termin), wird nichts still angenommen: die Vorschau verlangt eine Auswahl. Angenommene Werte (z. B. „Datum angenommen“, „Uhrzeit ungefähr“) erscheinen als gelbe Hinweis-Chips.

### Einstellungen (Einstellungen → Schnellerfassung)

- Standardziel für Text ohne Hinweis.
- Windows: Tastenkürzel (aufnehmen; Fehler wie „schon belegt“ werden erklärt, das alte Kürzel bleibt aktiv), „In den Tray minimieren statt beenden“, „Heute im Tray-Menü zeigen“ (an), „Mit Windows starten“, „Zwischenablage beim Öffnen einfügen“. Alles andere standardmäßig **aus** (außer dem Kürzel selbst).
- **Wichtig:** Das Tastenkürzel funktioniert nur, solange die App läuft. Mit „In den Tray minimieren“ bleibt sie beim Schließen im Hintergrund. Beim Verstecken im Tray gilt die App als „im Hintergrund“ (Tresor-Auto-Sperre greift).
- Portable-Exe von einem USB-Stick: Der Autostart-Eintrag zeigt auf den aktuellen Speicherort; fehlt der Stick beim Anmelden, startet nichts.

## Technik (English)

```
web/src/quickCapture/
  parser/      pure TS, relative imports only (lint + isolation.test.ts). parseCapture(text, {now, defaultType});
               split.ts splitCapture(text) runs in front of it (one line = one entry)
  targets/     adapter layer: one adapter per destination, saveCapture(type, fields)
  ui/          CaptureForm (live chips, type switching), chips.ts, announceSaved.ts
  capture/     entry of the second window (capture.html): CaptureWindow
  device.ts    per-device prefs in localStorage (hotkey, close-to-tray, autostart, clipboard)
  desktop.ts   applies prefs to the shell at startup
  nativeShare.ts  Android share -> /share
web/capture.html                  second Vite input
web/src-tauri/src/capture.rs      hidden capture window, tray, hotkey, close-to-tray, autostart
web/src-tauri/plugins/share-intent  Android ACTION_SEND plugin (Kotlin) + stub; launcher shortcuts + quick-settings tile
web/src/core/platform/tauri/traySnapshot.ts  tray "Heute" block: selection, refresh, click routes
```

- **Parser:** deterministic, integer scores, `CaptureResult { type, fields, confidence, needsChoice, forced, alternatives, notes }`. `needsChoice` when the best score is below 60 or within 10 of the runner-up. No `chrono-node`: it misses "am 3.10.", recurrence and amounts, and would add ~3 MB.
- **Adapters (`targets/`):** no module imports (ESLint rule for `src/quickCapture/**`). A write goes `getManifest(id)` → `createCollectionRepo(manifest, collection)` (Zod, HLC, outbox) plus the module's `aiCreateDefaults` (inbox list, primary account). Only modules enabled in `_modules` are written; the vault is not in the allowlist (`targets.test.ts`). Manifest types and the registry are untouched.
- **Capture window:** created hidden at startup (opens instantly), same WebView2 profile as the main window (also in portable mode), so both share IndexedDB. It starts no services (sync, notifications, updater, local API); the main window syncs what it wrote through the outbox. `initCapturePlatform()` gives it the web platform plus the desktop commands only.
- **Hotkey / autostart in Rust:** commands `capture_set_hotkey`, `desktop_set_autostart`, …; no JS plugin permissions for global-shortcut or autostart exist. A new hotkey is registered before the old one is released.
- **Capabilities:** app commands are granted per window (`build.rs` app manifest). `main` gets all app commands; `capture` gets only `capture_hide` and `capture_read_clipboard`. `src-tauri/tests/commands.rs` fails when a command in `generate_handler!` is missing from `build.rs`, or when `capture.json` grants more than it should.
- **Single instance:** a second start focuses the running app (`tauri-plugin-single-instance`, registered first, after `portable::startup`, so a self-update relaunch is not mistaken for a second instance).
- **Clipboard:** read only in the capture window, only when the user turned it on, capped at 1000 characters, never logged.
- **Privacy:** typed text is never logged; errors never echo user text.

- **Multi-line (`parser/split.ts`):** lines always split; inside a line, sentence ends, commas/semicolons and an "und" after the last comma split only when every part reads as an entry (≥ 2 words, one not a date/time word). Never at digit-comma-digit, inside brackets or links, after a digit or short abbreviation. Fewer than two parts = the old single path with the text as typed (`split.test.ts` pins every corpus sentence as one entry). Each part goes through `parseCapture` and the same `ui/resolve.ts` as a single entry; `targets/saveCaptures` writes them one after the other, all or nothing, and returns one `SavedCapture` (`count`, `text`, one `undo`). `ui/reopen.ts` puts the text back into the sheet for "Ändern". `extra` (shared note) applies to single entries only.
- **Tray "Heute" (`core/platform/tauri/traySnapshot.ts`, `capture.rs`):** the web app reads today from the `todos` and `calendar` contributions only (`calendarItems`, overdue `attention`), keeps ≤ 5 lines (title cut to 40, amounts stripped, internal routes only) and sends only labels via `desktop_set_tray_today`; Rust rebuilds the tray menu (block hidden when empty), keeps nothing else and logs nothing. A click shows the main window and dispatches `tm-tray-item` with a fixed id (`today-0…4`, `now`, `timer`); the route is looked up in the web app. Refresh: Dexie live query on those tables + every 5 min; no polling in Rust. Started from `startQuickCaptureDesktop` (desktop only, not in safe mode); per-device switch `trayToday` in `tm-quick-capture` (default on).

### Android app shortcuts and quick-settings tile (built)

Inside the `share-intent` plugin (library manifest merge, no committed `gen/`):
- `res/xml/shortcuts.xml`: static shortcuts Erfassen / Suchen / Heute (explicit `VIEW` intent to `<id>.MainActivity` with the extra `…shareintent.OPEN` = `capture|search|today`), hooked to the launcher activity with `<meta-data android:name="android.app.shortcuts">`; labels in `res/values{,-de,-es,-fr,-pt-rBR}/strings.xml`, own vector icons (a library cannot safely reference the app's mipmaps).
- `CaptureTileService.kt`: tile "Nemo: Erfassen" (`BIND_QUICK_SETTINGS_TILE`), starts the launch intent of its own package with the same extra; `startActivityAndCollapse(PendingIntent)` from Android 14, the `Intent` variant before; unlocks first. Reads no data.
- `ShareIntentPlugin.kt` keeps the extra as `open` next to a pending share; `share.ts` lets only the three values through; `nativeShare.ts` opens the capture sheet, the palette or `/` (a waiting share wins).
- **Application id:** `${applicationId}` works in the manifest, not in resource XML. `shortcuts.xml` names the stable id; `scripts/android-shortcuts.mjs <tauri config>` rewrites the targets right after `tauri android init` in `release.yml` and `dev-preview.yml` (`scripts/lib/androidShortcuts.test.ts` pins file, languages and both steps). The tile needs no patch.

### Suggestion for a later manifest field

A `capture` contribution per module (`{ label, collection, build(fields) }`) would let modules declare their own adapter and remove `targets/`. Not done here on purpose (manifest types and registry are owned by the parallel module work).
