# Docs diet 2026-11 – measurement, clean-up, where the tokens go

Report of the PR `docs/diet-2026-11` (2026-11-10). Measure again any time: `node scripts/docs/measure.mjs` (no network; `--json` for numbers, `--notes <dir>` for a clone of the notes repo). Tokens are bytes / 4, the rule of `check:docs`. Follow-up packages: [DOCS-DIET-2026-11-PACKAGES.md](DOCS-DIET-2026-11-PACKAGES.md).

## 1. Before and after

| What | Before | After | Change |
| --- | ---: | ---: | ---: |
| Start cost, module fix | 67,594 | 36,850 | −45 % |
| Start cost, docs PR | 58,100 | 27,218 | −53 % |
| Start cost, new module | 79,025 | 48,297 | −39 % |
| Agent thread `nemo-lead` | 25,414 | 11,635 | −54 % |
| Agent thread, the other six (each) | 8,532–9,495 | 8,145–9,075 | −5 % |
| Root `CLAUDE.md` (every chat, always) | 3,187 | 2,755 | −14 % |
| `docs/CHATS.md` | 113 lines, 15,311 | 82 lines, 1,952 | −87 % |
| `docs/STATUS.md` | 320 lines, 20,635 | 114 lines, 4,418 | −79 % |
| `docs/README.md` (index) | 1,464 | 698 | −52 % |
| `docs/PROMPT-TEMPLATES.md`, the six cited blocks | 881 | 626 | −29 % |
| All Markdown in the repo | 579 files, 1,047,475 | 548 files, 910,997 | −13 % |
| Other files removed (mockup HTML, audit tools, JSON, SVG) | – | 66 files | – |

What a chat reads at its start (the list is `START` in the script): root `CLAUDE.md`, `docs/README.md`, `docs/CHATS.md`, `docs/STATUS.md` (it adds a line), the six blocks of `PROMPT-TEMPLATES.md` the prompt head cites, the board of the notes repo, plus per task: module fix = `web/src/modules/CLAUDE.md`, `ARCHITECTURE-MAP.md`, `howto/design-rules.md`, `howto/changelog.md`; docs PR = `meta/DOCS-GUIDE.md`; new module = the module-fix set plus `RULES.md`, `howto/new-module.md`, `howto/seed-data.md`, `design/MODULE-IDENTITY.md`, `design/FOCUS-GUIDELINES.md`. An agent thread: its system prompt, `SHARED.md`, root `CLAUDE.md`; the lead also `CHATS.md` and `WORK-ROUTING.md`.

**Targets.** Start cost at least 30 % lower: met for all three chat tasks and the lead. **Missed for the six other agents (−5 %)**: their cost is system prompt + `SHARED.md` + root `CLAUDE.md`; the first two are guardrail texts that only the maintainer applies (`ant apply`), so this PR changed references only (package 6). **Missed: root `CLAUDE.md` is at 2,755, its budget is 2,600.** The rest is security wording that this PR may shorten but not move without a decision (rule change 1 below closes the gap). CHATS on one screen: met (budget 2,000 tokens). **Not done here:** the lower half of STATUS ("Offen – macht Sven", "Nächste sinnvolle Schritte", the module review) is the maintainer's own list and stayed as it was apart from one finished item; package 9 tidies it. **Decided for the maintainer, easy to undo:** `meta/AGENTS.md` now carries the v3.1 roster although `agents-v3/README.md` still calls v3.1 a proposal; `ant apply` and the decision bullet remain his (CHATS "Handgriffe").

After the diet the largest start items are the board of the notes repo (15,610 if read in full; 111 items, 110 open, 38 older than the one-week rule) and `ARCHITECTURE-MAP.md` (6,879, budget 4,200): rule change 2 and package 3.

## 2. What the measurement found

