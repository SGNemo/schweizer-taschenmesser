# Hand-off 11 – topic (package 11)

Concept: [CONCEPT-INTAKE, idea 11](../CONCEPT-INTAKE.md). Common parts: [00-common](00-common.md). Mockup: `../mockups/11-topic.html`.

## Giving a topic

- Row ⋯ → T1 „Thema …“ (in the group „Mehr“); selection bar: T1 after B11.
- Chooser = `Dialog`, title T2: one `TextField` (combobox: typing filters, Enter on a new name creates it), below it his topics as a list of radio lines (≤ 8, then scroll inside the dialog), „Kein Thema“ last. With ToDo tags present and no topic of that name: T7 lines under a small head, at most 3.
- A thing has one topic. Toast T8, one undo.
- The row shows **nothing new** for a topic (no chip, no colour): the topic is in the row's ⋯ under „Verknüpft“ and in the expanded panel's links.

## Shrinking the planner to a topic

- Page ⋯ → T3 → the same chooser without the field's „create“ and without T7.
- While on: the page head changes instead of a new line appearing – the figure („1 h 20 frei“) gives its place to T4: „Thema: Umzug“ (the figure's type) with the context „7 Dinge“ and the quiet button „Alles zeigen“. The day's free time stays where it is on the day sheet's own head line.
- The sheet, „Noch ohne Tag“, „Noch offen“ and the week band's bars show only members. The day sheet's „frei“ keeps counting the whole day (the day is as full as it is).
- T5 „Auch im Thema · 3“: a folded line at the end of the right column / under the sheet; expanded: each linked non-plan thing as a `PanelLine` with its module glyph and its link word; a tap opens it in its module.
- The field while filtered: a new thing gets the topic (lead chip „Thema: Umzug“ with ✕ in the preview slot).

## States

no topics yet (chooser: only the field and a hint line „Ein Thema hält Dinge aus mehreren Modulen zusammen.“) · topics exist · filter on · filter on, empty (T6 as the sheet's empty state; „Alles zeigen“ only in the head, not twice) · topic deleted elsewhere (filter ends) · 20 topics (dialog list scrolls; no topic bar anywhere).

## 1920 / 412

Same structure; on 412 the head wraps („Alles zeigen“ on its own line, 44 px target).

## Managing

Chooser foot: „Themen verwalten …“ → Planer → Einstellungen, section „Themen“: rename, T9 delete (confirm sentence, one undo, removes the links, touches no thing).

## Tests

- `topic.test.ts`: one topic per thing (a second replaces the first in one undo); delete removes links only; filter is device state.
- `linkTarget` of the planner: topic alive / gone; a link label is the topic's title.
- Two devices: the same thing given two topics offline → both rows exist; the reader takes the later `updatedAt`, the other row is tombstoned at the next tap on that thing (never by a background job).
- Write spy: switching the filter writes nothing synced.
- e2e seed `e2e/seed/plan-topic.seed.spec.ts`; `planner-hub-2.spec.ts` D4 re-measured.
