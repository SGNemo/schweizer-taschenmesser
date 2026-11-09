# 02 – Wecker & Timer (`feat/clock-alarm`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code

# Uhr, Paket 2: Wecker und Timer

Branch `feat/clock-alarm` von frischem `develop` (nach `fix/clock-followups`). Lies CLAUDE.md, web/src/modules/CLAUDE.md, docs/features/clock.md, docs/design/FOCUS-GUIDELINES.md + FOCUS-WORDING.md, docs/features/repeat-reminders.md, docs/features/game-mode.md, `core/notifications/policy.ts`, `modules/calendar` (Erinnerungen: Schema, `notifications.ts`, Route-Parameter), `tools/timer/*`, `modules/clock/*`. Starte mit `npm run chats:status` und dem Scribble-Ordner.

## Wunsch (Sven)
Aus Paket 1 vertagt: „Wecker, Timer“. Anlass: Wer Orte in anderen Zeitzonen hat, will sich zu deren Zeit erinnern lassen („Mama um 19 Uhr ihrer Zeit anrufen“) und kurz etwas stoppen.

## Phase 1 – Entscheidung (dann STOPP, max. 4 Fragen mit Empfehlung)
- Eigenes Wecker-System in der Uhr **oder** Erinnerungen des Kalenders nutzen? Empfehlung: kein eigener Alarm-Motor (Benachrichtigungs-Regeln, Zock-Modus, Wiederholen gibt es schon); die Uhr legt eine Kalender-Erinnerung an – Zeit des Ortes in Ortszeit umgerechnet, Ort im Titel. Weg ohne Modul-Import: Route `/calendar?new=reminder&date&time&title` (additiv im Kalender) oder Contribution; prüfen, was es schon gibt.
- Wiederkehrend („jeden Sonntag 19 Uhr Tokio-Zeit“): bei Sommerzeit-Wechsel verschiebt sich die Ortszeit. Empfehlung: Wiederholung in der Zeitzone des Ortes speichern? Das wäre ein Feld am Kalender-Eintrag (Vertragsänderung) – sonst nur einmalige Erinnerungen in Paket 2 und Wiederholung später.
- Timer: Werkzeug bleibt Werkzeug; die Uhr-Seite verlinkt es (⋯ → „Timer“), kein zweiter Timer. Empfehlung: ja.
- Plattformen: Android exakte Alarme (Berechtigung), Desktop-Tray, PWA nur bei offener App – was zeigt die Uhr, wenn eine Plattform nicht pünktlich klingelt? Empfehlung: dieselbe ruhige Zeile wie bei Kalender-Erinnerungen.

## Phase 2 – Bauen (nach Freigabe)
- Je Ort im ⋯-Menü „Erinnern um …“ (Uhrzeit des Ortes, Datum, Text) → Vorschau „Bei dir: Mi 11:00“ → Kalender-Erinnerung; Undo-Toast.
- Sommerzeit: Test mit zwei Daten (Wechsel nur an einem Ort), Umrechnung über `core/time/zones.ts` (`zonedInstant`).
- Strings de/en, E2E (Erinnerung anlegen → Kalender zeigt sie zur umgerechneten Zeit), 412 px.
- Fokus-Checkliste 1–9 im PR: keine neuen Benachrichtigungsarten, Lautstärke/Zock-Modus wie Kalender, keine Wiederholungs-Flut.

## Nicht in diesem Paket
Eigene Alarm-Engine, Wecker-Töne, Schlummern-Schleifen, Besprechungsplaner, Wetter.

## Abnahme
`npm run check`, `test`, `check:modules`, `check:i18n`, `e2e` grün; Screenshots hell/dunkel, Desktop/412; `.changes/` DE+EN; STATUS eine Zeile; decisions-Bullet in `docs/decisions/modules.md`; docs/features/clock.md Tabelle aktualisieren; CHATS.md rein/raus. Nach „Plan freigegeben“: Full stop.
```