- **CHATS.md:** 84 table rows, 49 of them said "merged", 24 were exact duplicates (a second copy of half the table with its own header). GitHub had 5 open PRs; the table listed 44 items as waiting. About 100 PRs were merged between 2026-11-08 and 2026-11-10; rows were added on every stop and almost never removed.
- **STATUS.md:** "Nächste eine Sache" was a 202-line work log (62,949 characters); 31 lines still said "PR offen" for merged PRs, 14 named branches that are gone. The header said "no open PRs".
- **Notes between chats:** the rule is the private notes repo (root `CLAUDE.md`, since #681). The folder `scribble/` in this repo is a leftover (77 files, 47,909 tokens; draft PR #553 removes it); its README still described the old "small PR" way. `chats:status` falls back to that stale board when no clone of the notes repo is at hand. This PR leaves the folder to #553.
- **Stale facts fixed here:** five app languages as current (`CONTRIBUTING.md` twice, `howto/seed-data.md`, `MANUAL-TESTS.md` V4, two decision bullets marked); the roster of 19 agents in `meta/AGENTS.md` (now the seven of v3.1); identity fields "(hue, head, surface, signature)" (the type has `widget`, not `surface`); the LWW rule "twice" in `server/CLAUDE.md` (it exists three times); crate lists in root and `web/src-tauri/CLAUDE.md` (4 and 5 of 11 crates, a clippy list that differed from CI); `user/` as "German user docs" in the map; `docs/README.md` (a row for `screenshots/`, which does not exist; no rows for `qa/`, `rules/`, `LAUNCH-CHECKLIST.md`); `extension/CLAUDE.md` missing from the area lists and from `check:docs`.
- **Changed in an agent prompt (takes effect only after `ant apply`):** `nemo-docs` removes a "Wartet auf Sven" row with the evidence "merged PR, its hand tests in MANUAL-TESTS with an id, its decision in the list or answered by a bullet" instead of "merged PR + ticked test / decision bullet", because hand tests no longer live in CHATS rows.
- **Not fixed, needs the maintainer:** git tags end at `v0.3.1` while `web/package.json` and `CHANGELOG.md` say `1.0.0` (noted in STATUS); `agents-v3/README.md` still calls v3.1 a proposal while `SHARED.md` calls it binding; `docs/decisions/meta.md` has no v3.1 bullet and describes the older light path; `claude-lock.json` lists 22 agents.
- **Duplicates (one fact in several files):** change note (5 places), git rules (5), notes between chats (7), "what to touch in docs" (3), questions to the maintainer (3, with different counts), Chromium path (5), module rules (3), roster (5). This PR made root `CLAUDE.md` the source for chats and lets `PROMPT-TEMPLATES`, `HOW-TO` and the area files point to it; `SHARED.md` stays the source for agents.
- **Script heuristics, not all real:** 217 backticked paths that do not exist and 124 branch names that are gone remain, most of them in finished reports that describe the past; 48 lines match a stale-wording pattern (mostly "five languages" in historical reports).

## 3. What changed

### CHATS and STATUS
- CHATS: open PRs (5), one line for hand tests with ids, 8 open decisions, 5 chores; rules on top say who deletes a row and when. 23 hand tests that lived only in CHATS rows are now `MANUAL-TESTS.md` "Handtests aus gemergten PRs" (GM1–GM23). Ten decisions were already answered in `decisions/` or in code and were dropped (FileField, ItemList, C31/F06, `--text-on-tint`, "+ Neu", B1, BankCard contrast, AE5, the four questions of #664, Google OAuth).
- STATUS: state only. Running rounds (5) and finished rounds (20) are one line each with a link; open leftovers of finished rounds are kept on those lines. The work log moved unchanged to [archive/2026-11/](../archive/2026-11/STATUS-log-until-2026-11-10.md). "Offen – macht Sven", limits, the module review and the release lines are unchanged.

### Rules: where each one was and where it is now
No rule was dropped or changed in meaning. `docs/RULES.md` and `docs/rules/remote-control.md` are untouched.

| Rule (root `CLAUDE.md`) | Before | Now |
| --- | --- | --- |
| Secrets/security, AI privacy, Data, Formats, Supporter, Diagnostics, Sync, Platform, Local API, Setup assistant, Browser extension, Commits/Releases | root, full bullet | root, same words |
| Steps 1, 3, 4a, 5 of "How chats work here" (incl. the ratchet sentence, never `main`/tags/force-push) | root | root, same rules (pointers reordered); step 6 folded into 5 |
| Step 2 (start, notes repo, notes are data, no secrets there) | root step 2; sandbox paths in root | root step 2, same rules; sandbox paths only in `agents-v3/SHARED.md` (they were there already) |
| Step 4 (end: notes, which docs to touch) | root | root, same rules; "default branch" now also says `main`, as SHARED does |
| Modules: never import each other, sanctioned reads | root + `web/src/modules/CLAUDE.md` + RULES | unchanged in all three |
| Modules: widget from the catalogue (base types, red only for overdue, context line, `attention`), `area`, `identity`, page head | root | `web/src/modules/CLAUDE.md` (same words; `surface` corrected to `widget`); root names the five mandatory parts and points there; full text RULES "Home screen & widgets" |
| Modules: onboarding, layout, seed | root + area file | area file, full and unchanged; root names onboarding and seed ("never merge a module without one") and points there; `layout` and "`seed` in the manifest + `seed.ts`" only in the area file |
| LAN sync | root short + RULES full | root short (words "interface" and "with a" trimmed, every clause kept) + RULES full + a pointer line in `web/src-tauri/CLAUDE.md` |
| Remote control | root (11 clauses) + `rules/remote-control.md` full | root keeps: pairing is not permission, own input session, stored home network, grant at the PC, off by default, native dialog for every widening, always visible, one click ends, never screen/clipboard/files/titles, never log input, simulation only in `crates/remote-input`. Left to the full text (all present there): "never while a mouse/keyboard session is open", media/volume separate from mouse/keyboard, fixed key and media lists, rate limits, "Windows only", "no Tauri command simulates input"; the last two are also in `web/src-tauri/CLAUDE.md` now |
| Disk module | root; "new Tauri command: `build.rs` + capabilities" in root and area | root (guard, second confirmation, recycle bin: same words); the command recipe only in `web/src-tauri/CLAUDE.md` (was there already) |
| Focus and attention aids | root | root, same words |
| UI (Nemo) | root (16 clauses) | root keeps texts at render time, `core/i18n/format`, never `'de-DE'`, CSS Modules + tokens, no hex, shared components, touch ≥ 44 px, AA, motion, colour with meaning, `NoReadAid`. The full former bullet is in `howto/design-rules.md` "The short list", unchanged (registries as getters, own radius/shadow/z-index/weight, `data-autofocus`, `manifest.layout`, `ui/semantics.ts`, reading aid runtime, `GroupedList`) |
| Language of UI texts (header line) | root header + UI bullet | root header, one sentence |
| Formats (in the area file) | root + `web/src/modules/CLAUDE.md` | root only (the area copy repeated it) |
| LWW "change both or neither" (`server/CLAUDE.md`) | said "twice" | says three copies, "change all or none" (as root and RULES) |
| Commands `gen:icons`, `version:*`, `changelog` | root | `HOW-TO.md` (were there already); root links |
| Crate list, clippy `-p` list | root (4 crates), area (5 and 6) | area file points to `ls crates/` and the CI job; no list to go stale |
| "Where to look" table | root, 8 rows | root, 3 lines; the table is `docs/README.md` |

Budget changes: area `CLAUDE.md` 500 → 700 tokens (details moved there from the always-loaded root; `extension/CLAUDE.md` is now checked too).

### Finished working documents
| Path | Decision | Why |
| --- | --- | --- |
| `docs/meta/agents-v2/` (21 files) | deleted | draft roster, replaced by v3/v3.1; only the v3 review mentioned it |
| `docs/meta/DOCS-AUDIT-2026-10-01.md`, `BACKLOG-HARVEST-2026-11-03.md` | deleted | results are DOCS-GUIDE and decision bullets (`decisions/core.md` keeps the harvest bullet) |
| `docs/meta/agents-v3/AGENTS.proposed.md` | became `docs/meta/AGENTS.md` | the old file listed 19 agents that no longer exist |
| `docs/design/identity-v2/` | deleted | superseded by v3; decision in `decisions/ui-shell.md` |
| `docs/design/IMPLEMENTATION-PROMPT.md` | deleted | "Klar 2" is built; rules are in DESIGN-SPEC |
| Package prompts of merged rounds: `design/plan/PACKAGES.md`, `identity-v3-audit/02-packages.md`, `sync-lan/PACKAGES.md`, `settings-v3/PACKAGES.md`, `usecases/kopf-leer/PACKAGES.md`, `product/next/prompts/`, `product/focus/13–15` | deleted | every package is merged |
| `identity-v3-audit/{mockups,tools,*.txt}`, `settings-v3/{mockups,tools}` | deleted | one-off audit tools and mockups of merged rounds; findings and acceptance stay |
| `docs/product/settings/` | deleted | no inbound reference; decisions in `decisions/ui-shell.md` |
| `docs/qa/<persona>/` (7 folders), `qa/consolidated.json` | deleted | consolidated in `qa/CONSOLIDATED.md`, which tests cite |
| `docs/design-proposals/logo-l*.svg` | deleted | superseded by logo v2 |
| `design/identity-v3/`, `plan/` (concept, prototype), `sync-lan/` (concept, notes, review), `usecases/kopf-leer/` (analysis, target), `settings-v3/ROUND-1…3`, `qa/CONSOLIDATED.md`, `qa/round-4…6`, `product/comfort`, `product/focus` (audit, img), `product/next` (rest) | kept | code, tests or decisions cite them (`qa/round-5/b/*.csv` is read by a test) |
| `design/ui-audit-2026-11/`, `remote-control/`, `site/`, `product/clock/` | kept | rounds still running |
| `design/ROUND-1…7`, `mockups/round-*`, `READABILITY-PLAN`, `VISUAL-AUDIT`, `meta/CLEANUP-2026-10-03`, `IMPROVEMENTS-2026-10-03` | kept for now | DESIGN-SPEC and RULES link into them; summarising is package 4 |

48 links that pointed at deleted files now read "… (removed 2026-11-10, in the git history)". New rule in DOCS-GUIDE: the PR that closes a round deletes its package prompts, mockups and tools.

## 4. Where the tokens go

Numbers are estimates from the repo (bytes / 4); what a session really costs depends on caching and is only visible in the billing.

| Where | What it costs | Saving | Price | Recommendation |
| --- | --- | --- | --- | --- |
| Mandatory reading per chat | before 58–79 k tokens, after 27–48 k | done here: 31 k per chat | none; the removed text was history | keep the budgets enforced (package 1) |
| Many parallel chats | about 100 PRs in three days, each a chat that reads the same start set: ≈ 6.5 M tokens of start reading before, ≈ 3.5 M after | the remaining lever is fewer chats, not shorter docs | fewer, larger PRs are harder to review and to pause | bundle test-only and docs-only follow-ups: on 2026-11-10 about 9 PRs were single test fixes (`fix/seed-*`, `fix/*-test-*`) and 6 were docs status PRs (`docs/chats-close-*`, `docs/status-*`); one chat per topic per day saves about 15 starts a day ≈ 0.5 M tokens |
| Board of the notes repo | 15.6 k if read in full; 110 of 111 items open, 38 older than a week | up to 15 k per chat | a chat may miss an old heads-up | rule change 2; one housekeeping pass (package 5) |
| STATUS/CHATS PRs | a chat per "close the row" PR (6 on one day) | the whole chat (≥ 27 k each) | rows live a little longer | a PR removes its own rows in its last commit, and any chat that edits CHATS deletes merged rows (rule now on top of CHATS); no PR whose only content is a row |
| `council` | three Opus delegates per round, each reads the diff and the rules; the UI audit ran 16 rounds, the 0a acceptance 2, single fix PRs 2–3 | a round is at least 3 × (start cost + diff); `review-loop` is one Opus reviewer | one lens instead of three: a guardian finding can be missed | `council` only where a wrong merge is expensive: rules, security, data formats, sync, vault, design system contracts. Everything else `review-loop`. At most 2 council rounds per PR; a third needs the maintainer (rule change 3) |
| `babysit-pr` | every wake-up re-reads the session context; polling multiplies that | a poll every few minutes on a 15-minute CI run is 3–5 full turns | none if events arrive | wait on PR events only, never poll; do not babysit docs-only PRs past the first green run |
| Prompts that demand reading | this prompt's own list named a dozen files to read up front, ≈ 50 k tokens before the first edit (CHATS and STATUS alone were 36 k) | 10–40 k per large prompt | the chat may miss context | name the one area doc; let the chat use the index (lean template below) |
| Several chats on one surface | the "Erstkontakt" round ran 6 chats over shared files and needed an ownership list on the board that every chat re-read | the claims and the conflict merges | slower rounds | one chat per surface (files), not per persona; findings for another surface go to that chat's PR text |
| Agents | lead start 25 k → 11 k; `SHARED.md` 4 k per thread, 4 threads = 16 k; one lead session with 9 delegations cost 82 USD (WORK-ROUTING) | package 6: about 20 lines of the prompts repeat CLAUDE/PROMPT-TEMPLATES | guardrail text is deliberate repetition | leave the guardrails; cut only what `validate.mjs` does not pin |
| Screenshots, fixtures, mockups | 1,703 images (215 MB) left `docs/` on 2026-11-08; still there: `docs/design/mockups` 980 KB HTML, `docs/assets` 1.2 MB, `scribble/` 77 files | clone and scan time, not chat tokens (`.ignore` hides most) | none | merge #553; package 4 |
| Oversized lookup docs | `decisions/core.md` 13.4 k, `ui-shell.md` 11.9 k, `modules.md` 9.4 k, `ARCHITECTURE-MAP.md` 6.9 k, `HOW-TO.md` 5.8 k, `howto/ci.md` 6 k (budgets 3–4.2 k) | a chat that needs one decision reads up to 13 k | splitting costs one PR each | package 3 (split by topic, mechanical) |

### Three rule changes to decide (not applied)

**1. Root `CLAUDE.md`: three area rules keep one line, the text moves unchanged to `docs/rules/`** (−150 tokens in every chat; root reaches its 2,600 budget). Price: a chat that touches supporter codes, diagnostics or the setup assistant must open the rule file; the tests named in the rules still fail on a breach.

```diff
-- **Supporter mode:** cosmetic only, nothing behind a paywall, no nag; codes Ed25519-signed and checked offline (`packages/supporter-codes`, no network in `core/supporter`); status is derived from the code; the code-issuing service is separate and knows no user data. [docs/howto/supporter.md](docs/howto/supporter.md)
-- **Diagnostics / bug reports:** only on user action, previewed first, never sent by the app; never entries, vault, tokens, keys, server URLs, mails, IPs, user paths (negative-list test in `core/diagnostics`). [docs/howto/bug-reports.md](docs/howto/bug-reports.md)
-- **Setup assistant:** progress device-local (`_meta` `setup.state`), step ids only, never secrets, never appears by itself on an installation with data.
+- **Supporter mode, diagnostics, setup assistant** (`core/supporter`, `core/diagnostics`, `core/setup`): never a paywall or nag, never data in a bug report, never a secret in setup progress. Read `docs/rules/core-privacy.md` before touching them.
```
(`docs/rules/core-privacy.md` = the three bullets above, word for word.)

**2. Root `CLAUDE.md` step 2: the board is read through `chats:status`, never in full** (up to −15 k tokens per chat). Price: a heads-up that names no path can be missed.

```diff
-2. Start: `npm run chats:status` (in `web/`: other branches, file overlap, open board items); …
+2. Start: `npm run chats:status` (in `web/`: other branches, file overlap, first line of every open board item); open a board file only when its first line names your branch, your files or "all chats"; never read the board in full. A board item older than a week is deleted by the chat that sees it. …
```

**3. `docs/PROMPT-TEMPLATES.md`: a `review` block that says when `council` is worth it.** Price: fewer lenses on ordinary PRs.

```diff
+## review
+
+- `council` (three Opus delegates) only for a decision PR: rules (`CLAUDE.md`, `docs/RULES.md`, `docs/rules/`), security, vault, sync and LWW, data formats and migrations, manifest or platform contracts, design system tokens. At most 2 rounds per PR; a third needs the maintainer.
+- Everything else: `review-loop` (one Opus reviewer). Docs-only and test-only PRs: `review-loop` with one round.
+- `babysit-pr` waits on PR events, never polls; a docs-only PR is handed over after the first green run.
```

### Lean prompt (proposal for PROMPT-TEMPLATES `#shorter-prompts`)

About half the length of today's prompts. Safety stays in the files the head line cites and in root `CLAUDE.md`, which every chat loads anyway.

```
Routing: Claude Code · <title> · <model>
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch: <type>/<topic> · Read: <the one area doc> (nothing else up front)

Goal: <one sentence: what is different for the user or the next chat afterwards>
Scope: <files or folders>; not: <what stays untouched and which parallel branch owns it>
Done means: <2–4 checkable lines: command → result, number → target>
Stop and ask only if: <the one or two decisions that are the maintainer's>
Review: review-loop | council (only for a decision PR) · then file-pr
```

Left out on purpose: lists of files to read "to be safe" (the index does that), restated git and docs rules, the phase description when there is one phase, skill lists beyond the review line.
