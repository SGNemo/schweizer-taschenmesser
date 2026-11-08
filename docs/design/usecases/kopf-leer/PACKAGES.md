# Use case „Kopf leer“ – packages (phase 3, final prompts)

Decisions: [TARGET.md](TARGET.md) §6 answered 2026-11-08 with the recommended options (Q1 a: a batch never books, Q2 a: medium mail package, Q3 a: „<Absendername> · <Betreff>“, Q4 a: count with its calming sentence), recorded in [`docs/decisions/features.md`](../../../decisions/features.md) and [`docs/decisions/plan.md`](../../../decisions/plan.md). Template: [plan/PACKAGES.md](../../plan/PACKAGES.md). One package = one chat, one branch, one PR against `develop`; paste one prompt per chat. Order 1 → 2 → 3 → 4; 2 waits for 1 (`CaptureForm.tsx`), 3 waits for 2 (it uses the lookup and `amend`), 4 last. Not now (own decision later): the explicit mode „Abladen“ (TARGET F1 large, Q1 d) and the automation „Label → Plan“ (F2 large, Q2 c).

| #   | Package                                                                        | Branch                           | Scope                                                                                                                                                                                                                                                                                                                                                                                                | Hotspots to announce (row in CHATS.md „Hotspots“)                                     | Acceptance figures (script `web/e2e/usecases/kopf-leer.spec.ts`)                                                                                                |
| --- | ------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Batch without a detour, planner shows less, mail URL and share target          | `fix/capture-batch-calm`         | `quickCapture/parser/index.ts` (spend words), `quickCapture/ui/CaptureForm.tsx` (booking line leaves the batch, closing line), `quickCapture/targets/index.ts` (batch result), `core/mail/prefill.ts` (URL without address, `extra.link`), `modules/mail/components/LinkDialog.tsx`, `pages/ShareTarget.tsx`, `modules/planner/routes/PlannerPage.tsx` (fold, head line), strings DE/EN, `.changes/` | none                                                                                  | A: 2 taps · 1 dialog · 0 detours (from 3 · 2 · 1); D: ≤ 13 rows PC / ≤ 5 phone, ≤ 280 / ≤ 200 words, ≤ 700 / ≤ 800 px scroll                                    |
| 2   | The many-lines sheet becomes calm; reminder words with the open-invoice lookup | `feat/capture-multi-calm`        | `quickCapture/ui/CaptureForm.tsx` (rows as text, choice on tap), `@/ui/Dialog` (backdrop variant), `quickCapture/parser/index.ts` (reminder words), `quickCapture/targets/{types,adapters,index}.ts` (`CaptureFields.dunning`, open-invoice lookup, `CaptureTarget.amend?`, `SaveOptions.id` create-if-absent, `existed`), strings, `.changes/`                                                      | `quickCapture/targets/types.ts` (additive), `ui/Dialog.tsx` (additive prop) – one row | A: 0 attention cards visible through the backdrop, 0 selects in the sheet (from 1 · 5); taps unchanged (2); a typed „Mahnung“ never doubles an open invoice     |
| 3   | „In den Plan“ from a mail, filter „Persönlich“, invoice in one tap             | `feat/mail-plan-actions`         | `modules/mail/**` (row action, thread action, filter chip, folder batch with preview, `?open=`, link rows of type `todo`), `core/mail/{heuristics,prefill}.ts`, `connectors/google/{gmail,mail}.ts` (two headers more in the list fetch), `modules/planner/routes/PlannerPage.tsx` („Zur Mail“), `modules/todos` row (mail link opens in the app on the desktop), strings, `.changes/`               | none new (uses what package 2 added)                                                  | B: 2 taps · 0 dialogs for two mails (from 9 · 2); eight personal mails: 3 taps + one preview; a second desktop never re-opens or deletes what the first created |
| 4   | Nachmessen                                                                     | `qa/usecase-kopf-leer-remeasure` | `web/e2e/usecases/kopf-leer.spec.ts` (`MAX` and bounds to the target column), `docs/design/usecases/kopf-leer/{ANALYSIS,TARGET}.md` (one „measured after“ table), STATUS, CHATS row                                                                                                                                                                                                                  | none                                                                                  | every target figure of TARGET §4 met, or the difference named with its reason                                                                                   |

