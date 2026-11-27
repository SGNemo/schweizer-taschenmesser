# Living scenes – packages (order, what runs side by side, common block, "as built")

Prompts: [PACKAGES-PROMPTS](PACKAGES-PROMPTS.md). Each package is one branch and one PR with a stop after it.

## Order

| # | Package | Branch | Needs | Hotspots |
| --- | --- | --- | --- | --- |
| 1 | Kit, setting "Bilder", budgets – the weather looks the same | `feat/scene-kit` | – | `core/modules/types.ts`, `ui/tokens.css`, `pages/Settings.tsx`, `strings.ts` |
| 2 | Overview: day tone, cap rule, slots | `feat/home-pictures` | 1 | `ui/tokens.css`, `home/Home.module.css`, stimulus budget |
| 3 | Gewohnheiten: the garden | `feat/habits-garden` | 1, 2 | `ui/tokens.css` (scene tokens) |
| 4 | Uhr: a sky per place | `feat/clock-sky` | 1, 2 | `strings.ts` (clock block) |
| 5 | ToDos: the lake | `feat/todos-lake` | 1, 2 | `ui/tokens.css`, `strings.ts` (todos block) |
| 6 | Signs A: Wochenlast, Budgets, Downloads | `feat/signs-blocks` | 1, 2 | planner's "Wochenlast" widget (ask planner hub 2 first) |
| 7 | Signs B: Zeiterfassung, Vorräte, Routinen, Einkauf, Personen, Fitness, Kalender | `feat/signs-new` | 1, 2 | – |
| 8 | Planer: the way | `feat/planner-way` | 1, 2 and **planner hub 2 finished** | planner files |
| 9 | Close the round: rules into MODULE-IDENTITY, decisions bullet, delete working documents | `docs/living-scenes-close` | all | `docs/design/MODULE-IDENTITY.md` |

**Side by side:** 1 alone, then 2 alone (both touch tokens and the card frame). After 2: **3, 4, 5, 6 and 7 may run at the same time** – they touch different modules; the fence: each adds only its own block of `--scene-*` tokens at the end of the scene token list (announce the hotspot, merge `develop` before the PR as usual), its own block in `strings.ts`, its own files in `ui/scene/spots/` or `ui/scene/signs/`; nobody edits `CardPicture`, `pictureKinds` or another module's `picture.ts` – a wish for the kit goes to the notes repo and into a small follow-up of package 1's owner. 3 and 5 both add a fallback sign: separate files. 8 waits for planner hub 2 and may then run beside anything. 9 last.

## common

Applies to every package prompt (the prompts cite this anchor).

- **Model and mode:** Claude Opus, unattended: no questions, no stop. Decisions go into the PR under „Für dich entschieden“, open points under „Noch offen“.
- **Read first:** "as built" below; where your prompt differs, the built state wins, and you add your own paragraph (same PR, ≤ 6 lines: what was built differently and why, names of files and functions the next package needs). Lies zuerst „as built“ der Vorgänger und trage deinen Absatz nach.
- **Sources of truth:** [handoff/00-common](handoff/00-common.md), then your handoff and module page. Words from [COPY](COPY.md) are taken literally, German and English. The drawing is `mockups/world.js` (+ `signs.js`): **port it shape by shape, do not redesign**; when the mockup and a text differ, the mockup wins and you say so.
- **The rules** of [RULES-DRAFT](RULES-DRAFT.md) hold in every package; "never" is tested, not promised.
- **Privacy:** no new network destination; `privacy.test.ts`, `exclusion.test.ts` (accounts: no `picture`) stay green; a spot's vars carry no string.
- **Stimulus and guards:** `npm run check:stimulus`. Released by the maintainer on 2026-11-27: the day tone at 12 % may raise "coloured above the fold" on the overview (package 2). Every hit is listed under „Ratchet hits“ in the PR and waits for the maintainer's label; you never set `stimulus-raise`. Ratchet-protected files: keep the checks, append new ones.
- **Start and neighbours:** `npm run chats:status`; announce the hotspots of your row in the notes repo before the first commit.
- **Done:** `npm run check`, `test`, `e2e` green; `check:i18n`; "Every package proves" of handoff/00-common answered point by point in the PR („Abnahme“); FOCUS checklist 1–9 answered – "what goes instead": the grey mark of the card (signs, scenes), the two-word day part (clock); "which situation": a glance at the overview should say how the day stands before reading.
- **Docs:** `.changes/` note (user's view, German and English); one bullet in `docs/decisions/ui-shell.md` (or the module's area file); pictures only in the PR text (1920 and 412, light and dark, beside the mockups); move the line „Lebendige Bilder“ in [CHATS](../../CHATS.md) on to the next package; STATUS one line in its own `docs(status)` PR.
- **Skills:** `design:accessibility-review` against [A11Y](A11Y.md), `design:design-critique` of your screens against the mockups, `review loop` (package 1: `council`, because of the manifest contract); then `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop. Never merge.

## as built

(Each package adds its paragraph here.)
