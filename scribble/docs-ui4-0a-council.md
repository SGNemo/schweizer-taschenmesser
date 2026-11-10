# docs/ui4-0a-council – for the next chat (0a follow-ups, every 0b package)

- **Verdict 2026-11-10:** council acceptance of package 0a = No-Go for 0b. Findings with outcome: `docs/design/ui-audit-2026-11/LEDGER.md` "Abnahme 0a". Nothing was fixed in that PR.
- **`develop` is red** since #634: `web/e2e/accounts.spec.ts:127` clicks the sidebar link "Bibliothek", which the `pixel-7` project (rest run only) does not have. Small test PR, file is not protected.
- **A PR with two or more new specs under `web/e2e/seed/` gets false `protected` hits** (`web/scripts/ratchet.mjs:876–887`, `specNames ??=`). Until that is fixed: name them in the PR text as false hits, do not rename files to dodge it.
- **Guards that will not see a 0b change at their own spot** (fix before the named package): `one-primary.seed` and `motion.seed` have no positive control (0b-1 / 0b-2), `pageTitle.test.tsx` does not identify the title slot (0b-2), `grouped-list` counts only `<ul>/<ol>` in `routes/` (4 real hits in `calendar/components/`, `ItemList` unseen), no CSS guard for `transition` (one hit: `accounts.module.css:32`), a11y `KNOWN` for `/calendar` hides phone hits (0b-4).
- **Merge rule:** #634 was merged while its `Web` check was red and without a signed comment; rule 7 is not live until `nemo-merge` is recreated. Do not assume the gate catches you.
