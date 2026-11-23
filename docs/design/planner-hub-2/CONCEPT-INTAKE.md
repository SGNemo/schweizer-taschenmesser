# Planner hub 2 – concept: what comes in and how it is cut (ideas 1, 3, 6, 9, 11, 7)

Frame and link contract: [CONCEPT](CONCEPT.md). Rows: [CONCEPT-ROWS](CONCEPT-ROWS.md). Words: [COPY](COPY.md).

## Idea 1 – share → planner

**Exists.** Android `ACTION_SEND` for `text/plain` (≤ 20 000 characters), PWA `share_target`, both land on `/share` with the quick-capture form (`pages/ShareTarget.tsx`); targets bookmarks, notes, ToDos, lists, feeds. Nothing is stored before his tap (LAUNCH-REVIEW-2026-11 B9: „only pre-fill“).

**Behaviour.** (1) Share from any app → Nemo opens `/share`. (2) With the planner on, the first and preselected target is **„In den Planer“**; the card shows what will be stored: title (first line, ≤ 160), „ohne Tag“, and for a link the host as text. (3) One tap „Ablegen“ → a ToDo through `plan.requested` (`day: null`), toast „Liegt im Planer unter „Noch ohne Tag“. · Ansehen · Rückgängig“; the share page closes back to the app he came from (Android: `finish()`; PWA: stays on the toast). (4) The row carries the way back: a link's URL sits in the ToDo's `url`-less note as the first line and shows as the chip „Im Browser öffnen“ (opens only on a tap, http/https only, host shown); text keeps its remaining lines as the ToDo's note (≤ 4 000, the rest cut, said on the card: „Gekürzt auf 4 000 Zeichen.“). (5) Day chips „Heute“ / „Morgen“ on the card are optional; default is „ohne Tag“.

