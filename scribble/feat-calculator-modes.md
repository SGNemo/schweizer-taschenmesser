# feat/calculator-modes – for the next chat (Persona tool and others)

for the next chat:
- `tools/shared.ts` has `useSaveAsNote()`: opens `/notes?new=1&title&text`, returns `undefined` while Notizen is off. Reuse it for "save persona as note".
- Calculator engine = mathjs in its own, not precached chunk (`ONLINE_ROOTS` in `scripts/lib/precacheSplit.ts`). Do not import `mathjs` anywhere else; use `core/calc/engine.ts`.
- Tools may not import each other: shared pure logic goes to `core/<topic>/` (see `core/calc/units.ts`, `dates.ts`).
- A new dependency needs `npm run gen:licenses` (a test checks the licence list).
- `check:docs` fails on `docs/qa/*/REPORT.md` budgets before this branch; not caused by it.
