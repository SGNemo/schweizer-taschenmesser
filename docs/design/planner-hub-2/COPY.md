# Planner hub 2 – every new word (de / en)

Take these literally into `web/src/strings.ts` (planner block, or the block of the module named) and `web/src/i18n/locales/en/`; do not rephrase. `{…}` is a parameter; plural forms are functions. Checked against [FOCUS-WORDING](../FOCUS-WORDING.md) and the text rules of [FOCUS-GUIDELINES](../FOCUS-GUIDELINES.md): no „!“, no guilt, no counter that only grows, buttons are verbs, ≤ 68 characters. Ids (`M1`, `X3` …) are what the hand-offs cite.

## 10 · mark (core, used by every module)

| Id | Deutsch | English |
| --- | --- | --- |
| M1 | Im Plan · {Mi} | In the plan · {Wed} |
| M2 | Im Plan · {Mi} · fest | In the plan · {Wed} · fixed |
| M3 | Im Plan · noch ohne Tag | In the plan · no day yet |
| M4 | Im Plan · war {Mo} | In the plan · was {Mon} |
| M5 (a member folded into a placed pile, package 2; a bundle member only with the parked 5b) | Im Plan · {Mi} · in „{Finanzen checken}“ | In the plan · {Wed} · in “{Check finances}” |
| M6 (name for screen readers: the visible text M1–M5, then the full date where there is one) | Im Plan · {Mi} – {Mittwoch, 2. Dezember}. Im Planer zeigen | In the plan · {Wed} – {Wednesday, 2 December}. Show in the planner |
| M7 (⋯) | In den Plan · Nicht mehr planen | Add to plan · Stop planning |

## 4 · expanded row

| Id | Deutsch | English |
| --- | --- | --- |
| X1 (name of the title button; also of a member's `▸` in a pile or bundle and a list member's `▾`) | {Titel}. Aufklappen / {Titel}. Zuklappen | {title}. Expand / {title}. Collapse |
| X2 | Ganz öffnen | Open |
| X3 | Gibt es nicht mehr. | No longer exists. |
| X4 | Aus dem Plan nehmen | Take out of the plan |
| X5 | Auf diesem Gerät nicht verfügbar. | Not available on this device. |
| X6 (mail, phone) | Mails beantwortest du am PC. | Answer mail on your computer. |
| X7 | Das hat nicht geklappt. Es ist nichts verändert. | That did not work. Nothing was changed. |
| X8 (lists) | Fertig eingekauft | Done shopping |
| X9 (invoices: two labels, the button) | Bezahlt am · Betrag · Bezahlt | Paid on · Amount · Paid |
| X10 (subscriptions: two buttons, then the confirm) | Gekündigt am … · Läuft weiter · Vermerken | Cancelled on … · Keep it · Save |
| X11 (subscriptions, toast) | Als gekündigt vermerkt. / Läuft weiter, Frist erledigt. | Noted as cancelled. / Kept, deadline settled. |
| X12 (mail: button · text + button) | Antworten · Beantwortet? · Erledigt | Reply · Answered? · Done |
| X13 (bookmarks) | Im Browser öffnen | Open in the browser |
| X14 (checklist line, name) | „{Schritt}“ abhaken | Tick “{step}” |
| X15 (setting + hint) | Zeilen aufklappen · „Ein Tipp auf den Titel zeigt das Ding im Planer. Aus: der Titel öffnet es in seinem Modul.“ | Expand rows · “A tap on the title shows the thing in the planner. Off: the title opens it in its module.” |
| X16 (subscriptions) | Kündigen bis {Do 10. Dez.} | Cancel by {Thu 10 Dec} |
| X18 (meta of a passed deadline, as FOCUS-WORDING) | Frist war {So} | was due {Sun} |
| X19 (a capped list: lists panel, pile part, bundle panel, steps) | {n} weitere | {n} more |

## 2 · collective rows

