# 04 – Wetter je Ort (`feat/clock-weather`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code

# Uhr, Paket 4: Wetter bei den Orten

Branch `feat/clock-weather` von frischem `develop` (nach `fix/clock-followups`). Lies CLAUDE.md, web/src/modules/CLAUDE.md, docs/features/clock.md, docs/features/weather.md, docs/legal/DATA-FLOWS.md, `core/weather/*` (API, Cache, Logik – Kern, darf genutzt werden), `core/net/netlog.ts`, `core/legal/notices.ts`, `modules/weather` (nur lesen: Module importieren sich nie), `modules/clock/*`, `core/time/cities.ts`. Starte mit `npm run chats:status` und dem Scribble-Ordner.

## Wunsch (Sven)
Aus Paket 1 vertagt: „Wetter je Ort“. Neben der Uhrzeit eines Ortes kurz sehen, wie das Wetter dort ist.

## Phase 1 – Entscheidung (dann STOPP, max. 4 Fragen mit Empfehlung)
- Netz: Die Uhr ist heute vollständig offline. Empfehlung: Schalter „Wetter bei Orten zeigen“ in den Uhr-Einstellungen, **standardmäßig aus**; beim Einschalten der Hinweis, was das Gerät verlässt (Koordinaten gerundet an Open-Meteo, wie das Wetter-Modul).
- Koordinaten: Geocoding per Netz **oder** Koordinaten in der Städtetabelle (`cities.ts` um lat/lon erweitern, offline)? Empfehlung: Tabelle; Orte nur aus einer Zeitzone („Asia/Kolkata“) bekommen kein Wetter (ruhige Zeile „kein Wetter für Zeitzonen“). Speichern: Koordinaten nicht in `clock_place`, sondern aus Zone+Name nachschlagen? Oder Feld `lat/lon` (Migration)? Empfehlung: Feld, gerundet auf 2 Stellen, gesetzt beim Hinzufügen.
- Wo sichtbar: nur Seitenzeilen (Symbol + Temperatur + Wort), nicht im Widget? Empfehlung: nur Seite (Widget bleibt ruhig), Widget-Zeile später nach Stimulus-Messung.
- Abruf: gemeinsamer Cache mit dem Wetter-Modul über `core/weather/cache.ts`, höchstens alle 60 min je Ort, nichts im Hintergrund. Empfehlung: ja.

## Phase 2 – Bauen (nach Freigabe)
- `cities.ts` mit gerundeten Koordinaten (Quelle im Kommentar, frei lizenziert; Test: jede Zeile hat lat/lon im gültigen Bereich), Migration `clock_place` (+ `lat`, `lon` optional).
- Abruf über `core/weather`, Netlog-Host, Datenfluss-Zeile in DATA-FLOWS + `strings.legal.ts`, Notice-Id falls nötig.
- Zeile: Wetter-Symbol mit Text (nie nur Farbe), Temperatur in der Einheit der Wetter-Einstellung (Kern-Setting lesen, nicht das Modul).
- Offline/Fehler: ruhige Zeile, keine Rotfarbe, kein Wiederholen in Schleife.
- Strings de/en, E2E mit gemocktem Netz (Schalter an → Zeile; aus → kein Request), 412 px.

## Nicht in diesem Paket
Vorhersage, Warnungen, Luftqualität je Ort, Wetter im Widget, Karten.

## Abnahme
`npm run check`, `test`, `check:modules`, `check:i18n`, `e2e` grün; Screenshots hell/dunkel, Desktop/412; `.changes/` DE+EN; STATUS eine Zeile; decisions-Bullet (Netz in der Uhr, Koordinaten offline); DATA-FLOWS-Zeile; docs/features/clock.md aktualisieren; CHATS.md rein/raus. Nach „Plan freigegeben“: Full stop.
```
