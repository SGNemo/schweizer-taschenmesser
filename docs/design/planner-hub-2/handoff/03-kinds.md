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

## What the line may contain per kind

| Kind | Line |
| --- | --- |
| Rechnung | Wird: **Rechnung** · payee · amount · „Frist Fr 4. Dez.“ (only if said) |
| Einkaufsliste | Wird: **Einkaufsliste** · Milch, Spülmittel, Batterien AA (≤ 3 names, then „+ n“) |
| Termin | Wird: **Termin** · Friseur · Mi 2. Dez. · 15:00 |
| Notiz | Wird: **Notiz** · Regal im Flur |
| Merkliste | Wird: **Merkliste** · example.org |
| Bündel | Wird: **Bündel** · Haushalt · 5 Schritte |

## States

no reading (examples as today) · reading shown · stored (toast K4 for the kind; field empty, focus stays in the field) · K3 used · module of the kind off (no line) · target failed (the field's existing error line; text stays; nothing was stored – the thing and its plan row are made inside one undoable action by the planner's own place function, called directly with its toast suppressed; when placing fails the thing is taken back: the place step returns failure instead of throwing, and the action then calls `undoEntry` on its own entry – the pattern of `placeRequested`).

## 1920 / 412

1920: one line. 412: the line wraps to two (text first, K3 on its own line right-aligned); the field is the page's last row, so the line stands **above** the field there (it must not hide under the keyboard); the capture sheet of the plus button shows it under the field.

## Edge cases

- „Rechnung schreiben an Müller“ (no amount): no line; a ToDo.
- „Milch“ known to the shopping list, but he is on a day sheet and wants a task: K3. No learning from that choice.
- A date word the planner reads itself („Wäsche morgen“): the planner's reading wins; no kind line.
- Pasted block of lines: „Plan einfügen“ as built; no kind line.
- Two kinds sure at once (URL inside an invoice sentence): the first of the order Rechnung, Termin, Einkaufsliste, Link, Notiz, Bündel.
- The local model stage (desktop) runs after this, only for entries without a line, as built.

## Tests

- `fieldKind.test.ts`: the „sure“ table, each row with two positives and three near misses; the order; module off.
- `Capture.test.tsx`: line and examples never together; Alt+Enter; live region debounce.
- Action test: one undo takes back the invoice **and** the plan row; a failing place step leaves no invoice (rollback); „Milch“ with the shopping list on „Nicht planen“ adds the item and leaves `excluded` as it is; write spy shows the planner writes only its own tables, the invoice comes from the capture target.
- Privacy: no amount in the toast while „Werte ausblenden“ is on.
- e2e seed `e2e/seed/plan-kinds.seed.spec.ts`; `planner-hub-2.spec.ts` flow A re-measured.