Each package: own branch from fresh `develop`, PR against `develop`, row in CHATS.md, `.changes/` note (DE/EN; package 4: label `no-changelog`), STATUS one line, decisions only where something turned out differently, the focus checklist (1–9) answered in the PR text, the use-case script green against the package (`USECASE_SEED_URL` for the mail path). Model: Claude Opus. Skills: `council` per package with the lenses named in the prompt, then `full stop` (PR against `develop`, council table in the PR description, never merge).

### Prompt – package 1: batch without a detour, planner shows less, mail URL and share target (`fix/capture-batch-calm`)

```
# Aufgabe: Kopf leer – Stapel ohne Umweg, Planer zeigt weniger, Mail-URL ohne Adresse, geteilter Text in einer Zeile (Paket 1 von 4)

Routing: Claude Code · Kopf leer Paket 1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `fix/capture-batch-calm` von frischem `develop`. Vorgegebene Session-Branches ignorieren. Keine Hotspots.

## Ausgangslage
Zielbild freigegeben: docs/design/usecases/kopf-leer/TARGET.md (§1 „nur Wording/Reihenfolge/Default“, §5 Paket 1, §6 Antworten), Reibung in ANALYSIS.md (U03, U04, U05, U09, U12, U13, U17). Lies `quickCapture/ui/CaptureForm.tsx` (`rowsNeedConfirm`, `confirming`, Zeilen 255–257 und 387–415), `quickCapture/parser/index.ts` (`KEYWORDS.spend`, Zeile 86; `invoice`, Zeile 84 – **Mahnungswörter kommen erst in Paket 2**), `quickCapture/targets/index.ts` (`saveCaptures`, Rückgabe), `core/mail/prefill.ts` (`note: link`, Zeilen 112–119; `extra` ist `{ note?, url? }`), `connectors/google/gmail.ts` (`webUrl`, Zeilen 338–341: `?authuser=<Adresse>`), `modules/mail/components/LinkDialog.tsx` (Zeile 128, `extra={prefill.extra}`), `pages/ShareTarget.tsx` (Zeilen 93–95), `modules/planner/routes/PlannerPage.tsx` (Zeile 577 Kopfzeile, Zeilen 690–703 Wartegruppe), `ui/GroupedList.tsx` (`defaultClosed`), docs/design/FOCUS-WORDING.md, docs/decisions/features.md („Mail → Nemo entries“).

## Pflichtliste
- Parser: „bezahlt“, „gekauft“ als Ausgabe-Wörter (eine Zeile mit Betrag und einem dieser Wörter bleibt Buchung); Korpus um die Sätze aus TARGET §3 erweitern (ohne Mahnungswörter). `$` erzwingt weiter Finanzen.
- Stapel (mehrere Zeilen): eine Buchungszeile verlässt den Stapel – sie wird ToDo mit dem Betrag im Titel und einem Chip „Als Ausgabe buchen“, der den Einzel-Zettel mit der Zeile vorbelegt öffnet (Antwort Q1 a). Der Bestätigungskasten und der zweite „Alle speichern“ entfallen im Stapel; der Einzel-Zettel behält Entwurf und „Buchen“ unverändert (`quick-capture.spec.ts` „finance stays a draft“ bleibt grün). Test in `capture-multi.spec.ts`: Stapel mit einer Geldzeile → ein Tipp speichert alles, nichts gebucht, Chip vorhanden.
- Abschlusszeile nach einem Stapel: „5 Dinge gespeichert. Sortiert wird später. · Ansehen · Rückgängig“ („Ansehen“ öffnet die ToDo-Seite mit „Eingang sortieren“, bei aktivem Planer `/planner`); der Einzel-Toast bleibt. Neue Strings DE + EN.
- `LinkDialog` gibt `extra.link = { kind: 'mail', id: <threadId>, label: <Betreff> }` mit (U09); der ToDo-Adapter schreibt es schon in `links[]`.
- Mail-URL in Notizen ohne `?authuser=<Adresse>` (`prefill.ts`: `webUrl(threadId)` ohne E-Mail; die Standard-Adresse öffnet, ein anderes Konto wählt die Person in Gmail). Test: kein `@` in der gespeicherten Notiz. Bestehende Einträge bleiben.
- `ShareTarget`: geteilter Text wird **eine** Zeile (erste nicht-leere Zeile = Titel, Rest nur hinter einem Häkchen „Text als Notiz“, Standard aus) – kein Aufteilen in Zeilen, keine Notiz ohne Häkchen. Test: eine geteilte Mail mit Zeilenumbrüchen → ein ToDo, Notiz leer; mit Häkchen → Notiz gefüllt.
- Planer: Gruppe „Wartet auf freie Zeit“ `defaultClosed`, Kopf „Wartet auf freie Zeit · 16 · Nichts davon muss heute sein.“ (Antwort Q4 a); der Überlast-Satz steht im geöffneten Zustand oben in der Gruppe und im Wochen-Hinweis wie bisher; der Grund je wartender Zeile wandert hinter „Warum hier?“. Kopf-Detailzeile: voller Tag „Heute: <erstes geplantes Ding>. Das reicht für heute.“, Tag ohne Zeit „Heute ist frei. <nächster Tag>: <frei>.“ (Variante der Glossarzeile „Day plan full“, in FOCUS-WORDING ergänzen). `planner.spec.ts`: Wartegruppe vor dem Lesen öffnen.
- Mess-Skript `web/e2e/usecases/kopf-leer.spec.ts` grün (Pfad A: 2 Taps, 0 Umwege; Pfad D: Zeilen/Wörter/Scroll im Ziel); `MAX` **nicht** senken (das macht Paket 4).

## Nicht in diesem Paket
Mahnungswörter und Rechnungs-Abgleich (Paket 2), die ruhige Form der Mehrzeilen-Vorschau (Paket 2), alles an der Mail-Liste (Paket 3), Modul-Standards, Tresor, Sync.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; `npx playwright test e2e/usecases/kopf-leer.spec.ts e2e/capture-multi.spec.ts e2e/quick-capture.spec.ts e2e/planner.spec.ts`.
- Fokus-Checkliste 1–9 im PR-Text; Klickzahlen Pfad A vorher/nachher (3 → 2 Taps, 1 → 0 Umwege).
- Docs: STATUS eine Zeile; `docs/decisions/features.md` eine Bullet (Stapel bucht nie; URL ohne Adresse; geteilter Text eine Zeile), `docs/decisions/plan.md` eine Bullet (Kopf der Wartegruppe); `docs/features/quick-capture.md` zwei Sätze; `.changes/`-Notiz (DE/EN); Zeile in CHATS.md rein und im letzten Commit raus.

## Skills
Nach dem Bau `council` über den Diff (Guardian: Finanzregel „gebucht nur nach Bestätigung“ – im Stapel wird nie gebucht, der Einzel-Zettel unverändert; keine Adresse mehr in gespeicherten URLs; geteilter Text nie ohne Häkchen in eine Notiz; Advocate: Abschlusszeile, Kopfzeilen und Gruppenkopf nach FOCUS-WORDING, nichts zählt hoch, keine Frage beim Abladen; Architect: Parser-Korpus, keine Modul-Importe, `LinkDialog` nur `extra.link`). Danach `full stop`: PR gegen develop, Council-Tabelle in der PR-Beschreibung, kein Merge.
```

