# Hand-off 03 – kinds in the field (package 3)

Concept: [CONCEPT-INTAKE, idea 3](../CONCEPT-INTAKE.md). Common parts: [00-common](00-common.md). Mockup: `../mockups/03-kinds.html`.

## Structure (`Capture.tsx`, additive prop `preview`)

```
[ Rechnung Stadtwerke 80 € bis Fr                         ] [Eintragen]
  ⌁ Wird: Rechnung · Stadtwerke · 80,00 € · Frist Fr 4. Dez.   Als Aufgabe eintragen
```

- The preview line sits directly under the field, left edge = the field's text edge; height 44 px **reserved only while it shows** (the examples line under the field is replaced by it, so the block does not grow: examples and preview never show together).
- Left: the kind's module glyph 16 px, `--text-3`; text K1 in `--text-sm`: only „Wird:“ is `--text-3`; the kind word (K2) is 600 `--text`, the read parts `--text` (the line must not be grey on grey); amount through `SensitiveValue`.
- Right: K3, a quiet text button (ghost), min 44 px target.
- `aria-live="polite"` on the line: it is read once per change of kind, not per keystroke (debounce 400 ms; the visual line updates at once).
- Enter stores what the line says; Alt+Enter = K3.
- Lead chips (A2 from hand-off 09, T11 from hand-off 11) stand before the input, at most two, A2 first; the line keeps its place under the field. Only a plain ToDo – also one with steps – takes the lead chips (A2 → link and day, T11 → topic). For every other kind (Rechnung, Einkaufsliste, Termin, Notiz, Merkliste) the chips are drawn struck through while K1 shows and are not applied. When a chip gives the day, K1 / the field's toast names that day.
- An Aufgabe mit Schritten needs `CaptureFields.checklist?` and its mapping in the todo capture target – package 3 adds both (`web/src/quickCapture/parser/types.ts`, `web/src/quickCapture/targets/adapters.ts`, with a test).
- A struck lead chip carries A7 as its description (`aria-describedby`); a plain ToDo with a lead chip gets the field's toast K7.
- „Einkaufsliste“ by a known name needs the name lookup this package builds in `web/src/quickCapture/targets/lookup.ts` (today it holds only `findOpenInvoice`): pantry item names and shopping-list item names, read through the generic manifest repo as `findOpenInvoice` does (core, no module import), exact, case-blind, local, only while those modules are on.

## What the line may contain per kind

| Kind | Line |
| --- | --- |
| Rechnung | Wird: **Rechnung** · payee · amount · „Frist Fr 4. Dez.“ (only if said) |
| Einkaufsliste | Wird: **Einkaufsliste** · Milch, Spülmittel, Batterien AA (≤ 3 names, then K6 „+ n“) |
| Termin | Wird: **Termin** · Friseur · Mi 2. Dez. · 15:00 |
| Notiz | Wird: **Notiz** · Regal im Flur |
| Merkliste | Wird: **Merkliste** · example.org |
| Aufgabe mit Schritten | Wird: **Aufgabe mit Schritten** · Haushalt · 5 Schritte (lands on the day on the sheet, like any field ToDo; a plain ToDo row: „Thema …“ is offered, no B14) |

## States

no reading (examples as today) · reading shown · stored (toast K4 for the kind – Rechnung and Einkaufsliste lie „ohne Tag“, an Aufgabe mit Schritten on the sheet's day and the toast says which; only Notiz and Merkliste offer „In den Plan“, a Termin none; field empty, focus stays in the field) · K3 used · module of the kind off (no line) · target failed (the field's existing error line; text stays; nothing was stored – the thing and its plan row are made inside one undoable action by the planner's own place function, called directly with its toast suppressed; when placing fails the thing is taken back: the place step returns failure instead of throwing, and the action then calls `undoEntry` on its own entry – the pattern of `placeRequested`).

## 1920 / 412

1920: one line. 412: the line wraps to two (text first, K3 on its own line right-aligned); the field is the page's last row, so the line stands **above** the field there (it must not hide under the keyboard); the capture sheet of the plus button shows it under the field.

## Edge cases

- „Rechnung schreiben an Müller“ (no amount): no line; a ToDo.
- „Milch“ known to the shopping list, but he is on a day sheet and wants a task: K3. No learning from that choice.
- A date word without a sure kind („Wäsche morgen“): the planner's reading wins; no kind line. A sure kind that uses a date wins over the planner's date reading and takes the date: „Rechnung Stadtwerke 80 € bis Fr“ → invoice with deadline Fr; „Mi 15:00 Friseur“ → appointment on Wednesday. „fest“, „Pause …“, „heute nur …“ and a pasted plan still come first.
- „Mahnung …“ with an amount: no line (not a sure kind; it would duplicate an open invoice).
- Pasted block of lines: „Plan einfügen“ as built; no kind line.
- Two kinds sure at once (URL inside an invoice sentence): the first of the order Rechnung, Termin, Einkaufsliste, Link, Notiz, Aufgabe mit Schritten.
- The local model stage (desktop) runs after this, only for entries without a line, as built.

## Tests

- `fieldKind.test.ts`: the „sure“ table, each row with two positives and three near misses; the order of readings („Rechnung Stadtwerke 80 € bis Fr“, „Mi 15:00 Friseur“, „Wäsche morgen“); „Mahnung“ is no kind; module off.
- `lookup.test.ts`: the name lookup – exact, case-blind, pantry and shopping-list names, nothing while the module is off, no module import.
- `Capture.test.tsx`: line and examples never together; Alt+Enter; live region debounce.
- Action test: one undo takes back the invoice **and** the plan row (placed by `placeMany(refs, null)` inside the action, never `requestIntoPlan`; a plain ToDo / Aufgabe mit Schritten through `addFromField`; `requestIntoPlan` only for the toast's later „In den Plan“ on Notiz and Merkliste); a failing place step leaves no invoice (rollback); „Milch“ with the shopping list on „Nicht planen“ adds the item and leaves `excluded` as it is; write spy: planner tables + `_links` + its `_meta` keys + exactly the capture target's collection (the invoice comes from `saveCapture`, a core capture target, on his tap and inside the planner's one undo entry); Enter with lead chips gives a plain ToDo or an Aufgabe mit Schritten link, day and topic, and applies nothing for every other kind; the toast names the chip's day.
- Privacy: no amount in the toast while „Werte ausblenden“ is on.
- e2e seed `e2e/seed/plan-kinds.seed.spec.ts`; `planner-hub-2.spec.ts` A1 re-measured (rows 7, rightKind 12, linkedToPlan 10; the seed's pantry knows the three shopping names) and C1 (create 1, taps 8, switches 0).
