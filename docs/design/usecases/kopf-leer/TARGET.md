# Use case „Kopf leer“ – target picture (phase 2)

Branch `design/usecase-kopf-leer`, 2026-11-08. Status: **waits for the maintainer** (questions in §6; the package plan `PACKAGES.md` follows after „Plan freigegeben“). Analysis and friction ids `U01…U16`: [ANALYSIS.md](ANALYSIS.md). Mockups: [`mockups/`](mockups/) (standalone HTML, `node docs/design/usecases/kopf-leer/mockups/render.mjs` from `web/` renders them to `web/.screens/usecase-kopf-leer/`; images go into the PR text, never into `docs/`). Rules: root `CLAUDE.md`, [FOCUS-GUIDELINES](../../FOCUS-GUIDELINES.md) (checklist 1–9 per proposal), [FOCUS-WORDING](../../FOCUS-WORDING.md), [MODULE-IDENTITY](../../MODULE-IDENTITY.md), planner decisions [decisions/plan.md](../../../decisions/plan.md).

## 0. In one paragraph

The scenario is not a planning problem – the planner already distributes everything honestly – it is an **intake** problem: getting things out of the head and out of the mailbox without decisions, and without seeing the pile. Today the capture sheet asks a type per line and stops the batch for one money line (U01, U03, U04), a mail needs three taps and a dialog per thing and loses the intent (U07–U09), „automatic“ invoices hide behind two settings (U10), and the planner page opens with the whole waiting list (U12). The target keeps every existing surface and adds four things, all for every user: **F1 „Abladen“**, a calm many-lines mode of the quick capture that never books money, keeps the field open and ends on one next step; **F2 „In den Plan“ from a mail**, one tap on a row that makes „Anna Beispiel antworten · 15 Min“ with a link back to the mail; **F3 „Rechnung · 84,30 € · 15.11. · Anlegen“**, one tap on a recognised invoice mail, a payment reminder sets the dunning level; **F4** the planner folds what waits and names today's first thing. Measured: five things on the PC 53 → 42 s with no detour, two mails into the plan 19 → 4 s, three things in passing on the phone 42 → 30 s, the planner page from 29 rows to the board only.

## 1. The shortest honest path with what exists today

Numbers from the measurement script (ANALYSIS §2); „fixable by wording/order/default“ = no new function, one small PR.

| Step                               | Today                                                                                                                                                                                | With existing means, better defaults                                                                                                                                                                                                                                 | Still missing                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| S1/S2 five things on the PC        | „+“ → 5 lines → „Alle speichern“ twice (U04) · 3 taps · 141 keys · 2 dialogs · 1 detour · ≈ 53 s; the fifth line is a booking (U03)                                                  | Parser knows „Mahnung/Zahlungserinnerung“ as invoice words (U03); the draft box is part of the preview, so the one tap confirms (U04); the toast says „5 Dinge im Eingang · Sortieren“ (U05): **2 taps · 1 dialog · 0 detours · ≈ 42 s**, no visit to the ToDos page | The 12-entry select per line and the pile behind the sheet (U01, U02); the field closes (U11) – F1      |
| S3 mails to answer → plan          | per mail: open → ⋯ → „ToDo“ → „Speichern“ · 3 taps + dialog · title = subject (U07); no batch (U08); no way back from the plan to the mail (U09); 2 mails ≈ 19 s                     | The filter chat's Gmail labels are folders already – pick „Antworten“ and work the list; `LinkDialog` passes `extra.link` so the ToDo carries `links[{kind:'mail'}]` (U09, one line): still 3 taps + dialog per mail                                                 | One tap per row with the intent in the title; „Zur Mail“; a batch from a label – F2                     |
| S4 invoices „automatisch“          | per mail 3 taps + dialog; or: Settings → Mail → notifications on, Automations → template „Rechnung per Mail“ on → a notice „Vorschlag“ → confirm (U10); „Mahnung“ = ordinary invoice | Enabling the template is documented in one line of the user docs; the suggest notice is 2 taps per invoice without retyping                                                                                                                                          | One tap in the mail list, no notification needed; dunning level from the words – F3                     |
| S5 phone, things in passing        | „+“ → type → Enter · 1 tap · 19 keys · 1 dialog · ≈ 14 s per thing; the sheet closes                                                                                                 | Android quick-settings tile and launcher shortcut „Erfassen“ open the sheet from anywhere (exists)                                                                                                                                                                   | The field stays for the next thing – F1                                                                 |
| S6/S7 look at the plan, the number | planner page: board + 16 waiting rows with a reason each · 406 words · 1 274 px (U12); head without a next step (U13); home: six „Jetzt wichtig“ cards (U02)                         | Fold „Wartet auf freie Zeit“ once (device-local, remembered); switch „Jetzt wichtig“ to calm (exists: `focus.calmAttention`, on – the six cards are all „today“ items, so calm shows them all)                                                                       | Folded by default with the figure in the head; a next-step line; „Abladen“ reachable from the plan – F4 |