### Prompt – package 2: the many-lines sheet becomes calm; reminder words with the open-invoice lookup (`feat/capture-multi-calm`)

```
# Aufgabe: Kopf leer – der mehrzeilige Zettel wird ruhig, Mahnungswörter mit Rechnungs-Abgleich (Paket 2 von 4)

Routing: Claude Code · Kopf leer Paket 2 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/capture-multi-calm` von frischem `develop` – nach dem Merge von Paket 1. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `quickCapture/targets/types.ts` (additiv: `SaveOptions.id`, `SavedCapture.existed`, `CaptureFields.dunning`, `CaptureTarget.amend?`) und `ui/Dialog.tsx` (additive Prop), ein Chat. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Zielbild freigegeben: docs/design/usecases/kopf-leer/TARGET.md (F1 mittel, F3 „Mahnung“ und „amend“, §3 Nebenwirkungen und Gegenszenarien 1 und 5, §6 Antworten Q1 a). Lies `quickCapture/ui/CaptureForm.tsx` (Mehrzeilen-Vorschau, `capture-rows`, `capture-row-type`), `quickCapture/parser/{index,split,types}.ts`, `quickCapture/targets/{types,adapters,index}.ts` (`saveCapture`, `saveTwoStage`, `saveCaptures`, `SavedCapture.undo` = `repo.remove`), `core/db/repo.ts` (`create` überschreibt und belebt Tombstones – **nicht** als Guard nutzen; `createMany` überspringt bestehende Ids samt Tombstones; `upsert`, `restore`), `core/mail/heuristics.ts` (Regex `RE.invoice`), `modules/invoices/schema.ts` (`dunningLevel` 0–3, `dunnedAt`, `payments[]`, `reference`), `ui/Dialog.tsx` + `Dialog.module.css` (`--overlay`), `layout/AppShell.tsx` (Zettel-Besitzer), `quickCapture/capture/CaptureWindow.tsx`, docs/design/FOCUS-GUIDELINES.md.

