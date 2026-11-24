# Hand-off 11 – topic (package 11)

Concept: [CONCEPT-INTAKE, idea 11](../CONCEPT-INTAKE.md). Common parts: [00-common](00-common.md). Mockup: `../mockups/11-topic.html`.

## Giving a topic

- Row ⋯ → T1 „Thema …“ (in the group „Mehr“); selection bar: T1 after „Verschieben …“ (after B11, should 5b be built). Offered only on rows whose module is linkable (`isLinkable`) and on appointment (blocker) rows; never on pile rows (and bundle rows, should 5b ever be built).
- After a topic was used once, the row's ⋯ offers it directly: T12 „Thema: Umzug“ (the last used topic; device-local memory, not synced), one entry above T1; a tap gives the topic at once (toast T8, one undo).
- Chooser = `Dialog`, title T2: one `TextField` (combobox: typing filters, Enter on a new name creates it), below it his topics as a list of radio lines (≤ 8, then scroll inside the dialog), „Kein Thema“ last. A tap on a line chooses it. The planner never reads ToDo tags.
- A thing has one topic. Toast T8, one undo. The link stores the thing (`entityId` for occurrence rows); `topic` links are written only by this action, never through the bus.
- The row shows **nothing new** for a topic (no chip, no colour): the topic is in the row's ⋯ under „Verknüpft“ and in the expanded panel's links.

## Shrinking the planner to a topic

- Page ⋯ → T3 → the same chooser without the field's „create“; a tap on a topic's line switches the filter on.
- While on: the page head changes instead of a new line appearing – the figure („1 h 20 frei“) gives its place to T4: „Thema: Umzug“ (the figure's type) with the context „7 Dinge“ and the quiet button „Alles zeigen“. The day's free time stays where it is on the day sheet's own head line.
- The sheet, „Noch ohne Tag“, „Noch offen“ and the week band's bars show only members. An appointment with the topic stays visible as its blocker row; blockers without the topic are hidden while filtered. The day sheet's „frei“ keeps counting the whole day (the day is as full as it is).
- The field while filtered: a new thing gets the topic (lead chip T11 „Thema: Umzug“ with ✕ before the input; with A2 present, A2 first – [00-common](00-common.md) „One slot, an order“). Only a plain ToDo – also one with steps – takes the lead chips (A2 → link and day, T11 → topic). For every other kind (Rechnung, Einkaufsliste, Termin, Notiz, Merkliste) the chips are drawn struck through while K1 shows and are not applied. When a chip gives the day, K1 / the field's toast names that day. A thing that does not take T11 (Rechnung, Einkaufsliste, Termin, Notiz, Merkliste) ends its toast with K9 „Nicht im Thema „Umzug“ · Alles zeigen“ – „Alles zeigen“ ends the filter; a ToDo with only T11 gets K8.

## States

no topics yet (chooser: only the field and a hint line „Ein Thema hält Dinge aus mehreren Modulen zusammen.“) · topics exist · filter on · filter on, empty (T6 as the sheet's empty state; „Alles zeigen“ only in the head, not twice) · topic deleted elsewhere (filter ends) · 20 topics (dialog list scrolls; no topic bar anywhere).

## 1920 / 412

Same structure; on 412 the head wraps („Alles zeigen“ on its own line, 44 px target) and a topic name truncates after one line (full name as the accessible name).

## Managing

Chooser foot: T10 „Themen verwalten …“ → Planer → Einstellungen, section „Themen“: rename, T9 delete (confirm sentence, one undo, removes the links, touches no thing).

## Tests

- `topic.test.ts`: one topic per thing (a second replaces the first in one undo); delete removes links only; filter is device state.
- `linkTarget` of the planner: topic alive / gone; a link label is the topic's title.
- Two devices: the same thing given two topics offline → both rows exist; the reader takes the later `updatedAt`; the other row is removed only inside the next „Thema …“ action on that thing (never by a background job, never inside another action's undo entry).
- K9 on a Rechnung typed while filtered; its „Alles zeigen“ ends the filter.
- Write spy: switching the filter writes nothing synced; T12's memory is device-local.
- „Thema …“ / T12 absent on pile and non-linkable rows, present on blocker rows.
- e2e seed `e2e/seed/plan-topic.seed.spec.ts`; `planner-hub-2.spec.ts` D4 re-measured (rows 7, taps 22 / phone 23, perThing 15, switches 0, planFilter ja), with `rows` and `planFilter` read after the filter is on.
