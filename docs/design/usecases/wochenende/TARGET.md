# Use case „Wochenende retten“ – target picture (phase 2)

Branch `design/usecase-wochenende`, 2026-11-14. Analysis and friction ids: [ANALYSIS.md](ANALYSIS.md) (W01–W22). Rules: root `CLAUDE.md`, [FOCUS-GUIDELINES](../../FOCUS-GUIDELINES.md), [FOCUS-WORDING](../../FOCUS-WORDING.md), [MODULE-IDENTITY](../../MODULE-IDENTITY.md), [DESIGN-SPEC §4a](../../DESIGN-SPEC.md), planner [CONCEPT](../../plan/CONCEPT.md) (§3 engine, §4 `plannable`, §6c instructions, §10 decisions), [DATA-FLOWS](../../../legal/DATA-FLOWS.md). Nothing here is code.

## 0. In one paragraph

The pieces exist – batch capture, the planner with its field, mail actions, time tracking, reminders – but a first-time person on a Saturday morning meets them in the wrong order: the setup never offers the planner, Sunday has no time, the break is planned like a chore, the deadline loses its day or its time, and in the evening „Neu verteilen“ keeps everything on today. The target adds **one entry „Tage einteilen“** that runs the existing pieces in the person's order (dump → time per day → preview → take), and five small, general extensions to the planner: **day parts and a break block**, **„Rest verteilen“** for the evening, **a deadline time** with one calm reminder, a **„beantwortet?“** back-channel for mail replies, and a **„Tagesende“** the plan never crosses. Nothing reads, counts or rates leisure, sleep or health; the app keeps only what the person types.

## 1. The shortest honest path with what exists today

A person who knew the app could do the morning with existing features only. Figures from the script's counting model; „knows“ = the person has to know a sentence or a word the app does not offer.

| Step | Way with existing features                                                                                           | Taps | Keys  | Screens | Dialogs | Detours | ≈ s | What is missing is only …                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ------- | ------- | ------- | --- | ----------------------------------------------------------------------------------------------- |
| a    | „Später“ on the welcome card → library → Planer on → Planer (skip the setup)                                         | 4    | 0     | 3       | 0       | 0       | 10  | **findability**: no way from the welcome card to „einteilen“ (W01)                              |
| b    | the dump, but „Team-Sachen lesen Frist So“, „Mo 7:30 erinnere mich: krankmelden“, no „Zocken“ line (knows)           | 2    | ≈ 285 | 0       | 1       | 0       | 76  | **wording/defaults** of the parser (W04, W06); the break has no type (W05)                      |
| c    | planner field: „Sa 6 Std“, „So 4 Std“, „Sa 14 bis 16 Uhr Zocken“, „alles neu mischen“ (knows), one „Übernehmen“ each | 4    | ≈ 60  | 0       | 4       | 0       | 31  | **findability** of the sentences (W08, W09); the 3-item limit (W11); order cannot be said (W12) |
| d    | as measured                                                                                                          | 6    | 20    | 2       | 1       | 0       | 18  | –                                                                                               |
| e    | as measured, after connecting (E0 stays a blocker, W15)                                                              | 4    | 9     | 1       | 0       | 0       | 8   | the back-channel (W17)                                                                          |
| f    | planner field „alles von heute auf morgen“ (knows) → „Übernehmen“                                                    | 1    | 27    | 0       | 1       | 0       | 11  | **findability** and the **default**: „Neu verteilen“ keeps today (W18, W19)                     |
| g    | „Team-Sachen lesen bis So“ without a time; Monday as a reminder line (knows)                                         | 1    | ≈ 70  | 0       | 1       | 0       | 22  | the time of a deadline (W20, W21)                                                               |
| h    | habit „Ins Bett 23:30“ with a time reminder (habits on, streaks stay off)                                            | ≈ 6  | ≈ 15  | 2       | 1       | 0       | 20  | the plan does not know the bedtime (W22)                                                        |

**Result:** about 28 taps and 4 sentences to know instead of 56 taps and 7 detours – so half of the friction is **findability, order and defaults**, not missing features. That decides the size of F1 (an entry that offers the sentences as taps) and keeps F2–F6 small.