What is only wording, order or default (one PR, no decision needed beyond this document): U03 parser words · U04 draft box in the preview · U05 toast with one action · U12 `defaultClosed` · U13 detail line · U09 `extra.link` from the mail dialog.

## 2. New functions

Each: problem in the scenario → idea → how it applies to all users → form → focus checklist 1–9 → rule conflicts → smallest first step → effort. Variants minimal / medium / large with a recommendation for F1 and F2 (the two with a real design choice); F3 and F4 have one sensible size.

### F1 „Abladen“ – the many-lines mode of the quick capture (U01, U02, U04, U05, U11)

**Problem.** „Mein Kopf läuft über und es ist gefühlt zu schwer, alles aufs Blatt zu bekommen.“ The sheet is built for one thing: a type select per line, a booking that stops the batch, a dialog over the pile, and after Enter it is gone.

**Idea.** The same sheet in a second shape, reached by one tap („Abladen“) and the same from every entry point (FAB, hotkey window, Android tile and share, `/?capture=1&mode=dump`): one calm field with the single line „Alles raus, eins pro Zeile. Sortiert wird später.“; the page behind it is dimmed on the PC and covered on the phone; each saved line becomes a quiet row above the field with its target as **text** („ToDo“, „Rechnung · Fr“, „Termin · Do 9 Uhr“) and a tap opens the choice; Enter saves the line and keeps the field; money is **never booked** here (a money line with invoice words = invoice, without = ToDo with the amount in its title and a chip „als Buchung: mit $ im normalen Zettel“); „Fertig“ or Esc closes with one line and one action: „7 Dinge im Eingang · Sortieren“ (→ the inbox sorter that exists, or the planner when it is on: „7 Dinge · im Plan ab Mi · Ansehen“). Lines that already read as a deadline („bis Freitag“) show „Frist?“ as a tap-able chip (U14; a soft due stays the default, decided 2026-11-05).

```
Phone 412 px (dark)                              PC 1280 px, sheet centred, page dimmed
┌──────────────────────────────┐                 ┌ Abladen ───────────────────────────── Fertig ┐
│ Abladen                 Fertig│                 │ Alles raus, eins pro Zeile. Sortiert wird später. │
│ Alles raus, eins pro Zeile.  │                 │                                                 │
│ Sortiert wird später.        │                 │  Müll runterbringen                   ToDo      │
│                              │                 │  Wohnzimmer aufräumen                 ToDo      │
│  Müll runterbringen    ToDo  │                 │  Vermieter wegen Heizung antworten    ToDo      │
│  Wohnzimmer aufräumen  ToDo  │                 │  Steuerbescheid prüfen        ToDo · Fr · Frist?│
│                              │                 │  Mahnung Stadtwerke 87,40 €   Rechnung · 13.10. │
│ ┌──────────────────────────┐ │                 │ ┌─────────────────────────────────────────────┐ │
│ │ Vermieter wegen Heizung▌ │ │                 │ │ ▌                                           │ │
│ └──────────────────────────┘ │                 │ └─────────────────────────────────────────────┘ │
│ Enter speichert · Esc beendet│                 │ Enter speichert die Zeile · Umschalt+Enter: Absatz│
└──────────────────────────────┘                 └─────────────────────────────────────────────────┘
After „Fertig“: „5 Dinge im Eingang · Sortieren · Rückgängig“ (one toast, one action)
```

