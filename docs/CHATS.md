# Chats – running work and hand-over

Several Claude chats work in parallel and only see each other through GitHub. `cd web && npm run chats:status` lists the other branches, their files and the overlap with yours. Notes between chats: root [CLAUDE.md](../CLAUDE.md) step 2. Last full review: 2026-11-10 ([meta/DOCS-DIET-2026-11.md](meta/DOCS-DIET-2026-11.md)).

**Keeping this page to one screen (budget 2 000 tokens, `check:docs`):**

- Open PRs are not listed here (`npm run chats:sync` prints them); a hand-written item is an **open** decision or chore; whoever edits this page deletes answered ones.
- Hand tests never live here: they go into [MANUAL-TESTS.md](MANUAL-TESTS.md) with an id, in the PR that needs them.
- A decision that is answered becomes a bullet in `decisions/<area>.md`; its line here is deleted. Standing to-dos before the launch live in [STATUS](STATUS.md) "Offen – macht Sven", not here.
- No history, no "merged" rows, one line per item.

## Offene PRs

Not stored in this file: `npm run chats:sync` prints the list from GitHub (`chats:status` does too); drafts are running work (open yours early). What a PR waits for stands in its PR text, first line; a decision or chore for Sven goes below. Why: [decisions/meta-ci-docs.md](decisions/meta-ci-docs.md).

## Wartet auf Sven

**Handtests:** alle in [MANUAL-TESTS.md](MANUAL-TESTS.md), eine Liste je Gerät; im PR #704 die Liste „möglicherweise veraltet“ bestätigen.

**Sicherheitskontrolle:** Urteil und Blocker in [LAUNCH-REVIEW-2026-11](security/LAUNCH-REVIEW-2026-11.md); SC1 zuerst (private Notiz).

**Entscheidungen** (Empfehlung in Klammern):