| Id | Deutsch | English |
| --- | --- | --- |
| P1 | Finanzen checken | Check finances |
| P2 | E-Mails durchgehen | Go through mail |
| P3 (meta parts; singular / plural as functions) | 1 Rechnung / {n} Rechnungen · 1 Frist / {n} Fristen · 1 Budget / {n} Budgets · 1 wartet / {n} warten | 1 invoice / {n} invoices · 1 deadline / {n} deadlines · 1 budget / {n} budgets · {n} waiting |
| P4 (meta, late money) | Frist vorbei: {n} | Deadline passed: {n} |
| P5 (offer) | {n} Dinge aus {Finanzen} · Als eine Zeile zeigen | {n} things from {Finances} · Show as one row |
| P6 (toast) | {Finanzen} ist jetzt eine Zeile. · Rückgängig | {Finances} is one row now. · Undo |
| P7 (panel part head) | Rechnungen offen · Kündigungsfristen · Budgets über dem Rahmen · Unterlagen mit Frist | Open invoices · Cancellation deadlines · Over budget · Documents with a deadline |
| P8 (jump) | In {Rechnungen} ansehen | View in {Invoices} |
| P9 | Finanzen checken · nichts wartet | Check finances · nothing waiting |
| P10 (setting + hint) | Stapel als eine Zeile · „Fasst Dinge aus einem Bereich zusammen, die noch keinen Tag haben. Einzeln legen kannst du sie weiter.“ | Piles as one row · “Groups things from one area that have no day yet. You can still place them one by one.” |
| P11 (panel ⋯) | Wieder einzeln zeigen | Show one by one again |
| P12 (meta on the phone) | {n} Dinge | {n} things |
| P13 (name of ✕ on the offer) | Nicht mehr anbieten | Do not offer again |
| P14 (budget line, by budgets; amount through `SensitiveValue`) | {Lebensmittel} · {40 €} über dem Rahmen | {Groceries} · {€40} over budget |
| P15 (mail's queue line in the mail pile, by mail: the count P3, then this button; it opens mail's `PlanAllDialog`) | In den Plan … ({n}) | Add to plan … ({n}) |

## 5 · steps and „Los“ (5a) · bundles (5b, parked)