## Pflichtliste
- Mehrzeilen-Vorschau: je Zeile Titel und Ziel als **Text** („ToDo“, „Rechnung · 13. Okt. · Datum angenommen“, „Termin · Do 9 Uhr“); ein Tipp auf den Text öffnet die Wahl (Select verschwindet aus der ersten Ansicht); keine Frage beim Abladen (Fristen bleiben beim Sortierer und auf dem Brett); Hinweis „Eine Zeile = ein Eintrag.“ (bestehend) + „Sortiert wird später.“ (aus Paket 1); Abschlusszeile aus Paket 1 unverändert. Komponententest; `capture-multi.spec.ts` anpassen (Ziel per Tipp wechseln).
- Backdrop: additive Prop am `@/ui`-`Dialog` (z. B. `backdrop: 'dim' | 'opaque'`), vom Zettel-Besitzer (`AppShell`, Hotkey-Fenster) auf `opaque` gesetzt – ab dem Öffnen, einzeilig wie mehrzeilig, die Seite bleibt gemountet (nichts springt beim Tippen); `LinkDialog` und alle anderen Dialoge behalten `dim`. Der Wert muss als dreikomponentige Farbe serialisieren (`rgb(…)`), das Mess-Skript liest `::backdrop` (`web/e2e/usecases/kopf-leer.spec.ts`, Pfad A: „0 cards“).
- Parser: Mahnungswörter wie in `core/mail/heuristics.ts` (mahnung, zahlungserinnerung, zahlungsaufforderung) als Rechnungswörter; „zahlen“ ohne Ausgabe-Wort zeigt auf Rechnung, nicht Buchung; Korpus (B12) erweitern.
- Rechnungs-Abgleich in der Zielschicht (`quickCapture/targets`, modulfrei, liest `invoices_invoice` über das Manifest-Repo wie der Adapter schreibt): Reihenfolge Referenz/Rechnungsnummer → normalisiertes Empfänger-Präfix („Stadtwerke“ ⊂ „Stadtwerke Musterstadt GmbH“, auch nach „im Auftrag von“) mit Betrag ≥ offenem Rest (`payments[]`) innerhalb einer Gebührentoleranz → älteste überfällige; zwei gleich gute Kandidaten im Stapel → die Zeile bleibt ToDo „Mahnung <Empfänger> prüfen“ (keine Frage beim Abladen). Treffer → Zeilentext „Mahnung zu Rechnung <Empfänger>, fällig <Datum> · vermerken“.
- `CaptureTarget.amend?` (erster Lese-und-Schreib-Pfad der Zielschicht): schreibt genau drei Dinge auf die gefundene Rechnung – `dunningLevel` + 1 (Deckel 3), `dunnedAt` = Datum der Zeile/Mail, eine Notizzeile „Mahnung vom <Datum>: <Betrag> bis <Frist>“; Betrag und Fälligkeit bleiben (Geldänderung nur im Editor); idempotent (nichts, wenn `dunnedAt` ≥ Datum); gibt ein `SavedCapture` zurück, dessen `undo` Stufe, Datum und Notiz wiederherstellt und **nie** löscht; Stapel-Undo und Stapel-Rollback (`saveCaptures`) funktionieren mit einer vermerkten Zeile (Tests). Ohne Treffer: neue Rechnung mit `dunningLevel: 1`, `dunnedAt`; additives Feld `CaptureFields.dunning?: { level, date }`, vom Rechnungs-Adapter abgebildet.
- `SaveOptions.id` (additiv, optional): erste Stufe über `createMany([{ data, id }])` – leeres Ergebnis = vorhanden (lebend oder Tombstone) → **beide** Stufen stoppen (kein `upsert` des Planer-Items), `SavedCapture.existed: true`, kein `undo`; Tombstone-Fall als eigenes Ergebnis (`existed: 'tombstone'`), damit der Aufrufer „Wieder einplanen“ (`restore` + zweite Stufe) anbieten kann. Unit-Tests: lebende Id stoppt beide Stufen und registriert kein Undo; Tombstone liefert den Wiederherstellungspfad; gleicher Aufruf auf zwei Geräten erzeugt eine Id. (Paket 3 nutzt das für Mails.)
- Mess-Skript grün: Pfad A zeigt 0 Karten durch den Backdrop und 0 Selects, 2 Taps; `MAX` nicht senken.

