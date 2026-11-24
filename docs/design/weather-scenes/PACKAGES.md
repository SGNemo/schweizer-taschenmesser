# Weather scenes – packages (order, shared block, "as built")

Prompts: [PACKAGES-PROMPTS](PACKAGES-PROMPTS.md). One package = one Opus chat, one branch, one PR against `develop`; paste one prompt per chat.

## Order

**1 → 2 → 3 → 4**, strictly one after another, each from fresh `develop` after the previous merge: all four touch `modules/weather/**`, `core/weather/**`, `ui/weather-scene/**` and the weather string bundles. The first to start is **1**. The proposed order of the brief is kept unchanged.

| # | Package | Branch | Scope (short) | Hotspots to announce | Review |
| --- | --- | --- | --- | --- | --- |
| 1 | Scene frame and the head | `feat/weather-scene` | `core/weather/scene.ts`, `ui/weather-scene/WeatherScene`, every weather by day, night and twilight, modifiers, stage 280 / ≤ 312 px, the hint in the head, the finds A1–A11, settings "Bild im Wetter-Kopf", raw code and `snow_depth` | `ui/tokens.css` (+ `tokens.test.ts`), `ui/HeadSurface.module.css` | `council` (design-system tokens) |
| 2 | Moon | `feat/weather-moon` | `core/sky/` (moon, sun, rise / set, phases, names), true phase and tilt in the scene, full moon and supermoon, chip, card "Mond & Himmel", moon at every forecast day, switch | – | `review-loop` |
| 3 | Sky events | `feat/weather-sky-events` | solar eclipses (local), lunar eclipses (table), meteor nights, solstices, rainbow weather, dust, star night; event chip and "Als Nächstes" | – | `review-loop` |
| 4 | Small versions and performance | `feat/weather-scene-small` | porthole in the overview line and widget, widget background (only with the maintainer's yes), `Sky` and `--sky-*` removed, performance pass, the round's working documents deleted | `ui/tokens.css`, `home/**` | `council` if the widget background is built (design rule changes), else `review-loop` |

## common

Applies to every package prompt of this round (the prompts cite this anchor instead of repeating it).

- **Model and mode:** Claude Opus, unattended: no questions, no stop. What you decide stands in the PR under „Für dich entschieden“, what stays unclear under „Noch offen“.
- **Read first:** in this file "as built" of every earlier package. Lies zuerst „as built“ der Vorgänger in PACKAGES.md; wo dein Prompt abweicht, gilt der gebaute Stand, und du trägst deinen eigenen „as built“-Absatz nach (same PR, ≤ 6 lines: what was built differently and why, names of files and functions the next package needs).
- **Sources of truth, in this order:** the built state → your prompt → the concept section it names → the hand-off → [COPY](COPY.md). Words from COPY are taken literally (German and English into the weather string bundles), never rewritten. The drawing is `mockups/scene.js` + `palette.js`: port it shape by shape; looks and measures are built as drawn, **not redesigned**. A real gap is closed the smallest way and named in the PR.
- **The eight sentences** of [CONCEPT §0](CONCEPT.md) hold in every package; their tests are extended, never loosened.
- **Privacy:** no new network destination; `privacy.test.ts`, the connection log tests and the `weather` row of `docs/legal/DATA-FLOWS.md` stay as they are. Position and time never leave the device for the moon or an event.
- **Stimulus and guards:** `npm run check:stimulus` unchanged or lower for `d1920--weather`, `p412--weather` and the home pages (exception: package 4's widget background, with the label `stimulus-raise`); stage ≤ 320 px; `check:bundle` inside its tolerance.
- **Start and neighbours:** `npm run chats:status`; announce the hotspots of your row in the notes repo before the first commit; protected e2e specs only grow by appended `test(` calls.
- **Done:** `npm run check`, `test`, `e2e` green; `check:i18n`; the acceptance list of your prompt answered point by point in the PR ("Abnahme": tests per weather → layers as a table, moon against the known data, contrast per scene, render ceiling, `prefers-reduced-motion`); FOCUS checklist 1–9 answered in the PR.
- **Docs:** `.changes/` note (German and English, from his view); one bullet per decision in `docs/decisions/weather.md`; `docs/features/weather.md` brought up to date for what you touched; STATUS one line in its own `docs(status)` PR; in [CHATS](../../CHATS.md) move the line „Wetter-Szenen“ on to the next package; pictures only in the PR text (1920 and 412, light and dark, the six situations of `mockups/07-kopf.html` with the invented place "Lindenau").
- **Skills:** `design:accessibility-review` against [A11Y](A11Y.md) and `design:design-critique` of your screens against the mockups; the review of your row (`review loop` or `council`); then `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop. Never merge.

## as built

(Each package adds its paragraph here, newest last.)

- **Design round (2026-11-24):** no product code. Measured on `develop` at b62c7a6. The music head never used `Sky` (the brief assumed it): nothing there changes. Mockup geometry and palette are final as committed with this round; the moon module's reference and its test vectors are in `reference/`.
