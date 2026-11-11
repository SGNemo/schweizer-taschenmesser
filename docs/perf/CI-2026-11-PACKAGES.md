# CI clean-up, round 3 – packages to hand over

Numbers and diagnosis: [CI-2026-11.md](CI-2026-11.md). Each block is a ready prompt (German, as the maintainer's
prompts are). Every package that touches a workflow, an action or `web/*.config.*` is a ratchet hit
([howto/ci-ratchet.md](../howto/ci-ratchet.md)): the maintainer signs it; say so in the PR text.

## Order

| # | Package | Model | Depends on | Parallel with |
|---|---|---|---|---|
| 1 | `develop` runs: stop the jobs outside the Dev-Preview gate when a newer push waits, rest E2E for the newest commit only | Fable | this round merged; the maintainer's yes (question in the prompt) | 3, 4 (tests only), 5 |
| 2 | Install once per run | Opus | package 1 merged (both rewrite `ci.yml`) | 3, 4 (tests only), 5 |
| 3 | CodeQL only where code changed | Fable | the maintainer's yes (question in the prompt) | 1, 2, 4, 5 |
| 4 | Flaky tests | Opus | its one workflow commit (retried tests in the job summary) after package 2 | all, without that commit |
| 5 | Dependabot spread over the week | Opus | – | all |

`ci.yml` is a hotspot: packages 1 and 2 one after the other, with a heads-up row in `docs/CHATS.md`. Baseline for
every target below: `node scripts/ci/measure.mjs --runs 1000` a few days after this round is merged; the chat of
package 1 runs it as its first step and adds one line to [CI-2026-11.md](CI-2026-11.md), each later package
measures again. Targets that need days of runs are a re-measurement after the merge, not a gate of the PR. In every prompt `#git` comes before the skill:
`develop` is merged in once, before the pull request.

## Only the maintainer

| What | Why | Where to click |
|---|---|---|
| Skills `full-stop`, `file-pr`, `modernize`, `babysit-pr` (outside the repo), before any package is sent | they ask for "branch is up to date with `develop`" and merge `develop` in before every hand-over: every fourth pull-request commit | where you keep your skills (claude.ai → Settings → Capabilities → Skills → the skill → edit): change the gate to "GitHub reports the pull request mergeable (no conflict)"; `babysit-pr`: no push to restart CI; wording: `docs/PROMPT-TEMPLATES.md#git`. Without editing skills: on your word a chat puts the rule into root `CLAUDE.md`, which outranks them |
| Runner limit | 20 jobs at once, reached 22 % of the time; GitHub Pro allows 40 | github.com → profile picture → Settings → Billing and licensing → Plans and usage |
| Nightly run | `nightly.yml`, `full-ci.yml` and `change-note.yml` are on `develop` only; scheduled workflows fire from `main` | next release merge `develop` → `main`; then Actions → Nightly → Run workflow once |
| Required checks (optional) | candidates: `Web (lint, types, unit, E2E)`, `Secret scan (gitleaks)`, `Change note present`; leave "Require branches to be up to date" off, it would force the merges this round removes | repository → Settings → Rules → Rulesets → ruleset of `develop` → Require status checks to pass |

## Package 1 – `develop` runs

