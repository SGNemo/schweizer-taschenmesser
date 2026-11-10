# 03 – Besprechungsplaner (`feat/clock-meeting-planner`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code

# Uhr, Paket 3: Besprechungsplaner (passende Uhrzeit über mehrere Orte)

Branch `feat/clock-meeting-planner` von frischem `develop` (nach `fix/clock-followups`). Lies CLAUDE.md, web/src/modules/CLAUDE.md, docs/features/clock.md, docs/design/MODULE-IDENTITY.md, DESIGN-SPEC.md, FOCUS-GUIDELINES.md, `modules/clock/*`, `core/time/zones.ts`, `tools/timezones/*` (Umrechner, nicht doppeln), `modules/calendar` (wie ein neuer Termin per URL vorbelegt wird). Starte mit `npm run chats:status` und dem Scribble-Ordner.

## Wunsch (Sven)
Aus Paket 1 vertagt: „Meetings-Planer-Matrix“. Ziel: für zwei bis vier Orte auf einen Blick eine Stunde finden, die überall eine vernünftige Uhrzeit ist, und daraus einen Termin machen.

## Phase 1 – Entscheidung (dann STOPP, max. 4 Fragen mit Empfehlung)
- Ort: eigene Ansicht auf der Uhr-Seite (`?view=plan`, Segmented „Orte | Planen“) **oder** im Zeitzonen-Werkzeug? Empfehlung: Uhr-Seite (die Orte sind dort; das Werkzeug bleibt ein Umrechner).
- „Vernünftige Uhrzeit“: feste Spanne (z. B. 8–20 Uhr) **oder** Arbeitszeit je Ort als Feld (`workFrom`, `workTo` in `clock_place` → `manifest.version` + Migration, `db:bump` nur bei Index)? Empfehlung: Feld mit Standard 9–17, ohne Index.
- Darstellung ohne Reizflut: Stundenleiste je Ort (24 Zellen), passende Stunden als Text/Icon „passt überall“, nie nur Farbe; am Handy eine Liste der passenden Stunden statt Matrix? Empfehlung: Desktop Matrix, 412 px Liste.
- Übergabe an den Kalender ohne Modul-Import: URL-Parameter (`/calendar?new=1&date&time&title`, additiv im Kalender) **oder** KI-/Erfassungs-Weg? Empfehlung: URL-Parameter, falls der Kalender sie noch nicht kennt: kleine additive Änderung mit Heads-up.

## Phase 2 – Bauen (nach Freigabe)
- Auswahl der Orte (Häkchen, Standard: alle, max. 4 in der Matrix), Datum (heute/morgen/Datumsfeld), Stundenraster in Ortszeit, die eigene Zeit als erste Zeile.
- Logik rein in `modules/clock/planner.ts` (getestet: Sommerzeit-Woche, halbe Stunden wie Indien, Tageswechsel), Ansicht nur aus Katalog-Bausteinen.
- „Termin anlegen“ → Kalender mit vorbelegtem Datum/Uhrzeit (Ortszeit → eigene Zeit), Titel „Besprechung: Tokio, New York“.
- Strings de/en, a11y (Tabelle mit Kopfzeilen/`scope`, Tastatur), E2E (zwei Orte → passende Stunde → Kalender-Dialog vorbelegt), 412 px ohne Überlauf, Stimulus-Budget prüfen.

## Nicht in diesem Paket
Einladungen versenden, Teilnehmer, Kalender anderer Personen, Wecker, Wetter.

## Abnahme
`npm run check`, `test`, `check:modules`, `check:i18n`, `e2e` grün; Screenshots hell/dunkel, Desktop/412; `.changes/` DE+EN; STATUS eine Zeile; decisions-Bullet; docs/features/clock.md aktualisieren; CHATS.md rein/raus. Nach „Plan freigegeben“: Full stop.
```
