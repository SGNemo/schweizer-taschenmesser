# Time tracking ↔ plan – concept

Index and seed figures: [README.md](README.md). Packages: TT1, TT2 in [PACKAGES.md](PACKAGES.md).

## What the planner needs from it

Estimates are guesses; only 4 of 55 seeded ToDos have one, and the plan falls back to 30 min for the rest. Real minutes would make the plan honest over time – but only as a **hint**: no value changes by itself, nothing compares the user against the estimate. Today time tracking knows nothing about the plan: 58 seeded sessions carry free text at most (`from`, `note`); `timetrack.start.requested { title, sourceRef? }` exists (calendar: „Zeit erfassen“), but `sourceRef` is dropped. Wochenende W14 („Arbeitszeit eintragen“ does not lead to time tracking, module off) stays „not now“ for auto-enabling: modules are switched only by the person.

## Smallest useful step (TT1)

„Zeit erfassen“ in the ⋯ menu of a plan row and as a quiet secondary action on the planner's focus screen – **only while time tracking is on** (no hint to switch it on). It emits `timetrack.start.requested { title, sourceRef: '<module>:<id>' }` (the source thing's key, not the session unit, so all parts of a thing add up); time tracking starts a session „Ohne Projekt“ with the title as note and stores `ref` (internal, never shown, never in the data API, like finance's `sourceRef`). A session that is still running is stopped first – time tracking's existing one-click rule (`startSession` in `modules/timetrack/repo.ts`); the toast names the new one.

## Next step (TT2)

New lazy contribution `actuals?: () => Promise<{ default: ActualsSource }>` with `ActualsSource = (refs: string[]) => Promise<Record<string, number>>` (finished minutes per ref, breaks removed); time tracking delivers it. The planner shows „bisher 50 Min erfasst“ in a row's „Warum hier?“ detail and, in the estimate editor, a chip „50 Min übernehmen“ next to the existing steps – a tap is the only way it changes `estimateMin`. Never „50 von 30 Min“, never „über der Schätzung“, no colour.

## Data flow

Bus for the start (request into time tracking, nothing when it is off); contribution for the read (the bus has no reply). Timetrack: `sessionSchema.ref?` (`.meta({ internal: true })`) + `manifest.version` + migration. Contract hotspot `core/modules/types.ts` only in TT2. The schema comment „free text, never a link“ on `from` stays true: `ref` is a separate internal key.

## Focus checklist

1 Stimulus: TT1 one ⋯ entry + one secondary action on the focus screen; TT2 one detail line + one chip in an editor the user opened. · 2 Off: both appear only with time tracking on; TT2 hint behind planner setting `actualsHint` (default on once time tracking is on, off switch in the planner settings). · 3 Next step: „Anfangen“ stays the primary action of the focus screen. · 4 Calm: wording above, no comparison. · 5 Interruption: the session lives in time tracking (survives reload). · 6 Tests: bus → session with `ref`; action hidden with the module off; sums per ref; chip writes only on tap. · 7 Readability: text only. · 8 Clicks: plan row → running session 5 → 2 taps (⋯, „Zeit erfassen“) instead of switching module, „Neu“, typing the title. · 9 Removed: TT1 makes retyping the plan title into time tracking redundant; TT2 replaces guessing in the estimate editor.

## Stimulus and dependencies

TT1 touches `modules/planner/**` (row ⋯, focus screen) – after the last Wochenende package on the board (6). TT2 after TT1 and after H1 (hotspot). W14 auto-enable: not in any package.

## Not now

Auto-start or auto-stop, a timer on every row, invoices from plan sessions, AI-side time entries (decision 2026-11-03), learning that changes estimates by itself.