```
# Aufgabe: CI Runde 3, Paket 1 – develop-Läufe: Überholtes nicht zu Ende testen, Rest-E2E nur für den neuesten Stand

Routing: Claude Code · CI Runde 3 Paket 1 · Fable (Abwägung: was darf auf develop später oder gar nicht laufen, ohne dass ein roter Commit unbemerkt bleibt)
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `ci/develop-load` von frischem `develop`. Vorgegebene Session-Branches ignorieren. Hotspot `.github/workflows/ci.yml`: Zeile in docs/CHATS.md vor dem ersten Commit.

## Ausgangslage
docs/perf/CI-2026-11.md (Diagnose, Hebel „`develop`“): 90 Pushes auf develop in 42 h, ein Voll-Lauf will 35 Jobs und 152 Runner-Minuten, das Konto hat 20 Runner. 28 Läufe liefen zu Ende, obwohl ein neuerer Push wartete (2709 Runner-Minuten); das Rest-E2E allein kostet 56 Minuten je Lauf (2742 gesamt). Lies docs/howto/ci-layout.md („Concurrency“: Läufe auf develop werden nie abgebrochen; „Dev-Preview“, „Never lost“), docs/decisions/meta-ci-docs.md (Bullet „The Dev-Preview gate is the fast part of CI“, 2026-11-04), `.github/workflows/ci.yml` ganz (Kommentar an `concurrency`).

## Erst fragen (ein AskUserQuestion, Empfehlung zuerst; vorher nichts ändern)
1. Dürfen auf einem überholten develop-Lauf die Jobs außerhalb des Dev-Preview-Gates abgebrochen werden (Empfohlen: ja)? Das schränkt die Regel „Läufe auf develop werden nie abgebrochen“ (docs/howto/ci-layout.md „Concurrency“) ein. Oder: alles lassen.
2. Rest-E2E nur für den neuesten Stand (Empfohlen) oder weiter für jeden gestarteten Lauf.

## Pflichtliste (nach Svens Ja)
- Gruppen und Job-`concurrency` für `main`, `workflow_dispatch` und den nächtlichen Lauf bleiben ohne Abbruch; nur `push` auf `develop` ändert sich.
- Heute hält die Workflow-Gruppe (`ci-…-push-refs/heads/develop`, kein Abbruch) einen neueren Lauf zurück, bis der ältere fertig ist; Job-Gruppen greifen erst danach. Die Gruppe für develop-Pushes muss sich also ändern (z. B. je Lauf), damit ein neuerer Lauf starten kann; Job-`concurrency` mit `cancel-in-progress` bekommen nur die Jobs **außerhalb** des Dev-Preview-Gates: Rest-E2E, Seed, Sync, Extension, kleine Pakete, Stimulus, lokales Modell, Windows-Shell. Die Gate-Jobs (gitleaks, Lizenzen, Static, Unit, Smoke, `rust`) und Dev-Preview-Build/-Publish eines gestarteten Laufs laufen zu Ende – veröffentlicht wird nur von grünem Gate (für sie bleibt „nie abgebrochen“). Zwei Dev-Preview-Publishes dürfen sich nicht überholen: eigene Gruppe ohne Abbruch für den Publish, und der Publish prüft vorher, dass sein Commit neuer ist als der zuletzt veröffentlichte (`+<sha7>` im Release-Namen ist Vorfahre des eigenen Commits) – sonst überspringt er sich, damit ein älterer Lauf den Preview nie zurückdreht. Alternative, falls das nicht sauber geht: ein überholter Commit bekommt gar keinen Preview – dann als Frage an Sven mit Empfehlung.
- Rest-E2E (8 Shards) nur für den neuesten Stand: kein Lauf startet es für einen Commit, der schon überholt ist. Wenn `nightly.yml` auf `main` aktiv ist (prüfen: `gh api repos/SGNemo/schweizer-taschenmesser/actions/workflows`), zusätzlich vorschlagen, ob das Rest-E2E je Push bleibt oder stündlich gebündelt wird – als Frage an Sven mit Empfehlung, nicht selbst entscheiden.
- Kein Commit geht ungetestet durch: nach einer Kette überholter Läufe testet der letzte Lauf alles; ein roter Lauf nennt im Job-Summary die Commits seit dem letzten grünen Voll-Lauf (`git log <letzter grüner>..HEAD --oneline`), damit der Verursacher findbar ist.
- Die Regel „welcher Stand seit dem letzten veröffentlichten Dev-Preview“ im Job `changes` bleibt.
- docs/howto/ci-layout.md („Concurrency“) und die Tabelle in docs/HOW-TO.md auf den neuen Stand; neues Entscheidungs-Bullet in docs/decisions/meta-ci-docs.md (die Regel stand bisher nur in howto/ci.md und im Workflow-Kommentar).

## Nicht in diesem Paket
`dev-preview.yml`, `release.yml`, Signing, gitleaks, Artefakt-Audit, Branch-Schutz; der PR-Umfang (Smoke-Liste); Caches und Builds (Paket 2); CodeQL (Paket 3).

## Abnahme
- Im PR: `node scripts/ci/measure.mjs --runs 1000` als Vorher-Zahl (erster Schritt, siehe „Order“) und der Probelauf unten.
- Nachmessung (dieser Chat per Check-in oder der nächste CI-Chat, drei Tage nach dem Merge): „Overtaken by a newer push, but not cancelled“ für CI/develop von 2709 auf unter 800 Runner-Minuten je 42 h (die Gate-Jobs laufen weiter); Push → grün Median etwa 1 min, p90 etwa 3 min kürzer als die Vorher-Zahl. Wartezeiten unter 5 min brauchen zusätzlich das Runner-Limit und weniger Merge-Pushes – nicht Ziel dieses Pakets.
- Ein Probelauf mit zwei schnellen Pushes auf einem Test-Branch mit derselben Gruppen-Logik (oder `workflow_dispatch`), im PR-Text verlinkt: der ältere Lauf bricht seine Jobs außerhalb des Gates ab; Gate und Dev-Preview-Teil laufen zu Ende.
- `npm run check:docs`; Label `no-changelog`; Ratchet-Treffer im PR-Text nennen und auf Svens Signatur warten.

## Skills
`council` vor dem PR (Guardian: kein Commit ungetestet, Dev-Preview nur von grünem Gate, Signing/gitleaks/Audit unberührt, kein Release- oder main-Lauf wird je abgebrochen; Architect: Gruppen-Logik ohne Wettlauf, ersetzte Läufe verlieren keinen Stand, ein älterer Publish dreht den Preview nie zurück; Advocate: ein roter develop-Lauf sagt, wer dran ist). `full stop`.
```

