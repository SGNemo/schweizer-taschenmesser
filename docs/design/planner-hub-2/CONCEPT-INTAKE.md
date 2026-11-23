# Planner hub 2 – concept: what comes in and how it is cut (ideas 1, 3, 6, 9, 11)

Frame and link contract: [CONCEPT](CONCEPT.md). Rows: [CONCEPT-ROWS](CONCEPT-ROWS.md). Words: [COPY](COPY.md).

## Idea 1 – share → planner

**Exists.** Android `ACTION_SEND` for `text/plain` (≤ 20 000 characters), PWA `share_target`, both land on `/share` with the quick-capture form (`pages/ShareTarget.tsx`); targets bookmarks, notes, ToDos, lists, feeds. Nothing is stored before his tap (LAUNCH-REVIEW-2026-11 B9: „only pre-fill“).

**Behaviour.** (1) Share from any app → Nemo opens `/share`. (2) With the planner on, the first and preselected target is **„In den Planer“**; the card shows what will be stored: title (first line, ≤ 160), „ohne Tag“, and for a link the host as text. (3) One tap „Ablegen“ → a ToDo through `plan.requested` (`day: null`, `origin: 'share'`; both from 10a); the planner's handler says the toast „Liegt im Planer unter „Noch ohne Tag“. · Ansehen · Rückgängig“; the page shows „Abgelegt.“ with „Rückgängig“ and „Fertig“ and stays until he taps („Fertig“: Android closes back to the app he came from, the PWA opens the planner). (4) The row carries the way back: a link's URL sits in the ToDo's `url`-less note as the first line and shows as the chip „Im Browser öffnen“ (opens only on a tap, http/https only, host shown); text keeps its remaining lines as the ToDo's note (≤ 4 000, the rest cut, said on the card: „Gekürzt auf 4 000 Zeichen.“). (5) Day chips „Heute“ / „Morgen“ on the card are optional; default is „ohne Tag“.

