# Planner hub 2 – every new word (de / en)

Take these literally into `web/src/strings.ts` (planner block, or the block of the module named) and `web/src/i18n/locales/en/`; do not rephrase. `{…}` is a parameter; plural forms are functions. Checked against [FOCUS-WORDING](../FOCUS-WORDING.md) and the text rules of [FOCUS-GUIDELINES](../FOCUS-GUIDELINES.md): no „!“, no guilt, no counter that only grows, buttons are verbs, ≤ 68 characters. Ids (`M1`, `X3` …) are what the hand-offs cite.

## 10 · mark (core, used by every module)

| Id | Deutsch | English |
| --- | --- | --- |
| M1 | Im Plan · {Mi} | In the plan · {Wed} |
| M2 | Im Plan · {Mi} · fest | In the plan · {Wed} · fixed |
| M3 | Im Plan · noch ohne Tag | In the plan · no day yet |
| M4 | Im Plan · war {Mo} | In the plan · was {Mon} |
| M5 | Im Plan · {Mi} · in „{Haushalt}“ | In the plan · {Wed} · in “{Household}” |
| M6 (name for screen readers) | Im Plan am {Mittwoch, 2. Dezember}. Im Planer zeigen | In the plan on {Wednesday, 2 December}. Show in the planner |
| M7 (⋯) | In den Plan · Nicht mehr planen | Add to plan · Stop planning |

## 4 · expanded row

| Id | Deutsch | English |
| --- | --- | --- |
| X1 (name of the title button) | {Titel}. Aufklappen / {Titel}. Zuklappen | {title}. Expand / {title}. Collapse |
| X2 | Ganz öffnen | Open fully |
| X3 | Gibt es nicht mehr. | No longer exists. |
| X4 | Aus dem Plan nehmen | Take out of the plan |
| X5 | Auf diesem Gerät nicht verfügbar. | Not available on this device. |
| X6 (mail, phone) | Mails beantwortest du am PC. | You answer mail on the PC. |
| X7 | Das hat nicht geklappt. Es ist nichts verändert. | That did not work. Nothing was changed. |
| X8 (lists) | {n} weitere · Fertig eingekauft | {n} more · Done shopping |
| X9 (invoices) | Bezahlt am · Betrag · Bezahlt | Paid on · Amount · Paid |
| X10 (subscriptions) | Gekündigt am … · Läuft weiter | Cancelled on … · Keeps running |
| X11 (subscriptions, toast) | Als gekündigt vermerkt. / Läuft weiter, Frist erledigt. | Noted as cancelled. / Keeps running, deadline settled. |
| X12 (mail) | Antworten · Beantwortet? · Erledigt | Reply · Answered? · Done |
| X13 (bookmarks) | Im Browser öffnen | Open in the browser |
| X14 (checklist line, name) | „{Schritt}“ abhaken | Tick “{step}” |

## 2 · collective rows

| Id | Deutsch | English |
| --- | --- | --- |
| P1 | Finanzen checken | Check finances |
| P2 | E-Mails durchgehen | Go through mail |
| P3 (meta parts) | {n} Rechnung / Rechnungen · {n} Frist / Fristen · {n} Budget / Budgets · {n} wartet / warten | {n} invoice(s) · {n} deadline(s) · {n} budget(s) · {n} waiting |
| P4 (meta, late money) | Frist vorbei: {n} | Deadline passed: {n} |
| P5 (offer) | {n} Dinge aus {Finanzen} · Als eine Zeile zeigen | {n} things from {Finances} · Show as one row |
| P6 (toast) | {Finanzen} ist jetzt eine Zeile. · Rückgängig | {Finances} is one row now. · Undo |
| P7 (panel part head) | Rechnungen offen · Kündigungsfristen · Budgets über dem Rahmen · Unterlagen mit Frist | Open invoices · Notice periods · Budgets over their frame · Documents with a deadline |
| P8 (jump) | In {Rechnungen} ansehen | View in {Invoices} |
| P9 | Finanzen checken · nichts wartet | Check finances · nothing waiting |
| P10 (setting + hint) | Stapel als eine Zeile · „Fasst Dinge aus einem Bereich zusammen, die noch keinen Tag haben. Einzeln legen kannst du sie weiter.“ | Piles as one row · “Folds things of one area that have no day yet. You can still place them one by one.” |
| P11 (panel ⋯) | Wieder einzeln zeigen | Show one by one again |
| P12 (meta on the phone) | {n} Dinge | {n} things |

