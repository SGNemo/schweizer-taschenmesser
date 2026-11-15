# Planner hub – packages (phase 3)

Decisions: [CONCEPT-LINKS.md](CONCEPT-LINKS.md) L1–L12, [CONCEPT-DESIGN.md](CONCEPT-DESIGN.md) D1–D11 – answered with the recommended options on 2026-11-15 (the maintainer: run through, build and merge, leave only what cannot go on without him under „Wartet auf Sven“). Friction ids: `ANALYSIS-*.md` (P01–P86). One package = one branch = one PR against `develop`; every package is built by a sub-chat of the orchestrating chat, reviewed (contract, engine, data: three lenses – Architect, Guardian, Advocate; everything else: one reviewer) and merged when CI is green and the `develop` version of `web/scripts/ratchet.mjs --pr <n>` exits 0.

## Order and parallelism

```
K1a ─┐                      ┌─ S1 Geld & Mail ─┐
     ├─ K1b ─ K2 ───────────┼─ S2 Fristen      ├─ S4 Training & Blöcke ─ M Nachmessen
R1 ──┤                      ├─ S3 Einkauf      │
F1 ──┴─ R2                  └─ S5 Kleinkram ───┘
```

- **Parallel now:** K1a (core types, resolvers, ToDo editor), R1 (planner page), F1 (engine fix). They share no file: K1a never touches `modules/planner/routes/**`, R1 never touches `core/modules/types.ts`.
- **After R1:** R2 (needs F1) and K1b (needs K1a) – both edit the new planner components, so one after the other: R2, then K1b.
- **After K2:** S1, S2, S3, S5 in parallel (they share only `strings.ts`, append in the own block; S1 and S3 may both touch `quickCapture/targets/adapters.ts`, different targets). S4 last: it reads `fixed`/`blocks` in `core/plan/**`.
- **Hotspots:** `core/modules/types.ts` and `core/events/events.ts` only in K1a (every additive field at once); Dexie version only in K2; `ui/Patterns.tsx` only in R1; `ui/tokens.css` in none.

## Packages

