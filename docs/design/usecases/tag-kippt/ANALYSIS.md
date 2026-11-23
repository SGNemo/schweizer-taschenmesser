# Use case „Tag kippt“ – analysis (phase 1)

Branch `design/usecase-tag-kippt`, 2026-11-23. Measured on `develop` b62a48e2 (planner rethink packages 1–7 and the look of direction A merged). Target picture: [TARGET](TARGET.md); packages that stay: [PACKAGES](PACKAGES.md). Rules: [FOCUS-GUIDELINES](../../FOCUS-GUIDELINES.md), [FOCUS-WORDING](../../FOCUS-WORDING.md), [decisions/plan-rethink](../../../decisions/plan-rethink.md).

## 0. The case (neutral, invented things)

A weekend plan stands: 20 things over Saturday and Sunday (household, errands, messages, work, money). Saturday 16:00 nothing is done and an appointment fell through.

| Step | When     | What he wants                                                                                                                                                               |
| ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | Sa 16:00 | „ab jetzt neu“: four short things stay today, one of them smaller („Pfand sammeln“ instead of „Pfand wegbringen“, the rest during the week), Saturday's rest goes to Sunday |
| T2   | Sa 20:00 | a goal for the weekend („Wohnung frei bekommen“): 5 Saturday, 6 Sunday, 9 „nächste Wochen – nicht gestrichen“; one visible starting point                                   |
| T3   | Mo 08:00 | see the last state, lay it anew without guilt                                                                                                                               |
| T4   | any time | the plan he split up in a chat outside comes back in: text with day headings or the ToDos' JSON; pasting again updates                                                      |

Shrinking three times a day is normal for him. What stops him: the length of the visible list and every single grip per thing.

## 1. The measuring script

[`web/e2e/usecases/tag-kippt.spec.ts`](../../../../web/e2e/usecases/tag-kippt.spec.ts): fixed clock (Sa 28.11.2026), seed of 20 invented ToDos laid ten per day, desktop. It takes the best path the app offers and asserts `IST` (never worse); each build PR re-measures and moves `IST` toward `TARGET`. Handles = taps + one per paste or typed line; `perThing` = handles that act on one single thing.

| Path                        | Handles | of them per thing | Visible today after | Lost | Unasked moves | Note                                                                                                                                                                                                                                                                                |
| --------------------------- | ------- | ----------------- | ------------------- | ---- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1 shrink Saturday          | 9       | 4                 | 4                   | 0    | 0             | ⋯ · „Auswählen“ · „Alle“ · untick the 4 that stay · „Auf einen Tag …“ · So; making one thing smaller: not possible                                                                                                                                                                  |
| T2 5 / 6 / 9                | 31      | 23                | 5                   | 0    | 0             | the 9 for later only in ToDos: board, per thing ⋯ · „Verschieben nach Irgendwann“ (18); no starting point                                                                                                                                                                           |
| T3 Monday                   | 2       | 0                 | 8                   | 0    | –             | tab „Noch offen“ · „Alle auf heute“; no figure on the tab or in its lines                                                                                                                                                                                                           |
| T4 plan from outside (JSON) | 12      | 2                 | –                   | 0    | –             | ToDos ⋯ · Importieren · JSON einfügen · paste · Vorschau · import · close · Planer · Sunday · 2 × „Hierher legen“; **11 duplicates** (every thing that changed its day or went to later is a second ToDo); pasting again: **12** duplicates, the swap of two things does not arrive |
| T4 plan from outside (text) | –       | –                 | –                   | –    | –             | not possible: no door takes text with day headings                                                                                                                                                                                                                                  |

Raw table: `web/test-results/usecase-tag-kippt.md` after a run.

## 2. What the planner already does (checked before building)