## 2. New functions

Each: problem → idea → for all users → form → focus checklist 1–9 → rule conflicts → smallest first step → effort; three sizes with a recommendation.

### F1 „Tage einteilen“ – the first morning without knowing modules (W01, W02, W03, W08, W09, W10, W13)

- **Problem:** the setup ends on the overview without the planner; time per day is 16 taps away; Sunday is „frei“; the empty head contradicts itself.
- **Idea:** one sheet with three steps, built only from existing parts: (1) **„Was steht an?“** – the batch field of the quick capture (one line = one thing); (2) **„Wie viel Zeit hast du?“** – the next three days as rows with chips „frei · 2 h · 4 h · 6 h · ganzer Tag“ (writes planner day rows, never the weekday defaults); (3) **Vorschau** – the planner preview („Neu im Plan“, per day) → „Übernehmen“ / „Zurück“. Undo toast „Eingeplant: Sa, So, Mo · Rückgängig“.
- **Reached from:** the welcome card (second button „Tage einteilen“ beside „Einrichtung starten“), the planner's empty state (replaces „Noch nichts geplant. Eine Sache reicht.“ as its one action), the planner ⋯. Switches on `planner` (+ `todos` via `requires`), never switches anything off (W02).
- **For all users:** a weekday person gets the same sheet (three days from today); nothing is weekend-specific; the setup questions stay as they are.
- **Form:** planner module UI (`modules/planner/components/DaySetup.tsx`), uses `saveCaptures` (quick-capture targets) and `setAvailable` + the preview of `actions.ts`; the welcome card gets a second action through a planner contribution (`contributions.onboarding` already exists – add an optional `firstStep` entry, additive) – or, smaller, a link to `/planner?start=1`.
- **Focus 1–9:** (1) one sheet, three steps, one primary button per step; replaces the 16 stepper taps; (2) the entry is a button, never opens by itself; (3) each step names one next action; (4) „Drei Dinge reichen für heute.“ stays the voice, no counters; (5) a closed sheet keeps the dump as a draft (capture draft exists); (6) unit: chips → minutes; e2e: path A/B/C of the script; (7) chips with text, no colour meaning; (8) 3 taps for three days; (9) **removes**: the stepper as the first way (stays for fine steps), the contradicting empty head (W13).
- **Rule conflicts:** none; welcome-card change touches `layout/setup/WelcomeCard.tsx` (small, announce: core setup is a privacy area – no data in setup progress, nothing stored besides the existing state).
- **Smallest first step:** empty state and welcome-card link to `/planner` with the planner switched on; chips in the day sheet (W08/W09); head sentence (W13).
- **Effort:** minimal S (link + chips + head) · **mittel M (the three-step sheet) – recommended** · groß L (a daily „Morgen“-routine with the sheet every morning – no: a nag risk, FOCUS 2).

### F2 Day parts and the break block (W05, W11, W12)