| Id | Deutsch | English |
| --- | --- | --- |
| B1 (meta of a ToDo with a checklist and of a routine; k = done steps; a list keeps its own word „7 Dinge“, then „2 von 7“) | {n} Schritte · {k} von {n} | {n} steps · {k} of {n} |
| B2 (meta, things; parked with 5b) | {n} Dinge · {k} von {n} | {n} things · {k} of {n} |
| B3 | Los | Go |
| B4 (focus, eyebrow) | {Haushalt} · Schritt {k} von {n} | {Household} · step {k} of {n} |
| B5 | Fertig · weiter | Done · next |
| B6 | Überspringen | Skip |
| B7 (while paused the built `t.focus.mode.resume`, as built) | Pause · Weiter | Pause · Resume |
| B10 (after a skip, last step; „Jetzt“ walks the skipped steps again, „Später“ returns to the plan with them open) | {n} übersprungen. Jetzt oder später? · Jetzt · Später | {n} skipped. Now or later? · Now · Later |
| B11 (selection bar; parked with 5b) | Bündeln … | Bundle … |
| B12 (dialog; cancel = the shared „Abbrechen“; parked with 5b) | Ein Name für das Bündel · Bündeln | A name for the bundle · Bundle |
| B13 (toast; parked with 5b) | {n} Dinge sind jetzt „{Wohnung}“. · Rückgängig | {n} things are now in “{Flat}”. · Undo |
| B14 (panel ⋯; parked with 5b) | Auflösen · Als Routine speichern · Umbenennen … | Unbundle · Save as routine · Rename … |
| B15 (toast; parked with 5b) | Aufgelöst. Die Dinge liegen wieder einzeln auf {Mo}. · Rückgängig | Unbundled. The things are back on {Mon} one by one. · Undo |
| B16 (toast after the lookup confirms the new routine; „Ansehen“ opens `/routines`) | Routine „{Haushalt}“ angelegt. · Ansehen · Rückgängig | Routine “{Household}” created. · View · Undo |
| B17 (step gone; parked with 5b) | Gibt es nicht mehr | No longer exists |
| B18 (module off; parked with 5b) | {Modul} ist ausgeschaltet – „Los“ lässt diesen Schritt aus. | {module} is switched off – “Go” skips this step. |
| B19 (key hint under the buttons, not on touch; the corner's „Verlassen“ is as built, `t.focus.mode.leave`) | Enter: fertig · S: überspringen · P: Pause · Esc: zum Plan | Enter: done · S: skip · P: pause · Esc: to the plan |
| B20 (line ⋯; parked with 5b) | Aus dem Bündel nehmen | Take out of the bundle |
| B21 (line ⋯, phone; parked with 5b) | Nach oben · Nach unten | Move up · Move down |
| B23 (the filled button on the last step: finishes it, ticks the carrying thing, returns to the plan with the thing's toast) | Fertig | Done |
| B24 (the announced step change, polite live region) | Schritt {k} von {n}: {Schritt} | Step {k} of {n}: {step} |
| B25 (toast when the lookup finds a routine of that name before emitting; nothing is emitted; „Ansehen“ opens `/routines`) | Die Routine „{Haushalt}“ gibt es schon. · Ansehen | The routine “{Household}” already exists. · View |
| B26 (quiet toast in „Los“ after a step) | Schritt erledigt. · Rückgängig | Step done. · Undo |

## 8 · measured duration

| Id | Deutsch | English |
| --- | --- | --- |
| Z1 (row) | {20} Min · wie zuletzt | {20} min · as last time |
| Z2 („Dauer …“) | zuletzt {20}, {25}, {15} Min | last {20}, {25}, {15} min |
| Z3 (settings) | Aus gemessener Zeit vorschlagen · Gemessene Zeiten löschen | Propose from measured time · Delete measured times |

## 1 · share · 3 · kinds in the field

| Id | Deutsch | English |
| --- | --- | --- |
| S1 (the capture form's word for the type `plan`) | as built: `t.quickCapture.target.plan` („Planer“) | as built (“Planner”) |
| S2 (line under the form, only while the type is `plan`) | Landet im Planer unter „Noch ohne Tag“. | Lands in the planner under “No day yet”. |
| S5 | Gekürzt auf 4 000 Zeichen. | Shortened to 4,000 characters. |
| S7 (chip on the row) | Im Browser öffnen · {host} | Open in the browser · {host} |
| S8 (page after „Speichern“; then „Ansehen“ · „Rückgängig“ · S9) | Abgelegt. | Saved. |
| S9 | Fertig | Done |
| S14 (page once the saved ToDo is gone – its own „Rückgängig“ or the toast's; replaces S8, the buttons go) | Zurückgenommen. | Taken back. |
| S16 (second line under the form, only while the type is `plan`, for a shared http/https address ≤ 2 048 characters) | Der Link wird mit abgelegt: {host} | The link is saved with it: {host} |
| S19 (in S16's place, for an address without http/https or over 2 048 characters, only while the type is `plan`) | Dieser Link wird nicht mit abgelegt. | This link is not saved with it. |
| K1 (preview) | Wird: {Rechnung} · {Stadtwerke} · {80,00 €} · {Frist Fr 4. Dez.} | Becomes: {invoice} · {Stadtwerke} · {€80.00} · {due Fri 4 Dec} |
| K2 (kinds) | Rechnung · Einkaufsliste · Termin · Notiz · Merkliste · Aufgabe mit Schritten | invoice · shopping list · appointment · note · bookmark · task with steps |
| K3 | Als Aufgabe eintragen | Enter as a task |
| K4 (toasts) | Rechnung angelegt, liegt unter „Noch ohne Tag“. / Steht auf der Einkaufsliste. / Termin eingetragen. / Notiz angelegt. · In den Plan / Auf der Merkliste. · In den Plan / Aufgabe mit {n} Schritten angelegt, liegt auf {Mo}. — each „· Rückgängig“ | Invoice created, under “No day yet”. / On the shopping list. / Appointment entered. / Note created. · Add to plan / Bookmarked. · Add to plan / Task with {n} steps created, on {Mon}. — each “· Undo” |
| K5 (setting + hint) | Arten im Feld erkennen · „Zeigt vor dem Eintragen, was aus der Zeile wird. Ohne die Zeile wird es eine Aufgabe.“ | Recognise kinds in the field · “Shows what the line becomes before you enter it. Without that line it becomes a task.” |
| K6 (more names in K1, after three) | + {n} | + {n} |
| K7 (the field's toast for a plain ToDo with an A2 chip „vor“) | Liegt auf {Mi}, vor {Friseur}. | On {Wed}, before {hairdresser}. |
| K7b (the same with an A2 chip „nach“) | Liegt auf {Mi}, nach {Friseur}. | On {Wed}, after {hairdresser}. |
| K8 (the field's toast for a ToDo with only T11) | Liegt auf {Mo}, in „{Umzug}“. | On {Mon}, in “{Moving house}”. |
| K9 (end of the toast for a thing made while a topic filter is on that does not take T11; „Alles zeigen“ ends the filter) | Nicht im Thema „{Umzug}“ · Alles zeigen | Not in topic “{Moving house}” · Show everything |

## 9 · appointment · 11 · topic · struck: 7 · waiting, 6 · places

| Id | Deutsch | English |
| --- | --- | --- |
| A1 | Vorbereiten … · Danach … | Prepare … · Afterwards … |
| A2 (lead chip in the field) | vor {Friseur}, {Mi} · nach {Friseur}, {Mi} | before {hairdresser}, {Wed} · after {hairdresser}, {Wed} |
| A3 (chip's second choice; „am Tag davor“ hidden when the appointment is today) | am Tag davor · am Tag danach | the day before · the day after |
| A4 (row chip) | vor {Friseur} · nach {Friseur} | before {hairdresser} · after {hairdresser} |
| A5 (small heads in the panel) | Vorbereitung · Danach | Preparation · Afterwards |
| A6 (lead chip: name of its menu button · name of ✕) | {vor Friseur, Mittwoch}. Ändern · Entfernen | {before hairdresser, Wednesday}. Change · Remove |
| A7 (description of a struck lead chip while K1 shows another kind; `aria-describedby`) | {vor Friseur, Mi} – gilt nicht für {Rechnung} | {before hairdresser, Wed} – does not apply to {invoice} |
| T1 | Thema … | Topic … |
| T2 (chooser title · field label · last choice · hint without topics) | Thema wählen oder neu eintippen · Thema · Kein Thema · Ein Thema hält Dinge aus mehreren Modulen zusammen. | Choose a topic or type a new one · Topic · No topic · A topic holds things from several modules together. |
| T3 (page ⋯) | Nur ein Thema zeigen … | Show one topic only … |
| T4 (page head while filtered) | Thema: {Umzug} · {n} Dinge · Alles zeigen | Topic: {Moving house} · {n} things · Show everything |
| T6 | In diesem Thema liegt gerade nichts im Plan. | Nothing of this topic is in the plan right now. |
| T8 (toast) | {n} Dinge gehören jetzt zu „{Umzug}“. · Rückgängig | {n} things belong to “{Moving house}” now. · Undo |
| T9 | Thema löschen … · „Die Dinge bleiben, nur die Klammer geht.“ | Delete topic … · “The things stay; only the bracket goes.” |
| T10 (chooser foot · settings section) | Themen verwalten … · Themen | Manage topics … · Topics |
| T11 (lead chip in the field while filtered) | Thema: {Umzug} | Topic: {Moving house} |
| T12 (row ⋯ above T1, after a topic was used once: the last used topic, device-local) | Thema: {Umzug} | Topic: {Moving house} |
| W1 | Warte auf Antwort … | Waiting for an answer … |
| W2 (dialog) | Wieder zeigen: · 3 Tage · 1 Woche · 2 Wochen · Datum … · Von wem? (optional) | Show again: · 3 days · 1 week · 2 weeks · Date … · From whom? (optional) |
| W3 (folded line) | Wartet auf Antwort · {n} | Waiting for an answer · {n} |
| W4 (row in it) | bis {Mo 7. Dez.} · von {Vermieter} · Zurückholen | until {Mon 7 Dec} · from {landlord} · Bring back |
| W5 (chip when back) | Antwort da? · von {Vermieter} | Got an answer? · from {landlord} |
| W6 (toast) | Kommt am {Mo 7. Dez.} wieder. · Rückgängig | Comes back on {Mon 7 Dec}. · Undo |
| E1–E3 (struck with the map: stops, place, map jump) | {n} Stopps · {k} von {n} · Ort … · Ort · Ort suchen · Kein Ort · Auf der Karte ansehen | {n} stops · {k} of {n} · Place … · Place · Search places · No place · View on the map |

## Rejected, and why

- „Stapel“ on the row („Stapel Finanzen“): names the mechanism, not what he does. The switch may say it.
- „4 unbeantwortet“, „4 überfällig“: guilt. His own word „warten“ stays; three test personas stumbled over „Wartet noch“ as a heading, so in what is built it is never a heading, only a count's verb (the struck W3 would have been the exception).
- „Erkannt: Rechnung“: a claim. „Wird:“ says what will happen.
- „Starten“, „Fokus“ for a bundle: „Los“ is his word and one syllable; the start line keeps „Fokus starten“.
- „Gruppe“, „Paket“, „Projekt“ for 5 and 11: taken (lists, changes, his ToDo lists). „Bündel“ and „Thema“.
- „Snooze“, „Zurückstellen“, „Auf Wiedervorlage“: office words; „Warte auf Antwort“ says why.
- „Alles durch.“ with „Zurück zum Plan“ as an end page of „Los“: the last „Fertig“ returns to the plan, the thing's own toast says it.
- „Auch im Thema“ and „Tag „…“ als Thema übernehmen“ under „Aus deinen Tags“: nothing can be a member without being a row, and an offer from ToDo tags would make the planner read them.
- „gelernt“, „KI“, „schätzt“: nothing learns here in his sense; „wie zuletzt“ is exactly what happens.