## Package 2 – install once

```
# Aufgabe: CI Runde 3, Paket 2 – einmal installieren statt in jedem Job

Routing: Claude Code · CI Runde 3 Paket 2 · Opus (mechanischer Umbau mit klarer Messzahl)
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `ci/install-build-once` von frischem `develop`, erst nach Paket 1. Vorgegebene Session-Branches ignorieren. Hotspot `.github/workflows/ci.yml`: Zeile in docs/CHATS.md.

## Ausgangslage
docs/perf/CI-2026-11.md (Hebel „`npm ci` once per run“): `npm ci` läuft in 2719 Jobs je 42 h, zusammen 1969 Minuten (im Schnitt 0,7 min, Median 0,8 bis 1,1 min in den Unit- und E2E-Jobs, trotz npm-Cache-Treffer). Ein gemeinsamer Build als Artefakt wurde am 2026-11-06 verworfen (docs/decisions/meta-ci-docs.md, „E2E speed“: der Build dauert 6 s) – nicht Teil dieses Pakets.

## Pflichtliste
- `node_modules` von `web/` als Cache mit dem Hash von `web/package-lock.json`, Node-Version und Runner-Image im Schlüssel (eine zusammengesetzte Action `.github/actions/web-install`): Treffer → kein `npm ci`; kein Treffer → `npm ci`. Gespeichert wird nur auf Pushes nach develop/main und in Voll-Läufen mit dem Label `full-ci` (sonst `actions/cache/restore`): Caches sind je Branch getrennt, das Repo hat 10 GB, und PR-Einträge von mehreren hundert MB würden die Rust-/Windows-Caches verdrängen, von denen Releases leben (docs/howto/ci-layout.md „Windows release cache“). Cache-Größe im PR-Text nennen. Kein `restore-keys` (nie ein fremder Stand). Postinstall-Ergebnisse müssen im Cache liegen; vergleiche `npm ls --all` und einen Hash über `node_modules/.package-lock.json` zwischen Cache-Treffer und frischem `npm ci`.
- Dieselbe Action in allen Jobs, die `web/` installieren (Static, Unit, alle E2E-Jobs, Stimulus, Sync, Extension); die kleinen Pakete nur, wenn die Messung dort mehr als 0,3 min je Job zeigt.
- docs/howto/ci-layout.md („Caches“) aktualisieren.

## Nicht in diesem Paket
gitleaks bleibt ohne Cache (Entscheidung), ein gemeinsamer E2E-Build (verworfen 2026-11-06), Rust-Caches, `dev-preview.yml`, `release.yml`, Testumfang, Retries, Shard-Zahlen.

## Abnahme
- Im PR: ein Voll-Lauf mit dem Label `full-ci` speichert den Cache, der nächste Lauf auf dem Branch liest ihn: `node scripts/ci/measure.mjs --branch ci/install-build-once --top 6` zeigt im zweiten Lauf den Schritt „Install“ der E2E- und Unit-Jobs unter 0,3 min (vorher 0,8 bis 1,1) und mindestens 6 Runner-Minuten weniger als der erste Voll-Lauf desselben Branches.
- Nachmessung nach dem Merge (drei Tage): Runner-Minuten je PR-Lauf unter der Baseline, Push → grün etwa eine halbe Minute kürzer.
- Gleiche Testzahl je Job wie vorher (`Running N tests` in den Logs vergleichen, Zahlen im PR-Text).
- Ratchet-Treffer (Workflow, Action) im PR-Text; Label `no-changelog`; `npm run check:docs`.

## Skills
`review-loop`, dann `full stop`.
```