**Against LAUNCH-REVIEW-2026-11.** New surface: none in the manifest (same intent filter, same exported activity – NS4's merged-manifest check keeps passing). B9 stays true: pre-fill only. Q3: the URL is scheme-checked before it becomes a chip. Never fetched: no title lookup, no preview image, no favicon. The text is rendered as text (no HTML, no Markdown, no auto-link in the card). The share page never offers `accounts`. While the app lock or the vault lock is active nothing changes (the planner is not behind it). MOD1: the target is offered only when the planner module is on; the native side still only hands text over.

**Struck part: pictures.** `image/*` would need a new exported filter, content-URI reads, a size and type gate (magic bytes, ≤ 10 MiB) and a place to keep the file – notes have no attachments, Unterlagen's titles must not show in the plan. It lowers no figure the text path does not already lower, and it is the one truly new entry surface. Not built; „Im Nachhinein klären“ in the PR.

**States.** planner off (target missing, page as today) · empty share (page says „Nichts angekommen.“, as today) · too long (cut, said) · stored · write failed (card stays, „Nicht gespeichert. Noch einmal?“).

**Target (script, D2).** Shared link ends as a planner row: handles 6 → 2, module switches 1 → 0, forms 1 → 0.

**Not part of it.** No way back into the source *app* (Android hands no dependable sender; a guessed package name would be a lie), no share *out* of the planner, no background receive.

## Idea 3 – unload with kind recognition

**Exists.** The quick-capture parser knows 15 kinds incl. invoice (amount, „Rechnung“, „Mahnung“), list, event, note, bookmark (`core/quickCapture/parser`); the planner's field ignores it and always makes a ToDo.

**Behaviour.** (1) While he types, the field asks the same local parser. Only a **sure** reading (rules below) shows one line under the field: „Wird: Rechnung · Stadtwerke · 80,00 € · Frist Fr 4. Dez.“ and the button „Als Aufgabe eintragen“. (2) Enter stores what the line says, through the capture target of that kind, and – for kinds that are plan things – requests it into the plan (`requestIntoPlan`), all in one undoable action. (3) „Als Aufgabe eintragen“ (or Alt+Enter) stores the plain ToDo; the line is gone for this entry. (4) The toast names it again: „Rechnung angelegt, liegt unter „Noch ohne Tag“. · Rückgängig“. (5) No line → exactly today's behaviour.

| Kind | Sure when | Lands | Plan |
| --- | --- | --- | --- |
| Rechnung | the word „Rechnung“ / „Mahnung“ **and** an amount | Rechnungen (title, amount, deadline if said) | row `invoices:<id>`, „ohne Tag“, with „Vorschlag“ chip if a deadline |
| Einkauf | „kaufen“, „Einkauf:“ … **or** the whole entry is a name the shopping list or pantry already knows (local lookup, exact, case-blind) | the shopping list (several items by comma) | the list's one row, requested |
| Termin | a clock time **and** a day | Kalender | none (it is a blocker of its day) |
| Notiz | starts with „Notiz:“ / „Idee:“ | Notizen | none; toast offers „In den Plan“ |
| Link | the entry is one http/https URL | Merkliste | none; toast offers „In den Plan“ |
| Bündel | „Name: a, b, c“ with ≥ 2 parts and no other kind sure | one ToDo with checklist (5a) | as any ToDo |

Everything else – and every kind whose module is off – is a ToDo. The planner's own readings (dates, „fest“, „Pause …“, „heute nur …“, a pasted plan) come first and are unchanged.

**Never silently wrong.** The line appears before Enter and is the only thing that decides; a reading below the „sure“ rules shows nothing; the wrong kind costs one tap before (button) or one after (undo). Switch „Arten im Feld erkennen“ (on; off = today).

**Data / contract.** None new: `saveCapture(type, …)` and `requestIntoPlan`. The preview is derived, not stored.

**Risk.** A stale shopping name turning „Batterien“ into a list item when he meant a task: the line says so first. Money never appears in a toast while „Werte ausblenden“ is on (`SensitiveValue` in the line, no amount in the toast).

**Target (script).** A1: `rightKind` 4 → 12 of 12 with the field alone; A2 becomes unnecessary: module switches 8 → 0, forms 6 → 0.

**Not part of it.** No model, no network, no kind picker, no second field, no recognition inside „Plan einfügen“.

## Idea 6 – errand round

**Behaviour.** A bundle (5b) of kind `errand`. (1) „Auswählen“ → tick the errands and the shopping list → „Bündeln …“ → switch „Unterwegs“ in the naming step. (2) The row: „Besorgungen · 3 Stopps“, glyph of maps. (3) Expanded: the stops in order; a list stop shows its open items as tick lines (the lists panel), a task stop its tick; each stop may get a place: „Ort …“ picks from his saved places (maps) or leaves it empty. (4) „Auf der Karte ansehen“ jumps to `/maps?places=<ids>` (ids only, untrusted, read once) – shown only when ≥ 1 stop has a place and maps is on. (5) „Los“ walks the stops like steps.

**Proposal.** None automatic in v1 beyond the switch: the planner does not know what is „außer Haus“.

**Contract.** `maps` gets `linkTarget` for places (title = place name); link `place` from the member thing to the place; nothing else.

**Struck part.** A map inside the planner (tiles, a network request from the planner's page, a new stimulus block) lowers no figure the jump does not; the order of stops is his, no routing.

**Target (script).** C2: rows 3 → 1, module switches 2 → 0 (list ticked in place; the map jump is optional and counted separately).

**Not part of it.** No address field on things, no geofence, no opening hours, no route time in the day's minutes.

## Idea 9 – before and after an appointment

**Behaviour.** (1) An appointment is a recessed blocker row on its day. Expanded (idea 4, calendar's panel): time, place, and two quiet buttons „Vorbereiten …“ and „Danach …“. (2) A tap puts the cursor into the planner's field with a lead chip „vor Friseur, Mi“ (✕ removes it); what he enters becomes a ToDo on the appointment's day (before: the day itself, or the day before when he taps the chip's second choice „am Tag davor“), linked `before` / `after` to the appointment. (3) The row shows the chip „vor Friseur“ and sorts before / after the blocker inside its day part. (4) The calendar's „Vorbereitung“ block lists it (reverse links, exists).

**Contract.** Rels `before`, `after`; `plan.requested.links`; calendar `planPanel`. No time is given to the thing: the planner stays a day planner (`decisions/plan.md`).

**Target (script, D3).** A prepared thing linked to its appointment: module switches 2 → 0, handles 7 → 3.

**Not part of it.** No automatic „Vorbereiten“ row, no travel time, no templates per kind of appointment, nothing for all-day events.

## Idea 11 – topic as a bracket

**Why a topic and not a tag.** Tags exist in four modules as loose strings; notebooks, lists and categories in others; Rechnungen, E-Mail and Kalender have none. A cross-module tag would mean a new field in every module. A topic is instead **one planner row with links**: `planner_topic` (a title) and one `topic` link per member in the store that already syncs, reads both ways and survives deletion. No module gets a field; no module needs to know topics exist. It is shown nowhere until he makes one. ToDo tags, lists and notebooks stay what they are; a tag is offered once as a topic („Tag „umzug“ als Thema übernehmen“ in the topic chooser) and never synced back.

**Behaviour.** (1) Row ⋯ or the selection bar: „Thema …“ → choose one or type a new name. (2) Page ⋯: „Nur ein Thema zeigen …“ → the sheet, the band's bars and „Noch ohne Tag“ show only that topic's things; the page head says „Thema: Umzug · 7 Dinge · Alles zeigen“ in place of its figure. (3) Things that are no plan rows but carry the topic (a note, an appointment, a document) stand in a folded line „Auch im Thema · 3“ under the sheet, each a link. (4) The filter is device state (not synced, survives a reload, ends with „Alles zeigen“). (5) Deleting a topic removes its links in the same undo; no thing is touched.

**States.** no topic exists (no entry in the page's ⋯ beyond „Thema …“ on rows) · filter on · filter on and empty („In diesem Thema liegt gerade nichts im Plan.“) · topic gone on another device (filter ends, toast-free).

**Target (script, D4).** Rows on the sheet while working on one topic of 7 among 20 things: 20 → 7; handles to give 5 things a topic: 3 (select, „Thema …“, choose).

**Not part of it.** No topic page outside the planner, no colours per topic, no topic in the capture syntax, no nesting, no topic on `accounts`.

## Idea 7 – „Warte auf Antwort“ (last, separable, not yet confirmed by the maintainer)

**Behaviour.** (1) Row ⋯ „Warte auf Antwort …“ → „bis“: 3 Tage · 1 Woche · 2 Wochen · Datum; optional „von“: a person (people) – a mail thread is taken from the row's own link. (2) The row leaves the sheet and stands in a folded line „Wartet auf Antwort · 2“ at the end of „Noch ohne Tag“ (text, no count badge; expanded: thing, „bis Mo 7. Dez.“, „Zurückholen“). (3) On that day it is back in „Noch ohne Tag“ with the chip „Antwort da? · von Vermieter“ and its links; nothing is written on that day – the source simply lists it again. (4) No notification.

**Contract.** `PlannableSource.onWait?(id, until: string | undefined)` + `listWaiting?()` (ToDos: `startDate`, which already hides a task until that day); link `wait` to the person / thread. A source without the step does not offer the entry.

**Target (script, D5).** Rows on the sheet with 3 things waiting: −3; handles to park one: 3; to bring one back early: 2.

**Not part of it.** No reading of mail to detect an answer, no reminder, no escalation wording, no waiting state for invoices or lists.