| # | Package | Branch | Scope (short) | Hotspots | Review | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| K1a | Link contract: types, resolvers | `feat/links-contract` | `core/entitylinks/types.ts`; additive fields in `core/modules/types.ts`, `core/events/events.ts`; `resolveLink`; `linkTarget` for notes, mail, invoices, calendar, todos; ToDo editor renders links through the resolver | `core/modules/types.ts`, `core/events/events.ts` | three lenses | stored ToDo shape unchanged; plan identical with and without links; `accounts` never resolved |
| R1 | Redesign foundation | `feat/planner-sheet` | build after [HANDOFF.md](HANDOFF.md): capture first, week band, day sheet, thing row with the 44-px lead slot, context column (Termine, waiting), head rule, phone plus → dialog; additive props in `ui/Patterns.tsx` | `ui/Patterns.tsx`; stimulus budget of the planner views | one reviewer + `design:design-critique` and `design:accessibility-review` on the built page | HANDOFF §9: empty share 1920 ≤ 25 %, ≥ 8 thing rows on the first 1920 screen, field y ≤ 260, 0 phone targets < 44 px, tick = 1 tap |
| F1 | „schieb … auf Mi“, „Später“ off today | `fix/plan-move-sentence` | root cause of P08, P09 in `modules/planner/{say,actions,run}.ts`; no contract change | none | one reviewer | path B without detours; `MAX` lowered |
| R2 | „Frist vorbei“, „Verschieben …“, „Warum?“ | `feat/planner-late-group` | late money leaves the days and day sums (`board.ts`), „Rest verteilen“ never moves it (P72, P73), ⋯ „Verschieben …“ with day chips, the „Warum?“ line (P80), head rule 3 | planner engine inputs (`board.ts`, `rest.ts`) | three lenses | six late invoices in the group, Monday's sum without them; move = 3 taps |
| K1b | Links and actions in the planner row | `feat/planner-row-links` | chip line through `resolveLink` (≤ 1 line, rest behind „Verknüpft“), `PlannableItem.action` in the lead slot, „Nächste Fristen“ in the context column | none | one reviewer | open source = 1 tap; hash test stays green |
| K2 | Link table `_links` | `feat/links-table` | cursor repair for newly synced tables first; `_links` (hashed id, encrypted refs) via `createRepo`; `addLink` / `linksOf` / `useLinks` / `plannedDay`; copy of ToDo links (create only when absent); `planRowAction` + `plan.requested.ref`; exclusion test over every surface; `docs/legal/data-flows-hinweise.md` | Dexie version, `core/db/schema.snapshot.json`, `core/sync/**` (cursor) | three lenses, two rounds allowed | an updated old client holds links it pulled before; no `_links` content in data API, AI prompt, search, share, diagnostics |
| S1 | Geld & Mail (dunning chain) | `feat/links-invoice-mail` | invoices: `dunnedDueDate`, `dunnedAmountMinor` (version + migration), „Aus Mail“, „Mahnung aus Mail vom …“, „Im Plan · Di“, `action` „Bezahlt …“ with untrusted `?do=pay`; mail: links written on „Anlegen“ / „Mahnung vermerken“, „Angelegt“ → entity route (P44, P45) | `quickCapture/targets/adapters.ts`, invoices `manifest.version` | three lenses | CONCEPT-LINKS §2 table, step by step, as an e2e path; settle a late invoice = 2 taps |
| S2 | Fristen | `feat/plan-source-deadlines` | subscriptions: trial end, `action` „Kündigen …“; vault documents: plannable with category titles only | none | one reviewer (privacy of titles) | no document name in chips, widget, notifications |
| S3 | Einkauf | `feat/plan-source-lists` | lists: „In den Plan“ → one row „Einkaufen · 7 Dinge“, packing by `tripDate`, `action` „Zur Liste“; pantry: `shopping.requested.ref` | `adapters.ts` only if the list target changes | one reviewer | one row per list, never an item row |
| S5 | Kleinkram | `feat/plan-source-small` | timetrack keeps `sourceRef`; people gifts (title never names the gift); notes checklist line sends its link; calendar ↔ preparation ToDo | none | one reviewer | – |
| S4 | Training & Blöcke | `feat/plan-source-blocks` | fitness `fixed` block with its time, habits `blocks`; both enter `inputHash`; decision bullet (blockers beyond calendar items) | `core/plan/**` | three lenses | a training keeps its time; a habit block is never tickable |
| M | Nachmessen | `qa/planner-hub-remeasure` | `web/e2e/usecases/planner-hub.spec.ts`: design measures become assertions; `design:design-critique` on the built page; one „measured after“ table in `ANALYSIS-MEASURE.md`; mockups and prompts of this round deleted | none | one reviewer | every target of CONCEPT-DESIGN §6 met or the difference named |

Each package: `.changes/` note (German + English; M: label `no-changelog`), focus checklist 1–9 in the PR text with before/after figures, decision bullets in `docs/decisions/plan-links.md` (links) or the planner file it concerns, the use-case scripts green (`planner-hub`, `wochenende`, `kopf-leer`), `MAX` lowered for the paths it improves and never raised. UI texts German and English only.

## Prompt head for every package

```
Routing: Claude Code · Planer-Zentrale Paket <#> · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `<branch>` von frischem `develop`. Lies docs/design/planner-hub/PACKAGES.md (Zeile <#>), die dort genannten Konzeptabschnitte und HANDOFF.md (R1, R2, K1b). Hotspots laut Tabelle in der ersten Zeile des PR-Texts nennen. Nicht in diesem Paket: alles, was eine andere Zeile nennt. Abnahme: die Spalte „Acceptance“ plus die Prüfungen aus CLAUDE.md „Done =“. Full stop.
```

## Wartet auf Sven (only what cannot go on without him)

- Look at D2 and D3 (they revise the split layout of 2026-11-12 and „the field is the last row“); mockups in the PR text of #922. A „no“ reverts one package (R1), nothing else.
- Stimulus budget: R1 raises the planner views' counts; the approval is the maintainer's signature (until 2026-11-22 the proxy comment, `docs/howto/ci.md`).
- Planner on by default or in a setup profile (L11): only if wanted.
- Hand tests on real devices after R1 and S1 go into `docs/MANUAL-TESTS.md` with the package that needs them.
