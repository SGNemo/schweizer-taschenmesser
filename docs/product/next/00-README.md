# Next tasks – six parallel chats (2026-10-29, refreshed 2026-10-31)

**Refresh 2026-10-31:** none of the six had started; the QA round (#271–#333) overtook parts of three prompts, which are updated: **T1** moves out of the first-run quick mode (#276: 3 questions, 5 taps stay) into the full wizard + dashboard checklist; **T4** keeps only what #275 left (area row, Erweitert placement, collapsing top bar, seed banner); **T5 package 2** sits in front of the parser rebuilt by #274. T2, T3 and T6 got the new facts (currency per account, new candidates for the preview list and for lazy loading). All six can start now.

Result of the planning round in this folder: [00-known-open.md](00-known-open.md) (what was already open), [01-ideas.md](01-ideas.md) (46 ideas, top 10), [02-selection.md](02-selection.md) (cut, files, hotspots, risks; addendum 2026-10-29 for what `develop` overtook). One prompt per chat in [prompts/](prompts/), German, same shape as [../focus/15-parallel-prompts-4.md](../focus/15-parallel-prompts-4.md): paste the **common header** from [prompts/00-header.md](prompts/00-header.md) first, then the chat's block. All chats work without questions, except T3 (one stop).

## The six chats

| # | Chat | Branch(es) | Model | Hotspots owned | Start | Merge order |
|---|---|---|---|---|---|---|
| T1 | [Umzugsassistent](prompts/01-umzugsassistent.md) – move-in step in the full wizard + checklist row, Settings entry | `feat/migrate-assistant` | opusplan | – | now | 3 |
| T2 | [Bank import](prompts/02-bank-import.md) – OFX/QIF, bank CSV presets, remembered column mapping; package 2: money rules | `feat/import-bank-presets`, then `feat/finance-rules` | opusplan | – | now | 2 |
| T3 | [Reifegrad / "In Arbeit anzeigen"](prompts/03-maturity-switch.md) | `feat/maturity-switch` | **Fable, one stop** | `core/modules/types.ts`, `registry.ts`, `available.ts`; `core/tools/*`; `core/settings/registry/types.ts`; `pages/settings/inventory.*` | now | 6 (last) |
| T4 | [Mobile header](prompts/04-mobile-header.md) – area row, Erweitert placement, collapsing top bar | `fix/mobile-header` | opusplan | – (`core/shell/pageChrome.ts` one additive field) | now | 1 (first) |
| T5 | [Capture & presence](prompts/05-capture-presence.md) – 3 packages: Android shortcuts + tile · multi-line capture · tray "Mini-Heute" | `feat/capture-presence-1`, `-2`, `-3` | Opus | `src-tauri/src/capture.rs`, `lib.rs`, `build.rs`, `capabilities/*`; `quickCapture/**`; `plugins/share-intent/android/**`; `core/platform/types.ts` (additive) | now | 4 (per package) |
| T6 | [Cold start & bundle](prompts/06-cold-start.md) | `perf/cold-start` | Opus | `vite.config.ts`, `sw.ts`, `index.html`, `router.tsx`, `package.json` scripts | now | 5 |

Mix: 1 cleanup/comfort (T3) · 1 visual (T4) · 3 function (T1, T2, T5) · 1 technical (T6). Dropped from the top 10: 11 home-screen widget (after T5-1, hardware only), 28 money rules (= T2 package 2).

## Order
- **Start:** all six at once. T5 runs its packages one after the other (each its own branch and PR).
- **Merge:** T4 → T2 → T1 → T5 (each package as it lands) → T6 → T3 last. Whoever merges later brings `develop` in with a merge (no rebase), keeps both sides in `docs/STATUS.md`, `CHATS.md`, `scribble/BOARD.md`.
- **Why T3 last:** it owns the manifest contract and the settings registry; everything else must be in before the maturity field becomes mandatory (`check:modules`).
- **Why T4 first:** CSS only, measurable, and T5-2/T5-3 and T1 render inside the header it changes.

## Shared files (every chat, own block only)
`web/src/strings.ts` + `i18n/locales/{en,es,fr,pt-BR}/*` (T1 `setup`/`onboarding`, T2 `finance`, T3 `settings`, T4 none, T5 `quickCapture`, T6 none) · `docs/STATUS.md` (one line each; 5000-token budget, change a line rather than append) · `docs/CHATS.md` (own row) · `docs/decisions/<area>.md` (one bullet) · `scribble/BOARD.md` (heads-up before the first code commit) · `pages/settings/inventory.core.json` + `inventory.test.ts`: every chat may add **one additive row** for its own new persisted key (T1 `_meta` migrate state, T2 remembered mappings only if not in `_meta`, T5-3 tray toggle); T3 owns the files and resolves the snapshot when it merges last.

## Before you start (maintainer)
- Merge or close the QA persona reports #262–#270 first if you want their findings in; they are docs only and do not block.
- T5-1 (Android shortcuts/tile) and T5-3 (tray) can only be checked on hardware: plan one APK and one Windows hand test ([../../MANUAL-TESTS.md](../../MANUAL-TESTS.md) gets the rows).
- T3 stops once with a proposed `preview` list; answer it in the chat (tick per candidate). Until then everything stays `stable`.
- T2 package 2 (money rules) starts only after you merged package 1.
- No accounts, keys or decisions are needed up front. The dependency rule from round 5 applies: a chat that needs a new npm or Cargo dependency stops and tells you instead of adding it.

## After this round
Ideas not chosen, with a verdict, are in [../../ROADMAP.md](../../ROADMAP.md) → "Not chosen 2026-10". Candidates for the round after: 11 widget, 38 test speed, 21/22 empty states and transitions, 41 robust backup, 44 small security leftovers.
