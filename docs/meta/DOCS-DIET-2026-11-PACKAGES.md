# Docs diet 2026-11 – follow-up packages

Ready prompts for what is larger than the diet PR or touches code. Background and numbers: [DOCS-DIET-2026-11.md](DOCS-DIET-2026-11.md). One package = one branch = one PR; they do not depend on each other unless said. Every prompt uses the head line of [PROMPT-TEMPLATES](../PROMPT-TEMPLATES.md#shorter-prompts). Delete a package here in the PR that finishes it.

| # | Package | Model | Why this model |
| --- | --- | --- | --- |
| 1 | `check:docs` enforces freshness and size | Opus | a small script change with a few edge cases, no trade-offs |
| 2 | CHATS tables generated from the open PRs | Opus | script plus one CI step; the format is decided here |
| 3 | Split the oversized lookup docs | Haiku | moving bullets by topic is mechanical; `check:docs` proves it |
| 4 | Summarise the 2026-10 design rounds into DESIGN-SPEC | Opus | needs to judge which numbers the spec still needs |
| 5 | Board housekeeping and the end of `scribble/` | Haiku | applies a written rule to dated files |
| 6 | Agent prompts: remove repeats, finish the switch-over | Fable | guardrail texts: every cut is a trade-off, and Sven applies it |
| 7 | MANUAL-TESTS by device, done items out | Opus | regrouping 760 lines without losing an id |
| 8 | Move the round-5 fixture, drop the rest of `qa/round-5` | Haiku | one file move and a path in one spec |

## 1 · `check:docs` enforces freshness and size

```
Routing: Claude Code · check:docs freshness rules · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Closing: #closing · PR: #pr-text
Branch: ci/check-docs-freshness · Read: docs/meta/DOCS-GUIDE.md, web/scripts/check-docs.mjs

Goal: CHATS.md and STATUS.md cannot grow back; a stale row fails locally and in CI.
Scope: web/scripts/check-docs.mjs (+ a test next to it), docs/meta/DOCS-GUIDE.md; not: .github/** (workflow change as a patch in the PR text).
Done means:
- CHATS.md: a table row that contains "gemergt" or "merged", or two identical rows → problem.
- CHATS.md and STATUS.md over budget → exit 1 even without --strict (today a warning); start context over budget → exit 1.
- STATUS.md: a line with "PR offen" or a backticked branch that `git branch -r` no longer has → warning (skipped when the clone has no remote branches).
- Unit test with a fixture for each rule; `npm run check:docs` green on develop.
Stop and ask only if: a rule would fail on develop for a reason other than a stale row.
Review: review-loop · then file-pr (label no-changelog)
```

## 2 · CHATS tables generated from the open PRs

```
Routing: Claude Code · CHATS.md open-PR table from GitHub · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Closing: #closing · PR: #pr-text
Branch: feat/chats-generated · Read: docs/CHATS.md, web/scripts/chats-status.mjs

Goal: nobody maintains "Offene PRs" and "Läuft gerade" by hand; the tables are written from the open PRs.
Scope: web/scripts/ (new `chats:sync`, reuse chats-status.mjs), docs/CHATS.md (markers around the two generated tables); not: the decisions and chores lists (hand-written), .github/** (patch in the PR text).
Done means:
- `npm run chats:sync` rewrites the block between `<!-- generated:open-prs -->` markers from a JSON of open PRs (number, title, head, draft, labels; read from a file or stdin, so it runs without network in tests); the hand-written "Zu tun" cell of a row survives a sync, keyed by PR number.
- A PR that is no longer open loses its row; `--check` exits 1 when the block is stale.
- Test with a fixture; howto line in docs/HOW-TO.md.
Stop and ask only if: the maintainer should rather read the PR list on GitHub and drop both tables (then this package is a deletion).
Review: review-loop · then file-pr
```

## 3 · Split the oversized lookup docs

```
Routing: Claude Code · split lookup docs over budget · Haiku
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Closing: #closing · PR: #pr-text
Branch: docs/split-lookup-docs · Read: docs/meta/DOCS-GUIDE.md ("A file over budget is split by topic")

Goal: a chat that needs one decision or one path reads at most 3 000 tokens.
Scope: docs/ARCHITECTURE-MAP.md (6.9 k, budget 4.2 k), docs/decisions/{core,ui-shell,modules,features,plan,meta,focus}.md, docs/howto/ci.md, docs/architecture/connectors.md, docs/legal/DATA-FLOWS.md; not: docs/HOW-TO.md "Which checks run when" (owned by ci/cleanup-round-3), docs/RULES.md.
Done means:
- Every bullet moves unchanged into `<file>/<topic>.md` or `<area>-<topic>.md`; the old file becomes an index with one line per topic. No bullet is reworded or dropped (`git diff --stat` shows moves; a script in the PR text counts bullets before and after).
- Inbound links and anchors still resolve (`npm run check:docs`, `check:doclinks`); section names that code comments cite stay findable (`grep -rn "<old heading>" web/src`).
- `npm run check:docs` lists none of these files.
Stop and ask only if: a file has no natural topic split.
Review: review-loop · then file-pr (label no-changelog). One PR per two or three files is fine.
```

## 4 · Summarise the 2026-10 design rounds into DESIGN-SPEC

```
Routing: Claude Code · design rounds 1–7 into the spec · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Closing: #closing · PR: #pr-text
Branch: docs/design-rounds-summary · Read: docs/design/README.md, docs/design/DESIGN-SPEC.md

Goal: DESIGN-SPEC stands alone; the seven round files and their mockups can go (≈ 1 MB, 56 KB Markdown).
Scope: docs/design/ROUND-1…7*.md, docs/design/mockups/round-2…7, mockups/readability, READABILITY-PLAN.md, VISUAL-AUDIT-2026-10-03.md, docs/meta/CLEANUP-2026-10-03.md, IMPROVEMENTS-2026-10-03.md; keep mockups/fonts and mockups/adhd.
Done means:
- What the spec links into the rounds for (contrast ratios of round 4, the per-module table of round 7, §7a from the visual audit) is in DESIGN-SPEC itself; the duplicates list RULES.md cites from CLEANUP is in docs/howto/ (RULES.md gets only its link changed: that line is a rule file, say so in the PR).
- Open items (readability Q16, visual audit #17/#18, IMPROVEMENTS) are in ROADMAP or STATUS, one line each.
- Files deleted, no dead link, `npm run check:docs` green; table "file → where its content went" in the PR.
Stop and ask only if: an open item contradicts a later decision.
Review: review-loop · then file-pr (label no-changelog)
```

## 5 · Board housekeeping and the end of `scribble/`

```
Routing: Claude Code · notes repo housekeeping · Haiku
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Closing: #closing
Repos: SGNemo/nemo-scribble (push to main per its README), SGNemo/schweizer-taschenmesser (PR #553)

Goal: `chats:status` shows a board a chat can read in one screen.
Scope: nemo-scribble `board/` and `notes/`; in the app repo only what #553 already does.
Done means:
- Board items older than a week and notes about merged branches are deleted (rule in the notes repo README); items that still matter are rewritten as one current item each. Count before/after in the commit message. Never force-push.
- #553 is brought up to date with develop and marked ready, or closed with the reason; after it, `web/scripts/lib/scribbleSources.ts` has no legacy fallback and CI's `scribble-guard` text matches.
Stop and ask only if: a note looks like a decision that is not in docs/decisions/.
Review: review-loop for #553
```

## 6 · Agent prompts: remove repeats, finish the switch-over

```
Routing: Claude Code · agents v3.1 prompts and switch-over · Fable
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Closing: #closing · PR: #pr-text
Branch: docs/agents-v31-switch · Read: docs/meta/agents-v3/README.md ("Switch-over"), SHARED.md

Goal: one description of the agent team that is true, and system prompts that carry role and limits only.
Scope: docs/meta/agents-v3/** (JSON is the source; `node scripts/agents/to-ant.mjs`), docs/decisions/meta.md, claude-lock.json is the maintainer's; not: guardrails, hard limits and anything `validate.mjs` pins.
Done means:
- README no longer calls v3.1 a proposal (or says exactly what is not applied yet); decisions/meta.md has the v3.1 bullet and the current light path; the folder rename to docs/meta/agents/ is done or dropped from the plan.
- Lines in the seven prompts that restate CLAUDE.md or PROMPT-TEMPLATES (about 20: builder i18n/Done, docs "Rules", lead roster table and closing, reviewer design rules) point to the source instead; a table "line → source" in the PR. Start cost per agent before/after from `node scripts/docs/measure.mjs`.
- `validate.mjs` and `to-ant.mjs --check` green. Sven merges and runs `ant apply`.
Stop and ask only if: a cut would change what an agent may do.
Review: council · then file-pr (label no-changelog)
```

## 7 · MANUAL-TESTS by device, done items out

```
Routing: Claude Code · MANUAL-TESTS regrouped · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Closing: #closing · PR: #pr-text
Branch: docs/manual-tests-by-device · Read: docs/MANUAL-TESTS.md

Goal: Sven sits at one device and works one list top to bottom (33 k tokens, 760 lines today, grouped by the PR that added the test).
Scope: docs/MANUAL-TESTS.md, references to its ids in docs/ and web/src/strings*.ts; not: test wording.
Done means:
- Sections: Windows · Android · both devices · website · accounts needed (Google, Spotify, Ko-fi); inside each, by module. Every id keeps its name (ids that collide, like C1–C4 three times, get the section prefix and a redirect line); a table old heading → new place in the PR.
- Tests that are obsolete (frozen languages, removed modules) are listed in the PR for Sven to confirm, not deleted silently.
Stop and ask only if: an id is cited from code or UI text.
Review: review-loop · then file-pr (label no-changelog)
```

## 8 · Move the round-5 fixture, drop the rest of `qa/round-5`

```
Routing: Claude Code · round-5 fixture out of docs · Haiku
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Closing: #closing · PR: #pr-text
Branch: test/round5-fixture-move · Read: web/e2e/first-contact-b.spec.ts

Goal: no test reads a file under docs/; the finished first-contact round keeps one summary.
Scope: docs/qa/round-5/**, web/e2e/fixtures/, the spec above and comments that cite round-5.
Done means:
- `sparkasse-demo.csv` lives under web/e2e/fixtures/, the spec is green (`npx playwright test e2e/first-contact-b.spec.ts`).
- The MESSAGE.md files stay until Sven has sent them (CHATS "Handgriffe"); FINDINGS of A–D become one `docs/qa/round-5.md` with the open findings only.
Stop and ask only if: a finding is still open and has no PR.
Review: review-loop · then file-pr (label no-changelog)
```