1. Übersicht ohne Daten springt je Laden um 0,18: hinnehmen oder Raster erst nach allen Karten packen? ([qa/round-6](qa/round-6/STATUS.md))
2. Pflicht-Check `Web` im `develop`-Ruleset in GitHub eintragen? (ja; danach Bullet in `decisions/meta.md`)
3. Bestätigen: kein Muster hinter Text im Modulkopf (AE2, mit 0b-2)? (ja; AE6 erledigt: seit #694 bewegt sich auf der Website nichts)
4. Browser-Erweiterung: Store oder Release-Zip? (erst X1–X14 prüfen)
5. Unterlagen: Titel auf der Übersicht als Opt-in? (nein; #489)
6. Backup: „Was ging wohin?“ auch ohne „In Arbeit anzeigen“? (#566)
7. Merkliste und Unterlagen mit demselben Kopf lassen? Akzent-Varianten statt festem 25°-Abstand der Modulfarben? (#485)
8. „Open questions“ in den PR-Texten von #656 (`disk_delete` nur per Attribut `async`?), #632, #490, #492, #1070.
9. Planer-Zentrale ([planner-hub](design/planner-hub/README.md) „Waits on the maintainer“): D2/D3, Reiz-Budget R1. (so lassen)
10. Austausch Handy ↔ PC ([CONCEPT §11](design/device-exchange/CONCEPT.md)): Handy holt erst beim Öffnen? (ja, v1) · nur Heimnetz? (ja) · Name „Austausch“? (ja) · Regelzeile (Paket R) mergen.
11. „Werte ausblenden“ (DESIGN-CHECK K2): nur Kopfzahl + Zeile darunter (so gebaut, #752) oder alle Beträge der Geld-Seiten und Karten? (alle Geld-Karten, Wunsch aus Budgets; eigener kleiner PR)
12. Wetter Runde 2: A und B gemergt, C als PR offen, dann D ([PACKAGES](design/weather-scenes-2/PACKAGES.md)).

**Handgriffe:**

- PRs: #1035 Ratschen-Treffer `a11y.spec.ts` freigeben; #1027 zwei Ratschen-Treffer (`checkModules`, geschützt) freigeben (ja; Ernte H25); #606 mergen, wenn grün; #542 vor dem Launch entscheiden (Dev-Preview- und Dev-Keystore-Teil offen; Repo-Secrets bis dahin unverändert).
- `ci.yml`-Patch aus #653 einspielen (`GITHUB_TOKEN` nur am Ratschen-Schritt statt im Job-`env` von `stimulus-budget`).
- Dezember: `nemo-merge` (`meta/agents-v3/nemo-merge.json`) anlegen, Probelauf `ratchet.mjs --pr` mit Wegwerf-PR, Treffer von #640/#642 ansehen (`decisions/meta.md`).
- Agenten v3.1: `ant apply` der sieben, `--prune` der 16 alten, dann `claude-lock.json` committen ([SETUP](meta/agents-v3/SETUP.md) §2a).
- Fernsteuerung: Handtests FB1–FB19 ohne FB13 ([MANUAL-TESTS.md](MANUAL-TESTS.md), echtes Handy und Windows-PC); danach Modul und Einstellungs-Abschnitt auf `stable` stellen lassen.
- `qa/round-5/<x>/MESSAGE.md` an A–D mit Dev-Preview-Link schicken.
- Chats starten: `fix/ui6-head-heights` (U41); nach 0b-8 alle Bildschirmfotos (README, Social-Preview) neu.
- Website – Bilder, sobald die App steht: Chat nach [design/site/SLOTS.md](design/site/SLOTS.md) starten (sechs Slots).
- HN-L9 b: Zeit bis zum Einfrieren in `design/sync-lan/CONCEPT.md` §9 nachtragen.

## Hotspots (announce first)

| File / area                                                                              | Rule                                                                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| root `CLAUDE.md`, area `CLAUDE.md`, `docs/RULES.md`                                      | only when a rule changes; own PR; Sven merges (`meta/agents-v3/SHARED.md`)                  |
| `web/src/strings.ts`                                                                     | append inside your module's block only; never reorder or reformat others                    |
| `web/src/core/modules/types.ts`, `core/modules/registry.ts`                              | manifest contract: one chat at a time (say so in the first line of your draft PR's text)    |
| `web/src/core/platform/types.ts`, `core/platform/tauri/index.ts`, `core/platform/web.ts` | platform seam: one chat at a time                                                           |
| `web/src/ui/tokens.css` (+ `tokens.test.ts`)                                             | token changes: one chat at a time                                                           |
| `web/package.json`, lock files, `web/src-tauri/Cargo.toml`/`Cargo.lock`                  | dependencies in a small separate commit; lock files regenerated by tools, never hand-merged |
| `core/db/schema.snapshot.json`, Dexie version                                            | on conflict re-run `npm run db:bump` after merging `develop`; never hand-edit               |
| `web/src/ui/charts/**`                                                                   | wishes via the notes repo; no module copies                                                 |
| `web/src/ui/charts/parts.tsx`, `charts.module.css`                                       | budgets #997 (Sven's OK): sr-only table at 1 px, fixed layout                               |
| `web/src/pages/Settings.tsx`, `layout/AppShell.tsx`, `router.tsx`                        | small edits, local to your section                                                          |
| images under `docs/`                                                                     | none ([DOCS-GUIDE](meta/DOCS-GUIDE.md#images)); screenshots go into the PR text             |
| `docs/STATUS.md`                                                                         | only in a `docs(status)` PR of its own (docs only), never in a feature PR                   |
| `docs/DECISIONS.md`, `docs/HOW-TO.md`, `docs/ARCHITECTURE-MAP.md`, `README.md`           | touch only on real change; one line / one block, no reformatting                            |
| `web/src/modules/mail/**`, `web/src/core/mail/**`, `strings.ts` (mail block)             | `feat/mail-find-overview` (+ follow-up `feat/mail-*`)                                       |

## Hand-over conventions

- PR description = hand-over: **Done / Open / Next / How to verify**, links to files, no history.
- Unfinished work: push the branch, keep the PR as draft, write `paused – <what is missing>` as the first line of its PR text, list open items in the PR.
- A problem outside your scope: note it in the PR text (or open an issue), do not fix it silently.
- Do not merge another chat's PR; do not push to another chat's branch.
- A decision that changes a root rule or a hotspot contract goes into `decisions/` in the same PR.
