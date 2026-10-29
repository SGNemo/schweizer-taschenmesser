# chore/stimulus-budget – for the next chat:
- `web/e2e/stimulus-budget.json` is the baseline measured on `develop` (2026-10-24). A focus package that folds/adds things: `cd web && npm run stimulus:baseline`, commit the JSON, name the numbers in the PR. CI job `Stimulus budget (warnings only)` is yellow-not-red by design.
- Measuring takes about 1 min (build + 36 views); the runner sets `STIMULUS_SHOTS=0`. `npm run check:stimulus` needs `npm ci` and a Chromium (`/opt/pw-browsers/chromium` is picked up by `playwright.stimulus.config.ts`).
- Tolerance: height +10 % or +50 px, counts +10 % (min +1). Two runs on the same build gave identical numbers.
- Open: the budget only tightens on re-baseline; a "ratchet down" mode was not built (would block parallel chats).