## Nicht in diesem Paket
Mail-Liste und Mail-Aktionen (Paket 3), der explizite Modus „Abladen“ (später, eigene Entscheidung), Änderungen an Rechnungsfeldern (keine neuen Felder), Share-Target (Paket 1), Tresor, Sync-Regel.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; `npx vitest run src/quickCapture`; `npx playwright test e2e/usecases/kopf-leer.spec.ts e2e/capture-multi.spec.ts e2e/quick-capture.spec.ts e2e/capture-phone.spec.ts`.
- Fokus-Checkliste 1–9 im PR-Text (Reizlast der ersten Ansicht vorher/nachher: Selects 5 → 0, Karten 1 → 0; Entfernt: Select je Zeile und zweiter „Alle speichern“).
- Docs: STATUS eine Zeile; `docs/decisions/features.md` eine Bullet (`amend`, create-if-absent über `createMany`); `docs/features/quick-capture.md` Abschnitt „Mehrere Dinge auf einmal“ nachziehen; `docs/howto/design-rules.md` ein Satz zum Backdrop; `.changes/`-Notiz (DE/EN); Hotspot-Zeile und CHATS-Zeile im letzten Commit raus.

## Skills
Nach dem Bau `council` über den Diff (Guardian: im Stapel wird nie gebucht; `amend` ändert nie Betrag oder Fälligkeit, Undo stellt wieder her und löscht nie; create-if-absent belebt keinen Tombstone und löscht nichts Fremdes; Architect: Zielschicht bleibt Core und modulfrei, `createMany` statt `create`, beide Stufen stoppen, Vertrag additiv; Advocate: erste Ansicht ohne Selects, kein Fragezeichen beim Abladen, Backdrop ohne Sprung, Wording nach FOCUS-WORDING). Danach `full stop`: PR gegen develop, Council-Tabelle in der PR-Beschreibung, kein Merge. Ein STOPP vor dem Council, wenn `createMany` den Tombstone-Fall nicht unterscheidbar macht (Frage mit Empfehlung).
```

### Prompt – package 3: „In den Plan“ from a mail, filter „Persönlich“, invoice in one tap (`feat/mail-plan-actions`)

```
# Aufgabe: Kopf leer – „In den Plan“ aus der Mail, Filter „Persönlich“, Rechnung in einem Tipp (Paket 3 von 4)