## 5 · bundles and „Los“

| Id | Deutsch | English |
| --- | --- | --- |
| B1 (meta; k = done steps) | {n} Schritte · {k} von {n} | {n} steps · {k} of {n} |
| B2 (meta, things) | {n} Dinge · {k} von {n} | {n} things · {k} of {n} |
| B3 | Los | Go |
| B4 (focus, eyebrow) | {Haushalt} · Schritt {k} von {n} | {Household} · step {k} of {n} |
| B5 | Fertig · weiter | Done · next |
| B6 | Überspringen | Skip |
| B7 | Pause · Weiter | Pause · Resume |
| B8 | Alles durch. | All through. |
| B9 (after B8) | Erledigt · Zurück zum Plan | Done · Back to the plan |
| B10 (after a skip, last step) | {n} übersprungen. Jetzt oder später? · Jetzt · Später | {n} skipped. Now or later? · Now · Later |
| B11 (selection bar) | Bündeln … | Bundle … |
| B12 (dialog; cancel = the shared „Abbrechen“) | Ein Name für das Bündel · Unterwegs (Besorgungsrunde) · Bündeln | A name for the bundle · On the way (errands) · Bundle |
| B13 (toast) | {n} Dinge sind jetzt „{Wohnung}“. · Rückgängig | {n} things are “{Flat}” now. · Undo |
| B14 (panel ⋯) | Auflösen · Als Routine speichern · Umbenennen … | Unbundle · Save as routine · Rename … |
| B15 (toast) | Aufgelöst. Die Dinge liegen wieder einzeln auf {Mo}. · Rückgängig | Unbundled. The things lie on {Mon} one by one again. · Undo |
| B16 (toast) | Routine „{Haushalt}“ angelegt. · Ansehen | Routine “{Household}” created. · View |
| B17 (step gone) | Gibt es nicht mehr | No longer exists |
| B18 (module off) | {Modul} ist ausgeschaltet – dieser Schritt wartet. | {module} is switched off – this step waits. |

## 1 · share · 3 · kinds in the field

| Id | Deutsch | English |
| --- | --- | --- |
| S1 (target) | In den Planer | Into the planner |
| S2 (card) | Landet unter „Noch ohne Tag“. | Lands under “No day yet”. |
| S3 | Ablegen | Put down |
| S4 (toast) | Liegt im Planer unter „Noch ohne Tag“. · Ansehen · Rückgängig | In the planner under “No day yet”. · View · Undo |
| S5 | Gekürzt auf 4 000 Zeichen. | Shortened to 4,000 characters. |
| S6 | Nicht gespeichert. Noch einmal? | Not saved. Once more? |
| S7 (chip on the row) | Im Browser öffnen · {host} | Open in the browser · {host} |
| K1 (preview) | Wird: {Rechnung} · {Stadtwerke} · {80,00 €} · {Frist Fr 4. Dez.} | Becomes: {invoice} · {Stadtwerke} · {€80.00} · {due Fri 4 Dec} |
| K2 (kinds) | Rechnung · Einkaufsliste · Termin · Notiz · Merkliste · Bündel | invoice · shopping list · appointment · note · bookmark · bundle |
| K3 | Als Aufgabe eintragen | Enter as a task |
| K4 (toasts) | Rechnung angelegt, liegt unter „Noch ohne Tag“. / Steht auf der Einkaufsliste. / Termin eingetragen. / Notiz angelegt. · In den Plan / Auf der Merkliste. · In den Plan / Bündel mit {n} Schritten angelegt. — each „· Rückgängig“ | Invoice created, under “No day yet”. / On the shopping list. / Appointment entered. / Note created. · Add to plan / Bookmarked. · Add to plan / Bundle with {n} steps created. — each “· Undo” |
| K5 (setting + hint) | Arten im Feld erkennen · „Zeigt vor dem Eintragen, was aus der Zeile wird. Ohne die Zeile wird es eine Aufgabe.“ | Recognise kinds in the field · “Shows what the line becomes before you enter it. Without that line it becomes a task.” |

