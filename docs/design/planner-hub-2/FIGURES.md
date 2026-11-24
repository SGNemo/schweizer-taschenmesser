# Planner hub 2 – figures per path and package

The measuring script is `web/e2e/usecases/planner-hub-2.spec.ts`. This file derives every `TARGET` handle by handle from the designed paths, using the script's own counting. It also lists the acceptance figures for each package. Summary: [ANALYSIS §3](ANALYSIS.md). Order of packages: [PACKAGES](PACKAGES.md). Desktop = `desktop-chrome`, phone = `pixel-7`; „d / p“ gives desktop / phone where they differ.

## 1. How the script counts

- **taps**: each `tap` or `choose` counts 1. Each `fill` counts 1, or *n* with `lines`. Enter after a fill is free.
- **perThing**: +1 when a handle names a `thing`. A handle that acts on several things calls `touch`, which records where it happened but adds no perThing.
- **moduleSwitches**: changes of the first path segment. `/planner/focus/…` counts as `planner`; area pages (`/planen`, `/geld` …) do not count.
- **doneInPlanner** (`onlyInPlanner`): a thing counts if it has at least one recorded handle and every one of them was made on `/planner`. A thing without any handle never counts.
- **Navigation `go()`** on the desktop is the sidebar link, plus „Bereich … aufklappen“ when that area is folded. The current area is open, and an area unfolded by hand stays open. On the phone it is the bar, „Mehr“ and the area, or a tab. A navigation tap carries a `thing` only where the flow passes one (B: `Budget`).
- **„Noch ohne Tag“** is folded when the planner page opens, so unfolding it costs 1. Exception: from 10b, `?item=` unfolds it for the row it shows.
- **The shown day**: the planner opens on the first day with rows. Blockers (appointments) are no rows. A week tile costs 1. On the phone everything after „Zuerst“ (the day's first rows) sits under a folded „Danach“, which costs 1 to unfold; the desktop shows it open.
- **Conventions**: making a thing (C1 creation) names no `thing`. Selection ticks name their thing, as in D5. D3 names no thing at all (as IST does).
- **Words** must equal IST. A package that changes a word re-measures IST.

## 2. Paths per flow

### A1 – twelve lines into the planner's field (3)

Seed: the pantry knows „Milch“, „Spülmittel“, „Batterien AA“ (`pantry_item`, module `pantry` on). `kinds()` never reads the pantry, so IST is unaffected. Package 3's name lookup reads it.

Path, both projects: handles 1–12 are one typed line each. taps 12, perThing 0, switches 0.

After 3:
- 2 invoices are made „ohne Tag“ with their deadline and wait under „Noch ohne Tag“ (noDay).
- 3 list items go into the shopping list; its one row is asked in „ohne Tag“ (noDay).
- Friseur goes to the calendar and shows in the „Termine“ card.
- The note and the link get no row.
- 4 ToDos land on today.

rows = 4 + 3 = **7**. rightKind **12**. linkedToPlan = 2 + 3 + 1 + 4 = **10** (the note and the link are not linked).

### A2 – each thing as the right kind

No package walks this path any more (A1 replaces it), so TARGET = IST.

### B – finances and mails (4b, 4c, 2)

Things: i1 (late), i2, i3, s1 (cancelled), s2 (kept), Budget, and four mails. 4a changes nothing here.

**After 4b (and 4c), desktop.** The order mail → budgets → planner keeps the budget's navigation tap off `/planner`.

| # | handle | counted |
| --- | --- | --- |
| 1–2 | Bereich Wissen aufklappen, Navigation mail | 2 taps; switch 1 |
| 3–4 | „Alle in den Plan…“, „In den Plan (4)“ | 2 taps; touch 4 mails @mail |
| 5–6 | Bereich Geld aufklappen, Navigation budgets | 2 taps, 2 perThing (Budget @mail); switch 2 |
| 7–8 | Bereich Planen aufklappen, Navigation planner | 2 taps; switch 3 |
| 9 | „Noch ohne Tag“ unfold | 1 |
| 10–15 | i1 („Frist vorbei“, open on the desktop), i2, i3: expand, „Bezahlt“ (PayStep: day defaults to today, amount prefilled) | 6, perThing 6 |
| 16–18 | s1: expand, „Gekündigt am …“, „Vermerken“ | 3, perThing 3 |
| 19–20 | s2: expand, „Läuft weiter“ | 2, perThing 2 |
| 21–28 | 4 mail ToDos: ⋯, „Erledigt“ | 8, perThing 8 |

Desktop result: taps 28, perThing 21, switches 3, doneInPlanner 5 (invoices and subscriptions), rowsBefore 5, rowsAfter 0 („Läuft weiter“ takes s2 out of the source).

Phone after 4b:
- „Noch ohne Tag“ (1) and the „Frist vorbei“ row (1).
- Money: 11.
- „Leiste Geld“ (at the planner) and „Zu budgets“ (at finance), both naming Budget: 2.
- „Leiste Planen“: 1.

Phone result: taps 16, perThing 13, switches 3 (planner → finance → budgets → planner), doneInPlanner 5, rowsAfter 0.

**After 2.** The pile switches are on before `rowsBefore` is read. Expanding a pile is no `touch`.

| # | handle | counted |
| --- | --- | --- |
| 1 | „Noch ohne Tag“ unfold | 1 |
| 2 | expand „Finanzen checken“ | 1 |
| 3–5 | one-tap „Bezahlt“ on 3 invoice lines | 3, perThing 3 |
| 6–8 | s1: ▸, „Gekündigt am …“, „Vermerken“ | 3, perThing 3 |
| 9–10 | s2: ▸, „Läuft weiter“ | 2, perThing 2 |
| – | budget line: read only | 0 (Budget never counts) |
| 11 | expand „E-Mails durchgehen“ (desktop) | 1 |
| 12–13 | „In den Plan … (4)“ opens `PlanAllDialog` over the planner; its „In den Plan (4)“ | 2; touch 4 mails @planner |
| 14–17 | tick 4 mail member lines | 4, perThing 4 |

- Desktop: taps **17**, perThing **12**, switches **0**, doneInPlanner **9**, rowsBefore **2** (money pile, mail pile), rowsAfter **0** (a pile is a row only while it has members or a queue count; budgets alone keep none), mails 4.
- Phone (steps 1–10): taps **10**, perThing **8**, switches 0, doneInPlanner **5**, rowsBefore **1**, rowsAfter **0**.

**replySwitches** (desktop; phone 'nicht möglich'). It counts module switches from the planner until the reply editor of the first planned mail is open. It is measured after the mails are in the plan, with its own `Hand`, so the flow's other figures stay untouched.
- IST: unfold „Noch ohne Tag“, then the row chip „Aus Mail“ opens the thread on /mail: **1**. The demo mailbox has no body offline, so it shows no „Antworten“; the figure therefore ends at the open thread.
- From 4c: expand the row, then „Antworten“ opens mail's compose dialog over the planner: **0**.

### C1 – the household round (4a, 5a, 8, 3)

- **4a**: creation as IST, a routine made in Routinen (12 handles). Work:
  - 1 expand (Haushalt), 2 „Ganz öffnen“ (Haushalt) → routines.
  - 3–7 the five steps (Haushalt); the last one finishes the run.
  - 8 back to the planner (1 navigation).
  - work 8, perThing 7, taps 20, switches 4 / p 5.
- **5a**: the thing is a ToDo with a five-line checklist. Creation before 3, both projects:
  - 1 field „Haushalt“, 2 expand, 3 „Ganz öffnen“ → todos.
  - (desktop only) „Bearbeiten“.
  - 5 checklist lines (one fill each), „Speichern“, back to the planner (1).
  - create 11 / p 10, 2 switches.
  - Work: 1 expand, 2 „Los“, 3–7 five times the filled button. The last button, „Fertig“, ticks the thing and returns to the plan. The alternative (expand, 5 panel ticks, row tick) is also 7.
  - work 7, perThing 7, switches 0, nextStepOnly ja.
- **3**: create is 1 typed line „Haushalt: Wäsche anstellen, …“. It makes a ToDo with a checklist on the day shown (today), so rows is 1.
  - Work 7. taps **8**, perThing **7**, switches **0**.
- „Als Routine speichern“ (2 handles) is not walked: `savedAsRoutine` is a constant, like the duration probe.

### C2 – the errand round (5b, parked)

**Create, desktop:**

| # | handle | counted |
| --- | --- | --- |
| 1–2 | Bereich Haushalt aufklappen, Navigation lists | 2; switch 1 |
| 3–4 | list ⋯, „In den Plan“ | 2 (the list stands for 3 items: touch) |
| 5–6 | Bereich Planen aufklappen, Navigation planner | 2; switch 2 |
| 7 | „Noch ohne Tag“ unfold (the list row waits there) | 1 |
| 8–9 | Tag ⋯, „Auswählen“ | 2 |
| 10–12 | tick errand 1, errand 2, the list row | 3, perThing 2 (the list row is a touch) |
| 13–14 | „Bündeln …“, „Bündeln“ (name prefilled) | 2 |

Desktop create is **14**. The phone gets there in 2 handles (Mehr, Mehr · Haushalt) and back in 1 (Leiste Planen), so create is **13**. Ticking an errand first gives the bundle today's date.

**Work, both projects:** expand the bundle (1), tick 2 errands (2), tick 3 list items in the bundle (3) = **6**.

perThing = 2 + 5 = **7**. switches **2**. rows **1**: the bundle row; members are not listed, and rows are read after creation.

### D1 – is it in the plan, and when (10b, 4a)

- **10b**: on the module's side the day mark is visible and agrees for all 5 things, so `tripsToPlanner` is 0. The first half (from the planner into each module) stays 11 / 5 / 10.
- **4a**: four rows now cost „expand“ + „Ganz öffnen“ (both naming the thing) instead of one tap. The note is reached through its ToDo's chip „Zur Notiz“, which 4a does not change, so it stays 1.
  - Both projects: taps 11 + 4 = **15**, perThing 5 + 4 = **9**, switches 10. (Phone IST includes one „Danach“ unfold.)

### D2 – shared link (1)

Path from /share: 1 „Speichern“ (the capture form starts as `plan`), 2 „Ansehen“ → `/planner?item=…`. `?item=` unfolds „Noch ohne Tag“, so the row is in view.

taps **2**, switches **1** on both projects, forms 1, inPlanner ja, wayBack ja (the row's URL chip).

### D3 – before an appointment (9)

The planner opens on today, because the appointment is a blocker, not a row.

Path: 1 tile Wednesday, 2 expand the Friseur blocker row, 3 „Vorbereiten …“, 4 type „Bargeld holen“ + Enter.

taps **4**, perThing 0, switches 0.

### D4 – one topic (11)

Seed: one Umzug ToDo on each of Mon–Fri. The invoice is the last row on Thursday, and the appointment (a blocker) is on Friday. A row's ⋯ (also a blocker's) offers the last used topic as „Thema: Umzug“.

| # | handle | counted |
| --- | --- | --- |
| 1–3 | Mon: ⋯, „Thema …“, type „Umzug“ + Enter | 3, perThing 3 |
| 4–6 | tile Di; ⋯, „Thema: Umzug“ | 3, perThing 2 |
| 7–9 | tile Mi; the same | 3, perThing 2 |
| 10–14 | tile Do; ToDo ⋯ + entry; invoice ⋯ + entry | 5, perThing 4 |
| (phone) | „Danach“ unfold to reach the invoice | +1 |
| 15–19 | tile Fr; ToDo ⋯ + entry; appointment ⋯ + entry | 5, perThing 4 |
| 20–22 | page ⋯, „Nur ein Thema zeigen …“, choose Umzug | 3 |

- taps **22** / p **23**, perThing **15**, switches **0**.
- rows after the filter: the tiles show 1+1+1+2+1 = 6, plus the appointment in „Termine“ = **7**. planFilter ja.

### D5 – waiting

Struck, so TARGET = IST.

## 3. Figures after each package

The tables list only flows the package changes. Values are d / p where they differ. Bold marks a figure above IST.

| after | flow | figures |
| --- | --- | --- |
| IST | B | rowsBefore 5, taps 27 / 14, perThing 17 / 9, switches 5, done 1, rowsAfter 1, replySwitches 1 / – |
| 10b | D1 | taps 11, perThing 5, switches 10, markVisible 5, markAgrees 5, tripsToPlanner 0 |
| 4a | D1 | **taps 15**, **perThing 9**, switches 10, marks 5 / 5, trips 0 |
| 4a | C1 | create 12, **work 8**, **taps 20**, **perThing 7**, switches 4 / 5, nextStepOnly nein |
| 4b | B | rowsBefore 5, **taps 28 / 16**, **perThing 21 / 13**, switches 3, done 5, rowsAfter 0, replySwitches 1 / – |
| 4c | B | after 4b: as 4b; before it: as IST; `replySwitches` 0 |
| 2 | B | rowsBefore 2 / 1, taps 17 / 10, perThing 12 / 8, switches 0, done 9 / 5, rowsAfter 0, mails 4 / –, replySwitches 0 / – |
| 5a | C1 | create 11 / 10, work 7, taps 18 / 17, **perThing 7**, switches 2, nextStepOnly ja |
| 8 | C1 | as 5a; learned ja (the second time `durationProposed` = measured) |
| 1 | D2 | taps 2, switches 1, forms 1, inPlanner ja, wayBack ja |
| 3 | A1 | rows 7, taps 12, perThing 0, switches 0, rightKind 12, linkedToPlan 10 |
| 3 | C1 | rows 1, create 1, work 7, taps 8, **perThing 7**, switches 0, nextStepOnly ja, learned ja |
| 9 | D3 | taps 4, perThing 0, switches 0, linked ja, onWednesday ja |
| 11 | D4 | rows 7, taps 22 / **23**, perThing 15, switches 0, planFilter ja |

The final row of each flow is its `TARGET`. A2 and D5 keep IST. C2 keeps its IST in this round: 5b is parked (released 8, parked 5b – the maintainer, 2026-11-24); the script keeps C2's `TARGET` for the day 5b is built – parked stage: rows 1, **create 14 / 13**, work 6, **perThing 7**, switches 2, oneRow ja.

## 4. Named prices

**Lasting.** The TARGET sits above IST, and `reached()` bounds the figure at its TARGET.

| figure | IST → price | from |
| --- | --- | --- |
| C1 perThing | 6 → 7 | 4a |
| C2 createTaps | 0 → 14 / p 13 | 5b (parked) |
| C2 perThing | 5 → 7 | 5b (parked) |
| D1 taps | 11 → 15 | 4a |
| D1 perThing | 5 → 9 | 4a |
| D4 taps (phone) | 22 → 23 | 11 |

**For a while.** These use the spec's `PRICE` record. Each entry is `{ figure, max, until: [istKey, value] }`. The figure may reach `max`, never more, while `IST[path][istKey] === value`. The package that ends the price re-measures that IST entry, and from then on the usual bound applies.

| figure | IST → price | from | until | `until` |
| --- | --- | --- | --- | --- |
| B taps | 27 → 28 / p 14 → 16 | 4b (also 4c) | 2 | `rowsBefore` = 5 |
| B perThing | 17 → 21 / p 9 → 13 | 4b | 2 | `rowsBefore` = 5 |
| C1 workTaps | 7 → 8 | 4a | 5a | `nextStepOnly` = nein |
| C1 taps | 19 → 20 | 4a | 5a | `nextStepOnly` = nein |

## 5. Ambiguities and the reading chosen

1. **B pile switches** are set before `rowsBefore` is read, because the code reads it before `hand.start()`. Tapping the offers instead would cost +2 on desktop and +1 on the phone.
2. **Expanding a pile** acts on no member, so it is no `touch`. Otherwise the budget would count as done.
3. **B 4b, the budget's navigation tap** carries `Budget`. Made from `/planner`, it would count the budget as done (done 6), so the path goes mail → budgets → planner. Taps are equal either way.
4. **B 2, the mail pile**: mails that became ToDos leave the queue, so the pile is gone after the ticks.
5. **C1 5a**: the desktop shows the detail before the editor (+„Bearbeiten“), as D3/D4 do; the phone opens the editor directly. If the desktop editor opens directly, create is 10.
6. **C2**: the „Noch ohne Tag“ unfold for the list row is counted. If selection mode unfolds it, create is 13 / 12.
7. **D1**: the note keeps its one-handle chip after 4a. Walked through expand + a panel link instead, it would be 16 / 10.
8. **D4**: the filter chooser applies on a tap of its line (+1 if it needs a confirm). The phone's „Danach“ fold is as D1 phone shows it; if Thursday's last row were visible, the phone would also be 22.
9. **C1 „Als Routine speichern“** is not counted (+2 taps if walked).

## 6. What each package must change in the script's reading

- **10b–4a (D1)**: the first half walks expand + „Ganz öffnen“ for every row except the note (chip).
- **4b / 2 (B)**: walk the panels and then the piles. Set `pileMoney` / `pileMail` before `rowsBefore` is read.
- **4c (B)**: `replySwitches` waits for mail's compose dialog (`replyEditor` in the facts) instead of the thread pane. If the e2e build still loads no body, give the demo thread a cached message.
- **5a / 8 / 3 (C1)**: create a ToDo with a checklist (5a), then a typed task with steps (3). `nextStepOnly` is read from the „Los“ view; `learned` (8) from the second proposal.
- **5b (C2, parked)**: read `rows` after the bundle exists (as C1 reads `created`). Read `oneRow` from that result; the row ⋯ never offers „Bündeln …“.
- **1 (D2)**: the way back counts when the row holds a link to the shared host or a control whose accessible name contains the host. Today only `href` and the `aria-label` attribute are checked.
- **3 (A1)**: the name lookup reads the pantry. The seed holds the three names there.
- **9 (D3)**: `linked` reads `_links` (`before`, ToDo → `calendar:ev1`), because hand-off 09 leaves `todo.links[]` empty.
- **11 (D4)**: read `rows` (tiles plus „Termine“) and `planFilter` after the filter is on, not before the walk.