**For all users.** It is the same sheet and the same parser; the mode is a tap away for everyone, on every platform, and nothing in it depends on the planner (with the planner off the closing line points to the inbox sorter).

**Form.** Extension of the core quick capture (`web/src/quickCapture/ui/CaptureForm.tsx`, `parser/split.ts`, `targets/index.ts`): a `mode: 'single' | 'dump'` on the form, a URL flag, one ⋯ entry „Abladen“ in the planner head and the „Heute“ card's menu. No module, no contribution, no new table. The parser change (invoice words) is shared with the single sheet.

**Focus checklist.** 1 Stimulus: fewer elements than today's multi-line preview (no selects, no confirmation box; targets as text) and a dimmed page; 2 Off switch: a mode the person opens on purpose, nothing appears by itself; the ⋯ entries are plain menu items (no setting needed; a device-local „Abladen als Standard für +“ is a later option, off); 3 Next step: exactly one line at the end with one verb („Sortieren“ / „Ansehen“); 4 Wording: „Alles raus, eins pro Zeile. Sortiert wird später.“ – no counts of what is open, no „noch“, never the backlog; 5 Interruption: the draft survives (`draft.ts`, C04) and saved lines are saved; 6 Tests: parser words (unit), form mode (component test), path A of the use-case script, an e2e for „Fertig“ with the planner off/on; 7 Readability: targets as words, no colour for state; the field is excluded from the reading aid like every input; 8 Clicks: 3 taps → 2 for five things, 1 tap + 1 dialog per thing → 0 for every further thing in passing; 9 Removed instead: the per-line type select and the second „Alle speichern“ (the finance confirmation) leave the many-lines path – the single sheet keeps both.

**Rule conflicts.** Finance „booked only after confirmation“ – kept by not booking at all in this mode (the single sheet and `$` stay the way to book). Vault stays excluded (`targets.test.ts`). Capture adapters stay module-free. No sync or privacy change (the lines are ToDos as typed by hand). The Android share target passes shared text into the same form – a shared mail from the phone's mail app lands as one dump line (phone answer to U06 without a mail module).

**Smallest first step.** U03 + U04 + U05 as one small PR (parser words, draft box inside the preview, toast with „Sortieren“): 2 taps and no detour, no new mode yet.

**Variants.**

| Variant           | What                                                                                                                      | Five things on the PC                                            | For                                                   | Against                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| minimal           | U03, U04, U05 only; the multi-line preview stays as it is                                                                 | 2 taps · 1 dialog · ≈ 42 s                                       | S, no decision, helps every batch                     | the selects, the dialog over the pile and the closing sheet stay (U01, U02, U11)                                                                 |
| **medium** (rec.) | minimal + the „Abladen“ mode as above                                                                                     | 2 taps · 1 sheet · ≈ 40 s; every further thing in passing 0 taps | one calm place to unload, same parser, every platform | one more shape of the sheet to keep in step (component test); the money rule needs the maintainer's yes                                          |
| large             | medium + a page `/inbox` („Eingang“) that joins the ToDo inbox, mail suggestions (F3) and the field in one triage surface | as medium                                                        | one place for everything that came in                 | duplicates the ToDo inbox sorter and the mail list; a page that imports from two modules breaks the module rule; new navigation entry = stimulus |

**Effort.** minimal S · medium M (one package) · large L (not recommended).

