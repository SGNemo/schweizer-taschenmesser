# 01 – Folgepunkte aus Paket 1 (`fix/clock-followups`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code

# Uhr: Höchstgrenze von 12 Orten überall gleich (Folgepunkt aus #615)

Branch `fix/clock-followups` von frischem `develop`. Lies CLAUDE.md, web/src/modules/CLAUDE.md, docs/features/clock.md, dann nur: `modules/clock/{repo,aiDefaults,manifest}.ts`, `quickCapture/targets/{index,adapters,types}.ts`, `core/ai/write/prepare.ts`. Starte mit `npm run chats:status` (im Cloud-Klon vorher `git fetch --deepen=1000 origin develop`) und dem Scribble-Ordner.

## Problem
Der Dialog „Ort hinzufügen“ hört bei 12 Orten auf (`MAX_PLACES` in `modules/clock/repo.ts`). Die Schnellerfassung („uhr Tokio“) und die KI-Aktion `clock.create` legen trotzdem einen 13. Ort an: `CaptureTarget.build` ist synchron und kann nicht zählen, `aiCreateDefaults` kann nicht ablehnen. Die Seite zeigt dann 13 Orte unter dem Satz „mehr passen nicht“.

## Lösung (kleinste, additiv)
- Schnellerfassung: im asynchronen Speicherpfad (`saveCapture` in `quickCapture/targets/index.ts`) vor dem Schreiben zählen. Additiv ein optionales Feld am `CaptureTarget` (z. B. `maxActive?: number`), das `saveCapture` gegen die aktiven Zeilen der Ziel-Collection prüft und dann `CaptureError` mit einem neuen Code (`full`) wirft. Text im Formular ruhig: „Die Uhr hat schon 12 Orte. Entferne einen auf der Uhr-Seite.“ (de/en). Kein Modul-Import im Adapter.
- KI: dieselbe Grenze in der Vorschau. Prüfe, ob `prepare.ts` schon einen Weg hat, ein `create` als nicht ausführbar zu markieren (Fehlertext statt Commit). Wenn nur über eine Vertragsänderung in `core/modules/types.ts` (Hotspot) möglich: additives optionales Feld, Heads-up-Zeile in docs/CHATS.md zuerst. Wenn das größer als ~30 Zeilen wird: KI-Teil weglassen, im PR begründen.
- Tests: ein Fall pro Weg (13. Ort per Erfassung → `full`, Undo unberührt; KI-Vorschau → Fehler, nichts geschrieben); `clock.targets.test.ts` und der Registry-Test der KI-Aktionen bleiben grün.

## Nicht in diesem Paket
Unbekannte Zeitzone von der KI („JST“) korrigieren (Defaults ersetzen nie ein gegebenes Feld; die Ablehnung ist sauber – so lassen). Kein Umbau von `aiDefaults.ts`.

## Abnahme
`npm run check`, `test`, `check:modules`, `check:i18n`, E2E `clock.spec.ts` grün; `.changes/`-Notiz DE+EN; docs/features/clock.md „Follow-ups“ Punkt 1 als erledigt markieren (eine Zeile); CHATS.md-Zeile rein/raus. Full stop.
```