| Feature                                                      | Carries the case?                                                                                                                                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „Auswählen“ on the day sheet + „Alle“ + „Auf einen Tag …“    | partly: moves a group in one move, but only to **a day**; what stays costs one untick each (T1: 4)                                                                                 |
| „Auswählen“ in „Noch offen“, „Alle auf heute“, „Verteilen …“ | yes for T3 (2 handles, calm words)                                                                                                                                                 |
| „Woche vorschlagen“, „Rest verteilen“                        | no: both spread over days, neither keeps a chosen few nor parks the rest without a day                                                                                             |
| Sentences (`say.ts`, `core/plan/instructions.ts`)            | no: ops are pin, earliest, exclude, block…; „heute nur A, B, C, Rest nächste Woche“ is read as „nicht vor“ per thing – the rest lands on days, never on „ohne Tag“ or „Irgendwann“ |
| Focus page (`/planner/focus/:item`)                          | yes as the target of a starting point; nothing on the sheet points to one thing                                                                                                    |
| „Irgendwann“ (`someday` on the ToDo)                         | exactly „nächste Wochen“, but only in ToDos; the planner's source hides it (`plannable.ts`) and has no step to set it                                                              |
| „Vom Tag nehmen“                                             | only for a thing open for more than 14 days in „Noch offen“; a laid thing has no way back to „Noch ohne Tag“ except per row                                                        |
| `plannedFor` in the ToDos' JSON import                       | arrives as „In ToDos: Sa · Hierher legen“ (one tap per thing); dedupe compares the whole record, so a changed day is a new ToDo                                                    |
| The planner's field                                          | one line; a pasted block loses its line breaks                                                                                                                                     |

## 3. Friction

| Id  | Where                 | What                                                                                                               | Weight |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------ | ------ |
| K01 | day sheet             | the rest can only go to a day – „diese Woche, ohne Tag“ and „nächste Wochen“ are no targets                        | high   |
| K02 | day sheet             | selecting means selecting what **goes**; he thinks in what **stays** – one untick per keeper                       | medium |
| K03 | planner               | no step to „Irgendwann“: 9 things = 18 handles in another module (T2)                                              | high   |
| K04 | planner               | „nächste Wochen“ is invisible from the planner afterwards; findable only in ToDos                                  | medium |
| K05 | row                   | no „kleiner machen“: first step today, rest later = rename + new ToDo by hand                                      | medium |
| K06 | sheet after shrinking | the list stays the view; no single starting point                                                                  | medium |
| K07 | plan from outside     | text with day headings has no door at all                                                                          | high   |
| K08 | plan from outside     | JSON door is in ToDos (5 handles away), lands as muted rows, one tap each                                          | medium |
| K09 | plan from outside     | pasting a changed plan duplicates every changed thing (11, then 12); a swap never arrives                          | high   |
| K10 | plan from outside     | nothing tells what is missing from the new plan                                                                    | low    |
| K11 | selection             | the row's checkbox is named only „Auswählen“ (the title is a button): a screen reader does not hear which thing    | low    |
| K12 | Monday                | fine: tab, calm line, „Alle auf heute“ (2 handles); 8 rows today afterwards – the list again                       | low    |
| K13 | ToDos board           | a card's ⋯ menu can sit under the next card (it takes the pointer); the measuring script presses the item directly | low    |

## 4. Critique of today's planner in this case (`design:design-critique`)

- **First impression:** the sheet shows ten rows for Saturday, same weight each; nothing says where to begin. Right for laying, wrong for a tipped day.
- **Usability:** the group move exists but is built for „all of these to one day“; the case needs „only these, the rest away“ (K01, K02). The deepest gap is outside the planner: later lives in ToDos (K03).
- **Hierarchy:** after shrinking, four rows plus the band, the context column and the field compete; the one action that matters (start) has no place (K06).
- **Consistency:** „Noch offen“ already speaks calmly („Nichts davon ist weg. Du entscheidest, wohin.“); the new targets should reuse that voice and the existing selection pattern instead of a new list editor.
- **Accessibility:** selection checkboxes need the thing's name (K11); targets ≥ 44 px are kept by the shared `ItemRow`.
- **What works:** nothing moves by itself (0 unasked moves in every path), nothing is lost, the Monday view has no counter.
- **Priorities:** (1) a door for a finished plan with recognition of what exists (K07–K09), (2) „only this today“ with the rest to two kinds of later (K01–K04), (3) a starting point and „kleiner machen“ (K05, K06).