**Against LAUNCH-REVIEW-2026-11.** New surface: none in the manifest (same intent filter, same exported activity – NS4's merged-manifest check keeps passing). B9 stays true: pre-fill only. Q3: the URL is scheme-checked before it becomes a chip. Never fetched: no title lookup, no preview image, no favicon. A title made from a URL is percent-decoded first and then stripped of control and bidi characters. The text is rendered as text (no HTML, no Markdown, no auto-link in the card). The share page never offers `accounts`. While the app lock or the vault lock is active nothing changes (the planner is not behind it). MOD1: the target is offered only when the planner module is on; the native side still only hands text over.

**Struck part: pictures.** `image/*` would need a new exported filter, content-URI reads, a size and type gate (magic bytes, ≤ 10 MiB) and a place to keep the file – notes have no attachments, Unterlagen's titles must not show in the plan. It lowers no figure the text path does not already lower, and it is the one truly new entry surface. Not built; „Im Nachhinein klären“ in the PR.

**States.** planner off (target missing, page as today) · empty share (page says „Nichts angekommen.“, as today) · too long (cut, said) · stored · write failed (card stays, „Nicht gespeichert. Noch einmal?“).

**Target (script, D2).** Shared link ends as a planner row: handles 5 → 2, module switches 2 / 3 → 1 (the planner itself), way back to the URL nein → ja.

**Not part of it.** No way back into the source *app* (Android hands no dependable sender; a guessed package name would be a lie), no share *out* of the planner, no background receive.

## Idea 3 – unload with kind recognition

**Exists.** The quick-capture parser knows 15 kinds incl. invoice (amount, „Rechnung“, „Mahnung“), list, event, note, bookmark (`core/quickCapture/parser`); the planner's field ignores it and always makes a ToDo.

**Behaviour.** (1) While he types, the field asks the same local parser. Only a **sure** reading (rules below) shows one line under the field: „Wird: Rechnung · Stadtwerke · 80,00 € · Frist Fr 4. Dez.“ and the button „Als Aufgabe eintragen“. (2) Enter stores what the line says, through the capture target of that kind, and – for kinds that are plan things – asks it into the plan „ohne Tag“, all in one undoable action: the planner's field calls the planner's own place function inside that action (not the bus, which swallows a failure) and takes the created thing back when placing fails. A thing whose plan row exists already is left as it is – typing „Milch“ never lifts a „Nicht planen“ on the shopping list. (3) „Als Aufgabe eintragen“ (or Alt+Enter) stores the plain ToDo; the line is gone for this entry. (4) The toast names it again: „Rechnung angelegt, liegt unter „Noch ohne Tag“. · Rückgängig“. (5) No line → exactly today's behaviour.

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

**Target (script).** A1: `rightKind` 4 → 12 of 12 with the field alone, rows afterwards 11 → 7; A2 (the capture detour: 33 handles, 3 / 5 switches, 2 forms) is no longer needed.

**Not part of it.** No new model call and no network (the existing local stage on the desktop stays as it is and never produces a preview line), no kind picker, no second field, no recognition inside „Plan einfügen“.

## Idea 6 – errand round (shrunk to what the script rewards; places and map struck)

**What is built, inside package 5b – no package of its own.** A „Besorgungsrunde“ is a bundle whose members are the errands and the shopping list: one row („Besorgungen · 3 Dinge“), and the list member shows its open items as tick lines right in the bundle's panel, so the round is worked through without leaving the planner. „Los“ walks the members; the list is one step with its tick lines.

**Struck parts** ([ANALYSIS §4](ANALYSIS.md)): a place per stop, the `place` relation, maps as a link target, „Auf der Karte ansehen“, a map inside the planner, the word „Stopps“. None lowers a figure the bundle and the lists panel do not already lower (`mapShown` stays „nicht möglich“ in the script). The drawn version is kept in `handoff/06-errand.md` and `mockups/06-errand.html` for a later „ja“.

**Target (script).** C2: rows 2 → 1 (and the list is in the plan at all), module switches 2 → 0, working handles 9 / 8 → 6; bundling costs 6 handles once – the one figure that rises, by his choice.

## Idea 9 – before and after an appointment

**Behaviour.** (1) An appointment is a recessed blocker row on its day. Expanded (idea 4, calendar's panel): time, place, and two quiet buttons „Vorbereiten …“ and „Danach …“. (2) A tap puts the cursor into the planner's field with a lead chip „vor Friseur, Mi“ (✕ removes it); what he enters becomes a ToDo on the appointment's day (before: the day itself, or the day before when he taps the chip's second choice „am Tag davor“), linked `before` / `after` to the appointment. (3) The row shows the chip „vor Friseur“ and sorts before / after the blocker inside its day part. (4) The calendar's „Vorbereitung“ block lists it (reverse links, exists). The panel's tick lines are ToDos: calendar reads them through `linkEntries` and ticks through the bus (`todo.doneRequested` inside `undoable`), never by importing ToDos.

**Contract.** Rels `before`, `after`; `plan.requested.links`; calendar `planPanel`. No time is given to the thing: the planner stays a day planner (`decisions/plan.md`).

**Target (script, D3).** A prepared thing linked to its appointment: module switches 4 → 0, handles 14 → 3.

**Not part of it.** No automatic „Vorbereiten“ row, no travel time, no templates per kind of appointment, nothing for all-day events.

## Idea 11 – topic as a bracket

**Why a topic and not a tag.** Tags exist in four modules as loose strings; notebooks, lists and categories in others; Rechnungen, E-Mail and Kalender have none. A cross-module tag would mean a new field in every module. A topic is instead **one planner row with links**: `planner_topic` (a title) and one `topic` link per member in the store that already syncs, reads both ways and survives deletion. No module gets a field; no module needs to know topics exist. It is shown nowhere until he makes one. ToDo tags, lists and notebooks stay what they are; a tag is offered once as a topic („Tag „umzug“ als Thema übernehmen“ in the topic chooser) and never synced back.

**Behaviour.** (1) Row ⋯ or the selection bar: „Thema …“ → choose one or type a new name. (2) Page ⋯: „Nur ein Thema zeigen …“ → the sheet, the band's bars and „Noch ohne Tag“ show only that topic's things; the page head says „Thema: Umzug · 7 Dinge · Alles zeigen“ in place of its figure. (3) Things that are no plan rows but carry the topic (a note, an appointment, a document) stand in a folded line „Auch im Thema · 3“ under the sheet, each a link. (4) The filter is device state (not synced, survives a reload, ends with „Alles zeigen“). (5) Deleting a topic removes its links in the same undo; no thing is touched. (6) One topic per thing: „Thema …“ on a thing that has one replaces it in that same action – the only place stale topic links are ever removed.

**States.** no topic exists (no entry in the page's ⋯ beyond „Thema …“ on rows) · filter on · filter on and empty („In diesem Thema liegt gerade nichts im Plan.“) · topic gone on another device (filter ends, toast-free).

**Target (script, D4).** Rows while working on one topic of 7 among 20 things: 20 → 7; handles to give five things the topic and switch the filter on: 27 / 22 → 11; module switches 2 → 0.

**Not part of it.** No topic page outside the planner, no colours per topic, no topic in the capture syntax, no nesting, no topic on `accounts`.
