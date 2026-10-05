# Decisions – shared components (Klar 2, Phase 3)

Index: [DECISIONS](../DECISIONS.md). Tokens/brand: [ui-brand.md](ui-brand.md). Shell/areas: [ui-shell.md](ui-shell.md).

- **APIs stayed compatible, looks changed globally.** Every module picks up borderless cards, flat rows and the new button/field look at once; per-module work (panels, quick capture, removing module-level copies of segmented/progress/chips/inputs, `quietDanger` for row deletes) is Phase 5.
- **`ItemList`/`ItemRow`:** list layout = one grouped surface with hairlines (`--row-h`, hover/selected radius, actions on hover/focus), grid layout keeps card tiles; the row is the single list pattern, with `selectable`/`done`/swipe and `data-row` hooks.
- **`danger` keeps its confirm-level look; `quietDanger` (red text) is new** so the 43 existing destructive buttons keep their weight until their module is restyled.
- **`EmptyState` has no `icon` prop** (faded fish only, per spec); call sites were changed mechanically.
- **Dialogs are bottom sheets below 900 px** (grab handle, swipe down, `88dvh`); `variant="sheet"` is gone, `size` is `default` 34 rem / `roomy` 40 rem (quick capture) / `wide` 56 rem (tools). `dirty` asks "Entwurf verwerfen?"; `useDraft` keeps a draft in memory for 30 s.
- **Undo is a journal in core, modules opt in** (`core/undo`, maintainer decision): `undoable(label, fn)` records the inverse of every `createRepo` write inside `fn` through a recorder hook in `core/db/recorder.ts` (create → tombstone, update → previous fields, remove/restore → the opposite); last 10 actions, memory only, no redo, no schema change. Not covered on purpose: writes after `fn` resolved (event-bus follow-ups such as the finance booking when an invoice is paid), imports, seeds, settings, sync. Adopters so far: ToDo done/open and delete.
- **Keyboard** (`core/keyboard`): one capture-phase `keydown` handler created once; `N`, `G` + `H/P/G/A/W/T` (1.2 s), `J/K`, `E`, Space, `/`, `?`, `Ctrl+Z`; never in text fields (`isTypingTarget`: text-like inputs, selects, textareas; checkboxes are not), with modifiers, or while a dialog is open; a consumed chord letter is swallowed so accounts' `P`/`T` do not fire.
- **Toasts:** 6 s each on their own timer, at most two, optional icon, action "Rückgängig".
- **Badge ink:** `--*-ink` tokens (status colour with 15 % body text) are the text colour on `--*-soft` backgrounds; plain status colours missed AA on the page background. Tested over page, card and chip.
- **Component sheet** `/dev/components` exists in dev server, Dev-Preview and E2E builds only (`layout/devTools.ts`, marker test in `core/seed/devFlag.test.ts`).
- **Visual polish round (2026-10-03):** causes were fixed in the base, not per module: home grid row units + row spans (cards stretch), one truncation rule (`--clamp-lines`), column flow for todos with subtasks, `PageHeader views` instead of a second tab row, search placeholder in `TextField`. **Fluid root size** 16 → 20 px between 1920 and 3440 px wide (replaces "type stays 16 px at ≥ 2200 px"); sidebar and rail widths are rem. Toasts stay bottom centre on every screen.