Routing: Claude Code · Kopf leer Paket 3 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/mail-plan-actions` von frischem `develop` – nach dem Merge von Paket 2 (nutzt `SaveOptions.id`, `existed`, `CaptureFields.dunning`, `amend`). Keine neuen Hotspots. Vorgegebene Session-Branches ignorieren. Nur Windows-App: das Mail-Modul ist `platforms: ['desktop']`.

## Ausgangslage
Zielbild freigegeben: docs/design/usecases/kopf-leer/TARGET.md (F2 mittel, F3, §3 Gegenszenarien 2 und 4, §6 Antworten Q2 a und Q3 a). Lies `modules/mail/{manifest,schema,links,rowActions,settings}.ts` (`LINK_TYPES` ohne `plan`; `link`-Tabelle `local: true`), `modules/mail/components/{LinkMenu,LinkDialog,LinkedEntries,ThreadView}.tsx`, `modules/mail/routes/MailPage.tsx` (Labels, Suche, Zeilen), `modules/mail/widgets/InboxWidget.tsx`, `core/mail/{heuristics,prefill,types}.ts` (`MailMeta.bulk` aus `List-Unsubscribe`, `senderName`, `analyzeMessage`), `connectors/google/gmail.ts` (Zeile 239 `metadataHeaders`) und `connectors/google/mail.ts` (Zeile 77), `quickCapture/targets/index.ts` (`saveCapture('plan')`, `availableTypes`), `modules/planner/routes/PlannerPage.tsx` (Zeile 448 „Zur Notiz“), `modules/todos` (Zeile mit `links`), `core/importer/ImportPreview.tsx` (Vorschau-Muster), `core/mail/isolation.test.ts`, docs/decisions/features.md („Mail → Nemo entries“, Vorschau-Pflicht), docs/decisions/automation.md.

## Pflichtliste
- Zeilenaktion und Thread-Aktion „In den Plan“ (bei ausgeschaltetem Planer „Als ToDo“): ruft `saveCapture('plan' | 'todo', …)` mit Titel „<Absendername> · <Betreff>“ (Antwort Q3 a; „Re:/AW:“ gestrichen; ein Verb nur, wenn die Heuristik sicher ist), `estimateMin: 15`, weiche Frist aus dem Text, `link: { kind: 'mail', id: <threadId>, label: <Betreff> }`, Notiz = URL ohne Adresse (Paket 1), `id: 'mail-<hash(threadId)>'`, keine Vorschau (Antwort Q2 a: das ändert die „Vorschau-Pflicht“ vom 2.11. für diese eine Aktion – der Titel steht im Hover/Menü, der Toast „Im Plan: Mi · Rückgängig“ nennt den Tag; „Aus dieser Mail anlegen“ behält den Zettel). `existed: true` → nur die eigene `link`-Zeile (Typ `todo`, Modul `todos`, Sammlung `item`), Toast „schon im Plan“, kein Undo; Tombstone → Aktion „War im Plan · Wieder einplanen“. Zeile zeigt danach „im Plan“ als Text aus der `link`-Zeile.
- Filter-Chip „Persönlich“ in der Mail-Liste (Einstellung „Persönlich anbieten“, Standard an): Absender ist eine Person – kein `List-Unsubscribe`/`Precedence: bulk`, keine Gmail-Massenkategorie; die Listen-Abfrage holt dieselben Kopfzeilen wie der Scan (`metadataHeaders` + `List-Unsubscribe`, `Precedence`). Keine Zahl, kein Badge.
- „Alle in den Plan…“ am Ordner/Filter (Einstellung „Alle in den Plan anbieten“, Standard an): Vorschau-Liste mit Häkchen (persönliche Absender an, Massenmails und schon verknüpfte Threads aus), ein Knopf „In den Plan (n)“, ein Undo für alles, was dieser Tipp anlegte.
- Rechnungs-Zeile (Einstellung „Rechnungen in der Liste erkennen“, Standard an): bei sicherem Betrag und Datum „<Empfänger> · <Betrag> · fällig <Datum> · Anlegen“ → `saveCapture('invoice', …)` mit `id: 'mail-<hash(messageId)>'`, danach „Rechnung angelegt · Rückgängig“; Mahnungswort → Abgleich aus Paket 2: Treffer „Mahnung zu Rechnung <Empfänger>, fällig <Datum> (<Betrag>) · <neuer Betrag> bis <Frist> · Mahnung vermerken“ (`amend`), zwei Kandidaten → Vorschau-Zettel mit Auswahl, kein Treffer → neue Rechnung mit `dunningLevel: 1`; fehlender Wert → heutiger Vorschau-Zettel; „wird abgebucht“ → Text „Abbuchung am <Datum> – nichts zu planen“ ohne Verb; Thread mit `link` vom Typ `invoice` → „angelegt“. Widget-Zeile „n Rechnungsmails …“ wird „n Rechnungen zum Anlegen“ mit Link auf die Liste.
- Zurück zur Mail: `MailPage` versteht `?open=<threadId>` (Format prüfen, nur im lokalen Cache bzw. im eigenen Konto nachschlagen, sonst nichts); Planer-Zeile „Zur Mail“ für `link.kind === 'mail'` neben „Zur Notiz“; ToDo-Zeile öffnet einen Mail-Link am Desktop in der App, sonst die Web-URL.
- Datenschutz-Pins: `core/mail/isolation.test.ts` bleibt grün (kein Modell sieht Mail); Test: Titel und Link-Beschriftung enthalten nie die Adresse, nie den Gerätelokalen Kontoschlüssel; Stapel schreibt nur, was angehakt war.
- Mess-Skript Pfad B mit `USECASE_SEED_URL`: 2 Taps, 0 Dialoge für zwei Mails; `mail.seed.spec.ts` erweitern (Zeilenaktion, Filter, Stapel-Vorschau, „Anlegen“ zweimal → einmal angelegt, Mahnung → vermerkt).

## Nicht in diesem Paket
Automation „Label → Plan“ (eigene Entscheidung, kehrt „Mail meldet nur“ um), Mail auf Android/PWA, neue Felder an Rechnungen oder ToDos, Änderungen an `core/events`, Tresor, Sync-Regel.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; `npx vitest run src/core/mail src/modules/mail src/quickCapture`; `USECASE_SEED_URL=http://localhost:4174 npx playwright test e2e/usecases/kopf-leer.spec.ts --project=desktop-chrome` (Server: `npm run build:e2e-seed && npm run preview:e2e-seed`) und `npx playwright test --project=seed-dev e2e/seed/mail.seed.spec.ts`.
- Fokus-Checkliste 1–9 im PR-Text; Klickzahlen je Mail vorher/nachher (3 Taps + Dialog → 1 Tap); Reizlast der Mail-Zeile (eine gedämpfte Zeile, kein Zähler).
- Docs: STATUS eine Zeile; `docs/decisions/features.md` eine Bullet (Zeilenaktion ohne Vorschau als Ausnahme der Vorschau-Pflicht; Ids aus Thread/Nachricht; Link-Zeile Typ `todo`); `docs/user/modules.md` (+ `.de.md`) zwei Sätze zu Mail; `docs/legal/DATA-FLOWS.md` prüfen (zwei Kopfzeilen mehr, keine neue Stelle); `.changes/`-Notiz (DE/EN); CHATS-Zeile rein und im letzten Commit raus.