### F2 „In den Plan“ from a mail (U07, U08, U09; phone: U06)

**Problem.** „E-Mails, die ich beantworten oder lesen muss, die aber untergehen … will über die App diese Mails finden und in den Planner bekommen.“ Today a mail becomes a ToDo in three taps and a dialog, named after its subject, with a web link in its note; there is no way from the plan back into the mail, and no batch for the label the filter chat already sets.

**Idea.** One action **„In den Plan“** on a mail row and in the thread view. It emits the existing bus event `plan.requested` with a title that carries the intent – „Anna Beispiel antworten“ (a person wrote), „Newsletter Muster lesen“ (bulk sender), „Stadtwerke Musterstadt bezahlen“ never here (an invoice mail offers F3 instead) – `durationMin: 15`, a soft due when the text names a date, and `link: { kind: 'mail', id: '<account>/<thread>', label: subject }`. The ToDo carries the link, the planner row shows „· Mail“ and offers „Zur Mail“ (like „Zur Notiz“ today), the mail page opens a thread from `?open=<thread>`, the mail row shows a quiet „im Plan“ text (the module's own `link` table already knows which thread has which entry). Toast „Im Plan: Mi · Rückgängig“ (exists). With the planner off the same action reads „Als ToDo“ and emits `todo.requested`. Medium adds **„Alle in den Plan…“** on a folder/label: a preview list with tick boxes (default: personal senders ticked, bulk unticked, already-linked threads greyed), one „In den Plan (4)“, one undo. Large adds the automation template „Mail mit Label ‚Antworten‘ → in den Plan“ – it needs a thread id in the mail events and the new-mail poll (which runs only with notifications on, while the app runs); every new row still goes through the ToDo, nothing is deleted or sent.

```
Mail list (PC, label „Antworten“ from the filter chat)                 Planner row (Mi 30.)
┌ Antworten · 4 ─────────────────── Alle in den Plan… ┐                ┌───────────────────────────────┐
│ Anna Beispiel · Wochenende?             07:40  [In den Plan] │        │ Anna Beispiel antworten  15 Min│
│ Max Muster · Fotos vom Ausflug      17. Sept.  im Plan · Mi  │        │ Mail · Wochenende?             │
│ Hausverwaltung · Termin Ablesung   28. Sept.  [In den Plan] │        │ ⋯  Erledigt · Später · Zur Mail│
└──────────────────────────────────────────────────────────────┘        └───────────────────────────────┘
Phone (no mail module): share a mail from the mail app → Nemo → the dump line „<Betreff>“ → ToDo (F1)
```

**For all users.** Any mail, any label, any mail provider that implements `MailProvider`; nothing is tuned to one person's filter – the filter's labels are folders already.

**Form.** Extension of the mail module (row action in `rowActions.ts`, thread action next to „Aus dieser Mail anlegen“, folder head action; `core/mail/heuristics.ts` gets a `sender` classification personal/bulk from what it already computes), one line in `LinkDialog.tsx` (`extra.link`), the planner page (`link.kind === 'mail'` → „Zur Mail“), the ToDo row (open a mail link in the app), the mail page (`?open=`). No new contribution, no new table (the mail `link` table and the ToDo `links` field exist), the bus event is unchanged.

**Focus checklist.** 1 Stimulus: one more row action (on hover on the PC, in the ⋯ menu and as swipe on the phone, like „Archivieren“), „im Plan“ as muted text; 2 Off switch: the batch action and the automation template are switchable (mail settings „Alle in den Plan anbieten“ on, template off); the single row action is a plain row action like „Archivieren“, no switch; 3 Next step: the toast names the day; 4 Wording: „Anna Beispiel antworten“, never „unbeantwortet seit“, never a count of unanswered mails; 5 Interruption: the ToDo and the link row exist after one tap; 6 Tests: title rule (unit, incl. bulk senders and „Re:“), `plan.requested` payload (unit), path B of the use-case script (2 taps for two mails), `isolation.test.ts` stays green (the model never sees mail); 7 Readability: „Mail“ is a word in the row, no icon-only state; 8 Clicks: 3 taps + dialog → 1 tap per mail; 9 Removed instead: the Gmail web URL in the ToDo note (the link replaces it – the note stays the person's).

**Rule conflicts.** Modules never import each other: bus event and the mail module's own tables only. Privacy: the ToDo title is the sender's **name** and the link label the subject – both are ordinary ToDo data (synced, backed up, readable by the local API like any typed ToDo); the mail body never leaves the sealed cache; `links` is not an AI field (`modules/todos/ai.ts:37`), and the assistant never receives entries anyway. Guardian point for the council: a **batch** writes many names at once – therefore the preview with tick boxes, never a silent batch. Sync: nothing new. `accounts` untouched.

**Smallest first step.** `LinkDialog` passes `extra.link` (U09) and the thread view gets the button „In den Plan“ (thread action only): 2 taps per mail, the plan row says „Mail“.

**Variants.**

| Variant           | What                                                                                       | Two mails into the plan                             | For                                                                     | Against                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| minimal           | thread action + `extra.link` + „Zur Mail“                                                  | 4 taps · 0 dialogs · ≈ 6 s                          | S, no new surface                                                       | still opens every mail; no batch                                                                                         |
| **medium** (rec.) | minimal + row action in the list + „im Plan“ mark + „Alle in den Plan…“ preview per folder | 2 taps · ≈ 4 s; a label of 8 mails: 2 taps + a look | works with the filter chat's labels; one look instead of eight openings | one preview dialog to build (the importer's `ImportPreview` pattern exists)                                              |
| large             | medium + automation template „Label → Plan“ (`mail.labelled` event with thread id)         | 0 taps after set-up                                 | „am liebsten automatisch“                                               | only while the app runs with mail notifications on; names land in ToDos without a look; a new mail event = contract work |

**Effort.** minimal S · medium M (one package) · large +M (own package, after the medium one has been used for a while).

### F3 „Rechnung · 84,30 € · 15.11. · Anlegen“ – invoices and payment reminders from the list (U10, U03 for mail)

**Problem.** „Mahnungen, Rechnungen, alles irgendwie am liebsten automatisch, aber trage jetzt eben alles einzeln ein.“ The heuristics already find payee, amount and date; the result is used for a widget count and a suggest-notice behind two settings.

**Idea.** A mail the heuristics read as an invoice with a certain amount shows a quiet second line in the list: „Rechnung · 84,30 € · fällig 15.11. · **Anlegen**“. One tap creates the invoice (payee, amount, due, `dunningLevel: 1` when the words say Mahnung/Zahlungserinnerung/Zahlungsaufforderung, the mail link, the Gmail URL in the note as today) and the row says „Rechnung angelegt“; the existing `plannable` source puts it into the plan with a hard due („Stadtwerke Musterstadt bezahlen · 10 Min · Frist Do“). When a value is missing (no date, two amounts) the tap opens today's preview dialog instead. The automation template stays for people who want the notice.

**For all users.** Every invoice-like mail in any folder; the line is text, no colour, never a count („3 Rechnungen!“ is exactly what we do not do).

**Form.** Mail module (list row, `heuristics.ts` already returns `kind`, `amountMinor`, `date`, `title`; one `dunning` flag from the same regex), `core/mail/prefill.ts` (dunning → `dunningLevel`), write through the quick-capture `invoice` target as today (no module import). Setting in the mail module: „Rechnungen in der Liste erkennen“ (on).

**Focus checklist.** 1 one muted line per invoice mail (typically 1–3 rows in a list) – justified by the 3 taps + dialog it removes; 2 switch above; 3 one verb „Anlegen“; 4 „fällig 15.11.“, after the date „Frist war 15.11.“ in warning tone, never red in the mail list; 5 the invoice exists after the tap; 6 unit tests for the dunning flag and the certainty rule, e2e „Anlegen“ once → „Rechnung angelegt“, path B of the use-case script; 7 text, no icon-only; 8 3 taps + dialog → 1 tap; 9 Removed instead: the invoice count line in the inbox widget („n Rechnungsmails in x Tagen“) becomes „n Rechnungen zum Anlegen“ linking to the same list – no new element, the old one gets a verb.

**Rule conflicts.** Money is created only on a tap (`decisions/automation.md`: mail offers `suggest`, never a silent `create` – unchanged). Everything local (heuristics). Mail cache stays sealed; the invoice stores payee, amount, date, reference – what a person types by hand. Duplicate guard: a thread with a link of type `invoice` shows „angelegt“ instead of „Anlegen“. Invoices get no new field (`dunningLevel` exists).

**Smallest first step.** Dunning words → `dunningLevel: 1` in `prefill.ts` (S, no UI).

**Effort.** M (together with F2 one package „mail → plan“).

### F4 The planner shows less and names the next step (U12, U13; entry to F1)

**Problem.** „Mich überfordert die Anzahl, die ich noch umsetzen muss, und notiere nichts.“ The planner page opens with the board and every waiting thing, each with a reason line.

**Idea.** „Wartet auf freie Zeit“ is folded by default (`GroupedList` `defaultClosed`), its head keeps count and overload figure („Wartet auf freie Zeit · 16 · 12 h 40 mehr zu tun, als Zeit frei ist“), the per-row reason moves behind „Warum hier?“ like on the board; the head detail line names the first thing of today („Heute: Stadtwerke bezahlen · dann ist der Tag voll“) or, when today has no time, the next free day („Heute ist frei. Mi: 1 h 24 frei.“); the head ⋯ gets „Abladen“ (F1). Fold state stays device-local and remembered (exists).

**For all users / form.** Planner page only (`routes/PlannerPage.tsx:577`, `:690-703`), two strings. No contract change.

**Focus checklist.** 1 fewer rows and words on the first screen; 2 the fold is the person's choice and remembered; 3 the detail line is the next step; 4 „Der Rest wartet.“, never „noch 16“; 5 –; 6 path D of the use-case script (rows, words, scroll), `planner.spec.ts` adjusts its waiting assertions (open the group first); 7 the figure keeps its words; 8 one tap to see what waits; 9 Removed: the reason line per waiting row.

**Rule conflicts.** None (decided wording stays; CONCEPT §7 „overload in the head of the waiting group“ is kept, the group is just closed).

**Effort.** S.

### Not proposed (and why)

- A new module „Eingang“ or a brain-dump module: the ToDo inbox, the sorter and the capture are that place; a module would import from two others.
- Cloud AI reading the mailbox for „needs answer“: mail never reaches a model (`core/mail/isolation.test.ts`); the local model may help on request only (package 5 of mail) and is desktop-only.
- Counters („12 unbeantwortet“), badges on the mail folder, a „Jetzt wichtig“ card for mails: stimulus; the scenario's problem is the number.
- Making the planner or mail module on by default: a maintainer decision (U16), asked in §6, not designed here.
- Mail on Android/PWA: a platform and Google-review decision (`docs/STATUS.md:225`), out of scope; the share-target path (F1) is the phone's bridge.

## 3. Changes to existing modules and their side effects

| Change                                                   | Touches                                                               | Side effects on other scenarios                                                                                                                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parser: invoice words, „zahlen“ + amount → invoice (U03) | `quickCapture/parser/index.ts`, test corpus                           | „Rechnung …“ already is an invoice; new: „Mahnung“, „Zahlungserinnerung“. A past-tense spend word („bezahlt“, „ausgegeben“, „gekauft“) keeps the booking. `$` still forces finance. B12 corpus grows by six sentences.               |
| Draft box inside the multi-line preview (U04)            | `CaptureForm.tsx`                                                     | A batch with a booking still books only after the person saw the draft line and tapped; the single sheet keeps „Buchen“. `quick-capture.spec.ts` „finance stays a draft“ unchanged (single), `capture-multi.spec.ts` gains one case. |
| Toast with one action after a batch (U05)                | `strings.ts` quickCapture block, `targets/index.ts` return value      | The single-entry toast („Gespeichert in ToDos · Rückgängig“) is unchanged.                                                                                                                                                           |
| F1 mode                                                  | `CaptureForm`, `CaptureWindow` (desktop hotkey window), `ShareTarget` | The hotkey window gets the mode too (one more flag); the share target opens the normal sheet unless the shared text has more than one line.                                                                                          |
| F2 mail actions, `?open=`                                | mail module, `LinkDialog`, planner page, ToDo row                     | „Aus dieser Mail anlegen“ stays for every other type; a ToDo link of kind `mail` opens in the app on the desktop and the web URL elsewhere (no mail module there).                                                                   |
| F3 invoice line                                          | mail list, `prefill.ts`                                               | The inbox widget's invoice count gets a verb; the automation template is untouched.                                                                                                                                                  |
| F4 fold and detail line                                  | planner page                                                          | `planner.spec.ts` opens the group before reading waiting rows; the calendar chip and widget are untouched.                                                                                                                           |

**Counter-scenarios (thought through).**

1. **Priya, freelancer, logs expenses fast.** „Mittagessen 12,50 € ausgegeben“ stays a booking (spend word); „Rechnung an Kunde Nord 500 € bis 30.10.“ stays an invoice as today; in Abladen she would type `$`-lines – the mode says „als Buchung: mit $ im normalen Zettel“ and keeps the line as a ToDo with the amount, nothing is lost. Her outgoing invoices never meet F3 (F3 reads incoming mail). Cost: one hint she reads once.
2. **Herbert, retired, uses mail on the PC to file invoices and nothing else.** F3 gives him exactly his path in one tap; F2's row action appears on personal mails too – a muted action like „Archivieren“, no count, switchable batch; with the planner off the action reads „Als ToDo“ (he may ignore it). F4 does not concern him. Cost: one more item in a row menu.
3. **Lena, shift worker, phone only, no mail module.** F1 is her whole gain (share a mail from the mail app → dump line; tile → Abladen); F2/F3 never show. The planner's fold (F4) helps her one-day-per-screen view most (the waiting list is the longest part on the phone).
4. **A person who likes the current multi-line preview with selects.** The single sheet keeps it; Abladen is a second tap, never forced.

## 4. The target, measured

Same paths and counting model as ANALYSIS §2 (the script's `MAX` holds today's numbers; the package „Nachmessen“ lowers them to the target column).

| Path                               | Device | Today (taps · keys · screens · dialogs · detours · ≈ s) | Target (medium variants)                                                                                       | Δ                                              |
| ---------------------------------- | ------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| A five things at once              | PC     | 3 · 141 · 2 · 2 · 1 · 53                                | 2 · 141 · 1 · 1 · 0 · 42 (FAB → Abladen is one tap; „Fertig“ saves; the toast names the place, no ToDos visit) | −1 tap, −1 screen, −1 dialog, −1 detour, −11 s |
| A five things at once              | phone  | 3 · 141 · 2 · 2 · 1 · 74                                | 2 · 141 · 1 · 1 · 0 · 63                                                                                       | −11 s, nothing below the fold                  |
| B two mails into the plan          | PC     | 9 · 0 · 2 · 2 · 0 · 19                                  | 2 · 0 · 1 · 0 · 0 · 4 (row actions „In den Plan“ and „Anlegen“; the toast names the day)                       | −7 taps, −2 dialogs, −15 s                     |
| B a label of 8 mails into the plan | PC     | 24 · 0 · 2 · 8 · 0 · ≈ 52                               | 2 · 0 · 1 · 1 · 0 · ≈ 9 („Alle in den Plan…“, one look at the preview)                                         | −22 taps                                       |
| C three things in passing          | phone  | 3 · 57 · 1 · 3 · 0 · 42 (14 per thing)                  | 1 · 57 · 1 · 1 · 0 · 30 (the field stays open)                                                                 | −2 taps, −2 sheets, −12 s                      |
| D planner page at overload         | PC     | 29 rows · 406 words · 56 interactive · 1 274 px         | ≤ 13 rows · ≤ 230 words · ≤ 40 interactive · ≤ 700 px (board + folded group)                                   | −16 rows, ≈ −45 % words                        |
| D planner page at overload         | phone  | 20 rows · 298 words · 39 interactive · 1 442 px         | ≤ 5 rows · ≤ 150 words · ≤ 25 interactive · ≤ 800 px                                                           | −15 rows                                       |

What the numbers do not show and matters most for S7: in Abladen the person never sees a count, a red figure or the backlog while unloading; the first screen after „Fertig“ is one line with one verb.

## 5. Package sketch (final plan after „Plan freigegeben“, in `PACKAGES.md`)

1. `fix/capture-batch-calm` – U03, U04, U05, U09, F4 (wording, defaults, parser words; S; no hotspot).
2. `feat/capture-dump-mode` – F1 medium (M; `quickCapture/**`; council: Advocate for wording and the money rule, Guardian for the share-target path).
3. `feat/mail-plan-actions` – F2 medium + F3 (M; `modules/mail/**`, `core/mail/{heuristics,prefill}.ts`, one line each in the planner page and the ToDo row; council: Guardian for names in synced ToDos and the batch preview, Architect for the bus payload and `?open=`).
4. `feat/mail-plan-automation` – F2 large (M; only if the maintainer wants it; new event with thread id = `core/events` hotspot row).
5. `qa/usecase-kopf-leer-remeasure` – rerun the script, lower `MAX` to §4, screenshots in the PR text.

Order 1 → 2 → 3 (→ 4) → 5; 1 and 3 touch different files and may run in parallel, 2 waits for 1 (`CaptureForm.tsx`).

## 6. Fragen an Sven (Empfehlung zuerst)

1. **Abladen und Geld:** (a) **Abladen bucht nie** – Geldzeilen mit Rechnungswort werden Rechnungen, sonst ToDos mit Betrag im Titel; Buchungen weiter nur im normalen Zettel oder mit `$` _(Empfehlung: kein zweiter Bestätigungsschritt, die Finanzregel bleibt unberührt)_ · (b) Abladen zeigt Buchungen als Entwurf und fragt am Ende einmal · (c) keinen eigenen Modus, nur die drei kleinen Fixes (Variante minimal).
2. **Mail → Plan, Umfang:** (a) **mittel** – Zeilenaktion „In den Plan“, „im Plan“-Marke, „Zur Mail“, „Alle in den Plan…“ je Ordner mit Vorschau, plus F3 „Anlegen“ in der Zeile _(Empfehlung: ein Paket, nutzt die Labels deines Filter-Chats)_ · (b) minimal – nur Knopf in der geöffneten Mail · (c) groß – zusätzlich Automation „Label → Plan“ (läuft nur bei laufender App mit Mail-Benachrichtigung).
3. **Titel aus der Mail:** (a) **„<Absendername> antworten“** (Betreff nur als Link-Beschriftung; der Name steht wie ein getipptes ToDo in Sync und Backup) _(Empfehlung)_ · (b) „<Betreff> beantworten“ · (c) nur der Betreff wie heute.
4. **Standard an?** (a) **Planer bleibt aus, Abladen ist auch ohne Planer sinnvoll** (Ende: „Sortieren“ → Eingang sortieren) _(Empfehlung: kein Kurswechsel in diesem Paket)_ · (b) Planer standardmäßig an für neue Installationen (eigene Entscheidung, eigener PR).