## 6 · errands · 9 · appointment · 11 · topic · 7 · waiting · 8 · duration

| Id | Deutsch | English |
| --- | --- | --- |
| E1 (meta) | {n} Stopps · {k} von {n} | {n} stops · {k} of {n} |
| E2 (entry · dialog title · search placeholder · last choice) | Ort … · Ort · Ort suchen · Kein Ort | Place … · Place · Search places · No place |
| E3 | Auf der Karte ansehen | View on the map |
| A1 | Vorbereiten … · Danach … | Prepare … · Afterwards … |
| A2 (lead chip in the field) | vor {Friseur}, {Mi} · nach {Friseur}, {Mi} | before {hairdresser}, {Wed} · after {hairdresser}, {Wed} |
| A3 (chip's second choice) | am Tag davor · am Tag danach | the day before · the day after |
| A4 (row chip) | vor {Friseur} · nach {Friseur} | before {hairdresser} · after {hairdresser} |
| T1 | Thema … | Topic … |
| T2 (chooser title · field label · last choice · small head over T7 · hint without topics) | Thema wählen oder neu eintippen · Thema · Kein Thema · Aus deinen Tags · Ein Thema hält Dinge aus mehreren Modulen zusammen. | Choose a topic or type a new one · Topic · No topic · From your tags · A topic holds things from several modules together. |
| T3 (page ⋯) | Nur ein Thema zeigen … | Show one topic only … |
| T4 (page head while filtered) | Thema: {Umzug} · {n} Dinge · Alles zeigen | Topic: {Move} · {n} things · Show everything |
| T5 | Auch im Thema · {n} | Also in this topic · {n} |
| T6 | In diesem Thema liegt gerade nichts im Plan. | Nothing of this topic is in the plan right now. |
| T7 (chooser) | Tag „{umzug}“ als Thema übernehmen | Take tag “{move}” as a topic |
| T8 (toast) | {n} Dinge gehören jetzt zu „{Umzug}“. · Rückgängig | {n} things belong to “{Move}” now. · Undo |
| T9 | Thema löschen … · „Die Dinge bleiben, nur die Klammer geht.“ | Delete topic … · “The things stay; only the bracket goes.” |
| W1 | Warte auf Antwort … | Waiting for an answer … |
| W2 (dialog) | Wieder zeigen: · 3 Tage · 1 Woche · 2 Wochen · Datum … · Von wem? (optional) | Show again: · 3 days · 1 week · 2 weeks · Date … · From whom? (optional) |
| W3 (folded line) | Wartet auf Antwort · {n} | Waiting for an answer · {n} |
| W4 (row in it) | bis {Mo 7. Dez.} · von {Vermieter} · Zurückholen | until {Mon 7 Dec} · from {landlord} · Bring back |
| W5 (chip when back) | Antwort da? · von {Vermieter} | Answer in? · from {landlord} |
| W6 (toast) | Kommt am {Mo 7. Dez.} wieder. · Rückgängig | Comes back on {Mon 7 Dec}. · Undo |
| D1 (row) | {20} Min · wie zuletzt | {20} min · as last time |
| D2 („Dauer …“) | zuletzt {20}, {25}, {15} Min | last {20}, {25}, {15} min |
| D3 (settings) | Aus gemessener Zeit vorschlagen · Gemessene Zeiten löschen | Propose from measured time · Delete measured times |

## Rejected, and why

- „Stapel“ on the row („Stapel Finanzen“): names the mechanism, not what he does. The switch may say it.
- „4 unbeantwortet“, „4 überfällig“: guilt. His own word „warten“ stays; three test personas stumbled over „Wartet noch“ as a heading, so here it is never a heading, only a count's verb.
- „Erkannt: Rechnung“: a claim. „Wird:“ says what will happen.
- „Starten“, „Fokus“ for a bundle: „Los“ is his word and one syllable; the start line keeps „Fokus starten“.
- „Gruppe“, „Paket“, „Projekt“ for 5 and 11: taken (lists, changes, his ToDo lists). „Bündel“ and „Thema“.
- „Snooze“, „Zurückstellen“, „Auf Wiedervorlage“: office words; „Warte auf Antwort“ says why.
- „gelernt“, „KI“, „schätzt“: nothing learns here in his sense; „wie zuletzt“ is exactly what happens.