## Skills
Nach dem Bau `council` über den Diff (Guardian: was in ToDo-Titel, Link-Beschriftung und Notiz landet – nie Adresse, nie Kontoschlüssel, nie der Körper; Stapel nur mit Vorschau; create-if-absent auf dem zweiten Gerät; `?open=` als unvertraute Eingabe; `isolation.test.ts`; Architect: Zielschicht statt Bus, Link-Zeile Typ `todo`, Kopfzeilen-Abfrage, keine Modul-Importe; Advocate: „Persönlich“ ohne Zahl, Zeilenaktion wie „Archivieren“, Titel Name · Betreff, Rechnungszeile mit allen Werten vor dem Tipp, kein Rot in der Mail-Liste). Danach `full stop`: PR gegen develop, Council-Tabelle in der PR-Beschreibung, kein Merge. Ein STOPP vor dem Council, wenn die Heuristik ohne zusätzliche Kopfzeilen nicht zwischen Person und Massenmail unterscheiden kann (Frage mit Empfehlung).
```

### Prompt – package 4: Nachmessen (`qa/usecase-kopf-leer-remeasure`)

```
# Aufgabe: Kopf leer – Nachmessen (Paket 4 von 4)

Routing: Claude Code · Kopf leer Nachmessen · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `qa/usecase-kopf-leer-remeasure` von frischem `develop` – nach dem Merge der Pakete 1–3. Keine Hotspots. Label `no-changelog`.