- **Problem:** „erst Pflicht, nach der Pause Haushalt“ cannot be said; „Zocken“ is planned like a chore; small chores fall out by the 3-item limit.
- **Idea:** an optional **Tagesabschnitt** per plan item – „Vormittag · Nachmittag · Abend“ (row ⋯ and chips in F1 step 3; field: „Duschen nachmittags“, „Bude abends“). The engine orders inside a day by part first (then today's rules), and with a window it splits the window into three equal parts and times units inside their part. A **break** is a blocker with an optional part or time („Pause · Nachmittag · 2 h“, field „Sa 14 bis 16 Uhr Zocken“ exists); the quick capture reads „Pause …“/„Freizeit …“ as a blocker line (only these two words; „Zocken“ alone stays a ToDo unless it is written „Zocken 14–16“ in the planner field). A break is never counted, totalled, rated or shown in a widget; it only takes time away like any blocker. Chores: the estimate chip „kurz (≤ 15 Min)“ makes a unit a small thing (not a main item), so Duschen/Pfand fill the free minutes.
- **For all users:** parts are optional; without them nothing changes (ordering falls back to today's rules); the weekday person uses „Vormittag“ for deep work.
- **Form:** contract extension, **additive**: `PlannableItem.part?: 'morning' | 'afternoon' | 'evening'` and planner item row field `part?` (planner's own table, `manifest.version` + migration), engine rule 5 tier „part“ (deterministic: part before priority only inside a day; days are still chosen by today's rules), `PlanBlocker.part?`. Windows: `windows.ts` splits by part.
- **Focus 1–9:** (1) one optional chip per row, hidden behind ⋯ on the row (stimulus unchanged on the board); (2) off = no part set; no new setting; (3) unchanged; (4) „Pause“ never with a figure; (5) stored; (6) engine fixtures + fixpoint for parts; (7) part as text, no colour; (8) one tap via ⋯; (9) removes the need for a window just to order a day.
- **Rule conflicts:** contract change (`core/modules/types.ts` hotspot, one chat at a time); LWW unaffected (new optional field, field-wise sync); planner has no `aiSchema` – stays so.
- **Smallest first step:** „kurz“ estimate chip (W11) and quick capture „Pause/Freizeit“ → blocker – no contract change.
- **Effort:** minimal S (kurz chip + Pause line) · **mittel M (parts in the contract and engine, break block with part) – recommended** · groß L (time-of-day scheduling with drag – no: the planner stays a day planner, CONCEPT §0).

### F3 „Rest verteilen“ in the evening (W18, W19)

- **Problem:** at 21:00 „Neu verteilen“ keeps today's things on today; the person moves each one with two taps.
- **Idea:** a run **„Rest verteilen“** = every open unit planned for today gets `earliest = tomorrow` (exactly what „Später“ does per row) and one planner run; shown as the existing preview („Verschoben · Sa → So …“) → „Übernehmen“, undo toast „Auf die nächsten Tage verteilt. · Rückgängig“ (FOCUS-WORDING „Replan“). Reached from: the planner head as a quiet text link from 17:00 (same pattern as „Woche prüfen“), the „Wochenlast“ widget (one text action, from 17:00), and „Tag abschließen“ on the ToDo widget when the planner is on (it then runs this instead of „Auf morgen schieben“). An optional evening notification („Heute bleibt 3 offen. Verteilen?“) is **off by default**, `soft: true`, under „Ruhige Erinnerungen“, once per day at most.
- **For all users:** a weekday person gets the same; without the planner „Tag abschließen“ stays as it is.
- **Form:** planner action (`actions.ts` `restToTomorrow`) = op list `earliest` for today's units + `replan`; instruction parser additionally reads „Rest verteilen“/„Rest auf morgen“; widget action through the planner's own widget; ToDo widget calls it over the event bus (`plan.restRequested`), no module import.
- **Focus 1–9:** (1) one text link after 17:00 only; (2) evening link and notification switchable (focus `eveningWrapUp`, notification default off); (3) one action; (4) „Auf die nächsten Tage verteilt.“, no count of what was left („3 offen“ only in the optional notification); (5) one undo; (6) unit: op list; e2e: path F; (7) –; (8) 1–2 taps instead of 2 per thing; (9) removes the planner-less „Auf morgen schieben“ path while the planner is on.
- **Rule conflicts:** none; deterministic (ops are a pure function of today's units).
- **Smallest first step:** the op and the field sentence; the head link.
- **Effort:** minimal S (op + field + head link) · **mittel M (+ widget + „Tag abschließen“ + optional notification) – recommended** · groß L (automatic at a set time – no: the plan never moves things by itself at night, CONCEPT §1).

### F4 Deadlines with a time, Sunday evening, Monday morning (W04, W06, W20, W21)

- **Problem:** „bis So 18:00“ loses the day or the time; „Mo 7:30 krankmelden“ is an appointment that takes plan time.
- **Idea:** (a) **fix W20** (bug): a due phrase wins over the parser's date. (b) An optional **time on a hard due**: `due.time?: 'HH:mm'` in the planner item and `dueTime?` on the ToDo; the engine still plans by day (deterministic, unchanged), the row shows „Frist So 18:00“, and a deadline with a time offers **one** calm reminder („1 Std vorher“, default off, per deadline). (c) Parser: „bis/spätestens + day (+ time)“ makes a ToDo with a deadline (not an event); a line „Mo 7:30 <verb>“ without an appointment word (Termin, Treffen, Arzt, …) becomes a **reminder** at that time (reminders never block plan time). The title is exactly what the person typed („krankmelden falls nötig“); the app adds no word about health.
- **For all users:** every deadline can carry a time; nothing changes for deadlines without one.
- **Form:** contract extension, additive (`PlannableItem.due.time?`), todos schema (`dueTime`, `manifest.version` + migration), parser rule; reminder through the calendar's existing reminder kind (`kind: 'reminder'`), never a new notification kind.
- **Focus 1–9:** (1) a time only where typed; (2) the „1 Std vorher“ reminder is opt-in per deadline; (3) –; (4) „Frist So 18:00“, after it „Frist war So 18:00“ (glossary pattern), never red; (5) –; (6) parser corpus lines, migration test; (7) –; (8) 0 extra taps when typed; (9) removes the note line „Uhrzeit: 18:00“ for deadlines.
- **Rule conflicts:** formats: times `HH:mm` local (rule holds); data shape change → migration; health: no field, no category, no inference – the Guardian check in PACKAGES.
- **Smallest first step:** W20 bug + parser rule for „bis So 18:00“ (time kept in the note as today) + „Mo 7:30 <verb>“ → reminder.
- **Effort:** minimal S (bug + parser) · **mittel M (+ `due.time` and the opt-in reminder) – recommended** · groß L (deadline-aware hourly scheduling – no).

### F5 Reply things and the „beantwortet?“ back-channel (W17)

- **Problem:** „WhatsApp antworten“, „Mails beantworten“, „Team lesen“ are three vague things; a reply made from the mail row never learns it was answered.
- **Idea:** (a) **„Antworten an …“** as one ToDo with a checklist (exists): the capture line „Antworten: Anna, Vermieter, Team“ makes one ToDo „Antworten“ with three checklist items (only with the word „Antworten:“ and a colon). (b) **Back-channel, never automatic:** when the mail list is fetched (Gmail on, on click or refresh as today) and a thread that was put „In den Plan“ now has a last message sent by the person, its plan row shows „Beantwortet? · Erledigt“ – one tap closes it, nothing closes by itself. WhatsApp stays a plain thing (no connector, no link).
- **For all users:** checklist line works for anyone; the back-channel only with mail on.
- **Form:** quick-capture parser rule (a); mail module reads `SENT` label of the threads it already fetched (no new scope, `gmail.readonly` already covers it) and emits `plan.answered` on the bus; the planner row shows the hint; DATA-FLOWS row `google` gains „ob die letzte Nachricht von dir ist (Gerät)“.
- **Focus 1–9:** (1) one hint on one row; (2) mail setting „Beantwortet anzeigen“ (default on); (3) –; (4) „Beantwortet?“ (a question, no pressure); (5) –; (6) unit: heuristics; e2e: seed thread with a sent last message; (7) –; (8) 1 tap; (9) removes the manual search for which replies are done.
- **Rule conflicts:** privacy: only a flag on the device, no content; never sent to the AI (mail has no `aiSchema` for content).
- **Smallest first step:** (a) the checklist line.
- **Effort:** **minimal S (a) – recommended now** · mittel M (+ back-channel) – recommended as a second step · groß L (reply drafts from the plan – no, out of scope).

### F6 „Tagesende“ – a sleep window the plan respects (W22)

- **Problem:** nothing tells the plan „nichts nach 23 Uhr“; the window is no limit.
- **Idea:** two optional settings per weekday group (Mo–Fr, Sa, So): **„Tagesbeginn“** and **„Tagesende“** (asked in F1 step 2 as „Tagesende: 23:00 · 0:00 · keins“). With a Tagesende the window's end becomes a **limit**: a unit that would end after it gets no time and counts as not fitting that day (it moves to the next day like any overflow, reason „passt nicht vor dem Tagesende“). One optional, soft evening hint „In 30 Min ist Tagesende.“ (default off, „Ruhige Erinnerungen“, once a day, never repeated). Optional and separate: a habit „Ins Bett bis 23:30“ (habits exist; streaks stay off by default; no new code).
- **For all users:** a shift worker sets nothing or a late end; nothing is about sleep in the data – it is a plan limit.
- **Form:** planner settings (`windowWeekday` etc. gain an „end is a limit“ meaning when „Tagesende“ is set; one new boolean `windowEndIsLimit` or a separate field), engine/windows rule (deterministic), reason sentence in `explain.ts`.
- **Focus 1–9 (strict):** (1) no new element on the board; (2) both settings off by default, the hint off by default; (3) –; (4) no „zu spät“, „Schlafdefizit“, no counter, no score, no history of bedtimes; (5) –; (6) engine fixture „unit after Tagesende moves“; (7) –; (8) set once; (9) removes the need to type windows on the settings page.
- **Rule conflicts:** none; no sleep or health data (only two times the person chose for the plan).
- **Smallest first step:** „Tagesende“ as the end of the existing window + the limit rule.
- **Effort:** minimal S (end as limit) · **mittel M (+ Tagesbeginn, F1 question, soft hint) – recommended** · groß L (sleep tracking – never).

### Not proposed (and why)

- WhatsApp access or reading messages – no connector, and none is wanted (A3).
- Counting or limiting gaming time, a „weniger zocken“ goal, a leisure total – against FOCUS 4 and A5; the break block is enough.
- Any health field, symptom, „krank“ category or inference from titles – A4; the app keeps the typed title only.
- A shared Google OAuth client (W15) – an own decision (cost, Google verification, privacy text); named, not planned here.
- Auto-enabling time tracking from a „Arbeitszeit“ line (W14) – modules are switched only by the person.

## 3. Changes to existing modules and their side effects

| Change                                         | Module(s)                                | Counter-scenario 1: weekday with fixed office hours (9–17 as calendar events)                                                                                             | Counter-scenario 2: no mail module | Counter-scenario 3: planner off (ToDos only)                     |
| ---------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| F1 entry „Tage einteilen“, welcome card action | planner, setup (welcome card)            | works on any day; the office events already block time, the chips set the rest                                                                                            | unchanged                          | the entry switches the planner on – only on tap, never by itself |
| F2 parts, break, „kurz“                        | `core/plan`, planner, quickCapture       | „Vormittag“ for focus work before 9 is fine; parts never move a unit to another day                                                                                       | unchanged                          | parts are planner-only; ToDos show nothing new                   |
| F3 „Rest verteilen“                            | planner, todos widget (event bus)        | Friday evening moves to Monday as before (weekend days at 0 stay empty)                                                                                                   | unchanged                          | „Tag abschließen“ keeps „Auf morgen schieben“                    |
| F4 due time, parser rules, W20 fix             | todos, planner, quickCapture, calendar   | „Bericht bis Fr 12:00“ shows the time; an office meeting „Mo 9:30 Teamrunde“ stays an event (appointment word list must include „Teamrunde, Meeting, Call“ – corpus test) | unchanged                          | due time visible on the ToDo; no planner needed                  |
| F5 checklist line, back-channel                | quickCapture, mail, planner              | unchanged                                                                                                                                                                 | (a) works, (b) absent              | (b) shows the hint on the ToDo instead of the plan row           |
| F6 Tagesende                                   | planner settings, `core/plan/windows.ts` | Mo–Fr end 18:00 = nothing planned after work; the person who does not set it sees nothing                                                                                 | unchanged                          | none                                                             |

## 4. The target, measured

Expected figures with F1–F6 at the recommended sizes (same model; the script's `MAX` is lowered to these by the last package).

| Path                            | Now (PC)                           | Target (PC)                            | Now (phone)   | Target (phone) | Through                                   |
| ------------------------------- | ---------------------------------- | -------------------------------------- | ------------- | -------------- | ----------------------------------------- |
| A Erster Start bis Planer       | 10 · 0 · 3 · 1 · 1 · 24 s          | 1 · 0 · 1 · 1 · 0 · 6 s                | 11 · … · 25 s | 1 · … · 6 s    | F1 (welcome card „Tage einteilen“)        |
| B Kopf leeren (12 lines)        | 2 · 280 · 0 · 1 · 3 · 90 s         | 1 · 280 · 0 · 1 · 0 · 74 s             | … · 132 s     | … · 116 s      | F1 step 1, F4 parser, F2 „Pause“          |
| C Wochenende einteilen          | 23 · 9 · 1 · 2 · 0 · 33 s          | 4 · 0 · 0 · 1 · 0 · 7 s                | 23 · … · 35 s | 4 · … · 7 s    | F1 step 2–3 (chips Sa/So/Mo, preview), F2 |
| D Arbeitszeit nachtragen        | 6 · 20 · 2 · 1 · 0 · 18 s          | unchanged                              | –             | –              | (W14 named only)                          |
| E Mail (after connecting)       | 4 · 9 · 1 · 0 · 0 · 8 s            | unchanged + „Beantwortet?“ 1 tap       | –             | –              | F5                                        |
| F Abend: Rest auf andere Tage   | 9 · 0 · 1 · 1 · 1 · 19 s           | 2 · 0 · 0 · 1 · 0 · 5 s                | 9 · … · 19 s  | 2 · … · 5 s    | F3 (head link → „Übernehmen“)             |
| G Sonntag-Frist und Montag früh | 2 · 102 · 1 · 1 · 2 · 43 s         | 2 · 102 · 1 · 1 · 0 · 33 s             | –             | –              | F4                                        |
| H Schlaf                        | 3 · 10 · 2 · 0 · 1 · 15 s          | 1 · 0 · 0 · 0 · 0 · 1 s (in F1 step 2) | –             | –              | F6                                        |
| **Morning A–G (PC)**            | **56 · 420 · 9 · 7 · 7 · ≈ 235 s** | **≈ 16 · 400 · 3 · 5 · 0 · ≈ 140 s**   |               |                |                                           |

The difference that matters most is not the seconds but the **detours 7 → 0**: every line lands as meant, Sunday takes things, the evening empties today.

## 5. Fragen an Sven (Empfehlung zuerst) – answered 2026-11-14: Q1 a, Q2 a, Q3 a, Q4 a; decisions in [`docs/decisions/features-wochenende.md`](../../../decisions/features-wochenende.md), packages in [PACKAGES.md](PACKAGES.md)

1. **Einstieg „Tage einteilen“:** (a) **Blatt in drei Schritten, erreichbar über die Willkommenskarte und den leeren Planer** _(Empfehlung: ohne Modulwissen, baut nur Bestehendes zusammen)_ · (b) nur ein Profil „Tage einteilen“ in der Einrichtung · (c) nur Chips im Tagesblatt und ein besserer Kopfsatz.
2. **Reihenfolge am Tag:** (a) **Tagesabschnitte Vormittag/Nachmittag/Abend, optional je Ding, Pause als Blocker** _(Empfehlung: sagt „erst Pflicht, nach der Pause Haushalt“ ohne Uhrzeit, Planer bleibt Tagesplaner)_ · (b) nur Reihenfolge-Hinweise („zuerst“, „danach“) · (c) Uhrzeiten über Zeitfenster.
3. **Schlafrhythmus:** (a) **„Tagesende“ im Planer (Grenze des Zeitfensters), Gewohnheit „Ins Bett bis …“ nur als Hinweis auf Bestehendes** _(Empfehlung: der Plan respektiert es, keine Schlafdaten, kein Zählen)_ · (b) nur als Gewohnheit · (c) gar nicht.
4. **Wie laut Sonntag/Montag:** (a) **nur, was du selbst einträgst, einmal zur Uhrzeit, ohne Wiederholen; Fristen-Erinnerung „1 Std vorher“ nur auf Wunsch** _(Empfehlung: ruhig, nichts Automatisches am Wochenende)_ · (b) wie heute: eine selbst gesetzte Erinnerung wiederholt bis „Erledigt“ (30 Min, max. 6) · (c) nur die Karte in der App, keine Benachrichtigung.
