# Decisions in full – Focus and attention aids (2026-10-02)

One-line summary: [DECISIONS](../DECISIONS.md) → UI section.

- **Opt-out per aid, sensible defaults:** every aid (next-one-thing, day plan, calm attention strip, focus mode, time-to-next) is a setting in the core section "Fokus & Aufmerksamkeit", synced scope `focus`; device-local state (focus timer, skipped suggestions) lives in `_meta`. Alternative rejected: a single "focus mode" master switch (too coarse, hides what each aid does).
- **No pressure by design:** overdue ToDos read "Wartet noch" with no daily counter; red stays for money deadlines and exceeded budgets; "Neu planen" spreads ToDos over the next days with undo. Streaks (package 4) get rest days and never show a loss.
- **Order of work:** package 1 "Anfangen" (next-one-thing, day plan, calm strip, focus mode, estimates), 2 "Erinnerungen", 3 "Erfassen/Ruhe/Wiederfinden", 4 "Fortschritt"; one PR each. Details, mockups and scope: [../features/focus-aids.md](../features/focus-aids.md); rules: [../design/FOCUS-GUIDELINES.md](../design/FOCUS-GUIDELINES.md).
- **Doc budgets raised** (start context 2 600 instead of 2 000, STATUS 5 000, CHATS and PROMPT-TEMPLATES 2 000): small rule additions no longer force cuts elsewhere; the target stays ≈ 2 000 (`docs/meta/DOCS-GUIDE.md`).