## Package 3 – CodeQL only where code changed

```
# Aufgabe: CI Runde 3, Paket 3 – CodeQL nur dort, wo sich Code geändert hat

Routing: Claude Code · CI Runde 3 Paket 3 · Fable (Sicherheits-Abwägung, kehrt eine Entscheidung vom 2026-11-04 teilweise um)
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `ci/codeql-scope` von frischem `develop`. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
docs/perf/CI-2026-11.md (Hebel „CodeQL“): auf jedem Push nach develop analysiert CodeQL Rust (90 Läufe × 13,1 min = 1186 Runner-Minuten in 42 h), auch bei Doku-Pushes; auf PRs ohne Rust startet der Rust-Zweig trotzdem einen Runner, um „nicht geprüft“ zu sagen (179 Läufe), dazu der Vorab-Job. Entscheidung heute (docs/decisions/meta-ci-docs.md, `codeql.yml`-Kommentar): „every push to develop … always analyse all three languages“. Der wöchentliche Lauf prüft nur `main`.

## Erst fragen (ein AskUserQuestion, Empfehlung zuerst)
1. Rust-Analyse auf develop nur, wenn der Push Rust berührt (Empfohlen) – dazu ein täglicher Voll-Scan von develop, sobald `nightly.yml` auf `main` liegt; bis dahin einmal je Tag der erste Push. Oder: alles lassen.
2. Doku-only-Änderungen (gleiche Liste wie `ignorable` in `ci.yml`) starten gar keine Analyse (Empfohlen) oder weiter JS/TS + Actions.

## Pflichtliste (nach Svens Ja)
- Der Vorab-Job liefert die Sprachliste als JSON, `analyze` nimmt sie als Matrix: kein Runner für einen Zweig, der nichts prüft. Eine leere Liste lässt den Workflow scheitern (Matrix ohne Einträge): `analyze` bekommt `if: needs.<vorab>.outputs.languages != '[]'`. Fällt der Vorab-Job aus oder ist die Spanne unlesbar: alle drei Sprachen (fail-open wie heute).
- Push auf develop: Spanne `github.event.before..github.sha`; ein Push ohne lesbare Spanne prüft alles.
- Kein Rust-Stand bleibt länger als einen Tag ungeprüft (täglicher Voll-Scan, siehe Frage 1); der wöchentliche Lauf und `workflow_dispatch` prüfen immer alles.
- Entscheidungs-Bullet in docs/decisions/meta-ci-docs.md (schränkt den vom 2026-11-04 ein), HOW-TO-Zeile „CodeQL“.

## Nicht in diesem Paket
Abfragen, Sprachen, `security-events`-Rechte, `ci.yml`, gitleaks.

## Abnahme
- Im PR: ein PR-Lauf mit Rust-Änderung und einer ohne, beide verlinkt: Rust wird geprüft bzw. „Analyze (rust)“ ist kein Job mehr.
- Nachmessung nach dem Merge (drei Tage, `node scripts/ci/measure.mjs --runs 1000`): CodeQL/develop von 1562 auf unter 500 Runner-Minuten je 42 h (rund 600 Minuten am Tag weniger).
- Ratchet-Treffer im PR-Text; Label `no-changelog`; `npm run check:docs`.

## Skills
`council` (Guardian: kein Code-Stand bleibt ungeprüft, fail-open; Architect: Matrix und Spannen-Logik; Advocate: im PR ist klar, was geprüft wurde). `full stop`.
```

## Package 4 – flaky tests