## Ausgangslage
Zielzahlen: docs/design/usecases/kopf-leer/TARGET.md §4; Ist-Zahlen und Zählmodell: ANALYSIS.md §2; Skript `web/e2e/usecases/kopf-leer.spec.ts` (`MAX`, Grenzen in Pfad D, Pfad B hinter `USECASE_SEED_URL`).

## Pflichtliste
- Skript gegen `develop` laufen lassen (`USECASE_SEED_URL=http://localhost:4174 E2E_SEED=0 npx playwright test e2e/usecases/kopf-leer.spec.ts`, beide Projekte); `MAX` und die Grenzen von Pfad D auf die Zielspalte von TARGET §4 senken (A: 2 Taps, 0 Umwege, 1 Dialog, 0 Karten, 0 Selects; B: 2 Taps, 0 Dialoge; D: ≤ 13/5 Zeilen, ≤ 280/200 Wörter, ≤ 700/800 px). Eine Zahl, die das Ziel verfehlt, bleibt auf dem gemessenen Wert und wird mit Grund im PR-Text genannt – nie ein Test gelockert, um grün zu werden.
- Tabelle „Gemessen danach“ in ANALYSIS.md §2 (eine Tabelle, Vorher/Ziel/Nachher) und ein Satz in TARGET.md §4; Screenshots von Pfad A (PC und Handy, hell und dunkel) und der Planer-Seite in den PR-Text, nicht ins Repo.
- `docs/design/usecases/kopf-leer/mockups/render.mjs` einmal ausführen und prüfen, dass die Mockups noch dem Gebauten entsprechen; Abweichungen in TARGET.md §2 als „gebaut anders:“ notieren.

## Nicht in diesem Paket
Keine Produktänderung. Wer eine Zahl verfehlt, bekommt eine Zeile in docs/STATUS.md „Offen“, kein Fix hier.

## Abnahme
- Skript grün mit den neuen Grenzen; `npm run check:docs`; STATUS eine Zeile („Use case Kopf leer: nachgemessen, …“); CHATS-Zeile „Wartet auf Sven: Pakete kopf-leer starten“ entfernen; `.changes/` nicht nötig (`no-changelog`).

## Skills
`council` über die Tabelle (Advocate: sind die Zahlen ehrlich und vollständig; Architect: misst das Skript, was TARGET verspricht; Guardian: keine Testlockerung). Danach `full stop`: PR gegen develop, kein Merge.
```