```
# Aufgabe: CI Runde 3, Paket 4 – wackelige Tests reparieren, Wiederholungen sichtbar machen

Routing: Claude Code · CI Runde 3 Paket 4 · Opus (Flake-Fixes nach Liste, je Test eine Ursache)
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `fix/ci-flakes` von frischem `develop`. Vorgegebene Session-Branches ignorieren. Zwei PRs: E2E (`fix/ci-flakes`), Unit + Rust (`fix/ci-flakes-unit`).

## Ausgangslage
Liste mit Datei:Zeile in docs/perf/CI-2026-11.md („Flaky tests“); frische Liste: `node scripts/ci/measure.mjs --runs 1000 --tests 150`. 14 von 200 PR-Läufen wurden wiederholt (12 bis 24 min Warten je Fall), 8 davon gewollt nach einem Ratchet-Label, etwa 5 wegen eines wackeligen Tests; `retries: 1` in `web/playwright.config.ts` versteckt weitere („Retried“ in der Tabelle).

## Pflichtliste
- Je Test der Liste: lokal reproduzieren (`npx playwright test <datei>:<zeile> --repeat-each=30 --workers=4`, Unit: `npx vitest run <datei> --retry=0` in einer Schleife, Rust: `cargo test <name> -- --test-threads=8` wiederholt), Ursache benennen (Uhr, Reihenfolge, fehlendes Warten auf einen Zustand, geteilter Zustand), Ursache beheben. Kein `waitForTimeout`, kein längeres Timeout, kein `test.fixme`/`skip`, kein zusätzlicher Retry.
- `web/e2e/calendar-drag.spec.ts:55` zuerst prüfen: Flake oder auf develop wirklich kaputt?
- `web/e2e/subscriptions-plus.spec.ts:78` und `web/e2e/phone-paths.spec.ts:367` waren sechs develop-Läufe lang rot, weil sie nicht im PR-Satz laufen: prüfen, ob sie heute grün sind; Vorschlag im PR-Text, ob eine der beiden Dateien in `SMOKE_FILES` gehört (nicht selbst eintragen: Ratchet-Treffer, Svens Entscheidung).
- Wiederholte Tests sichtbar machen, ohne den Retry zu ändern: der E2E-Schritt schreibt die „flaky“-Zeilen in das Job-Summary (zusätzlicher Reporter oder ein Schritt, der den Report liest). Das ist ein Workflow-/Konfig-Treffer: eigener kleiner PR nach Paket 2 (`ci.yml` ist Hotspot), im PR-Text nennen.

## Nicht in diesem Paket
`retries` ändern, Tests löschen oder abschwächen, Produktverhalten ändern (wenn ein Test einen echten Fehler zeigt: stoppen, im PR beschreiben).

## Abnahme
- Im PR: je Test 30 Wiederholungen grün, Befehl und Ergebnis im PR-Text; Ursache in einem Satz. Ziel: die 12 bis 24 Minuten Warten je Wiederholung fallen auf den betroffenen Commits weg.
- Nachmessung (Sven oder der nächste CI-Chat, eine Woche später): `node scripts/ci/measure.mjs --runs 1000 --tests 150` – kein Test der Liste mehr unter „retried“ oder „Green on re-run“; kein wiederholter PR-Lauf mehr, dessen roter Job kein Ratchet-Treffer war (vor Runde 3: etwa 5 von 200).
- `npm run check`, `npm test`, `npm run e2e` grün; Label `no-changelog`.

## Skills
`review-loop`, dann `full stop`.
```

## Package 5 – Dependabot spread over the week

```
# Aufgabe: CI Runde 3, Paket 5 – Dependabot über die Woche verteilen

Routing: Claude Code · CI Runde 3 Paket 5 · Opus (kleine mechanische Änderung)
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `ci/dependabot-spread` von frischem `develop`. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
docs/perf/CI-2026-11.md (Hebel „Dependabot“): alle 21 Einträge in `.github/dependabot.yml` feuern montags 05:00 (Europe/Berlin): 70 Läufe, 727 Runner-Minuten, bis zu 68 wartende Jobs in einer Stunde.

## Pflichtliste
- Einträge auf Montag bis Freitag 05:00 verteilen: Mo `web` + GitHub Actions (2), Di Cargo (4), Mi npm `server`, `mcp`, `packages/vault-core`, `extension` (4), Do npm `site`, `services/supporter-webhook`, `packages/supporter-codes`, `tools/supporter-cli` (4), Fr Gradle (5) + Docker/Compose (2). Gruppen, Labels, Ignore-Listen und Limits unverändert.

## Nicht in diesem Paket
Workflows, Auto-Merge, Versionssprünge selbst.

## Abnahme
- Im PR: Diff von `.github/dependabot.yml` zeigt nur geänderte `day`-Zeilen; höchstens sieben Einträge je Tag, alle 21 verteilt.
- Nachmessung am folgenden Montag (Sven oder der nächste CI-Chat): `node scripts/ci/measure.mjs --since <Montag>T03:00:00Z --until <Montag>T07:00:00Z` – höchstens 25 wartende Jobs (vorher 68); die Wartezeit der PR-Jobs nur als Information, sie hängt von den Chats ab, die dann laufen.
- Label `no-changelog`; `npm run check:docs`.

## Skills
`review-loop`, dann `full stop`.
```
