# Chats – running work and hand-over

Several Claude chats work in parallel and only see each other through GitHub. `cd web && npm run chats:status` lists the other branches, their files and the overlap with yours. Source of truth for PRs is GitHub (`list_pull_requests`); this page adds topic, area and what waits on the maintainer. Notes between chats: root [CLAUDE.md](../CLAUDE.md) step 2. Last full review: 2026-11-10 ([meta/DOCS-DIET-2026-11.md](meta/DOCS-DIET-2026-11.md)).

**Keeping this page to one screen (budget 2 000 tokens, `check:docs`):**

- A row is about an **open** PR or an **open** decision. A PR removes its own rows in its last commit (root CLAUDE.md step 2); every chat that edits this page also deletes the rows whose PR is merged.
- Hand tests never live here: they go into [MANUAL-TESTS.md](MANUAL-TESTS.md) with an id, in the PR that needs them.
- A decision that is answered becomes a bullet in `decisions/<area>.md`; its line here is deleted. Standing to-dos before the launch live in [STATUS](STATUS.md) "Offen – macht Sven", not here.
- No history, no "merged" rows, one line per item.

## Wartet auf Sven

**Offene PRs** (Stand 2026-11-10, sonst GitHub):

| PR | Was | Zu tun |
| --- | --- | --- |
| [#690](https://github.com/SGNemo/schweizer-taschenmesser/pull/690) `feat/remote-latency-probe` | Fernsteuerung: Latenzmessung mit echtem Handy (nur Dev-Preview), nötig vor der Seite Touchpad | mergen, einmal im WLAN messen |
| [#688](https://github.com/SGNemo/schweizer-taschenmesser/pull/688) `feat/ui4-0b-2-head-nav` (Draft) | UI-Audit 4.0, Paket 0b-2: Modulkopf als eine Titelzeile mit Reitern | läuft noch |
| [#553](https://github.com/SGNemo/schweizer-taschenmesser/pull/553) `chore/remove-scribble-folder` (Draft) | entfernt den alten Ordner `scribble/` (Notizen liegen im Notiz-Repo) | fertig machen lassen oder schließen; bis dahin liest `chats:status` ohne Klon des Notiz-Repos das alte Board |
| [#542](https://github.com/SGNemo/schweizer-taschenmesser/pull/542) `ci/signing-release-split` (Draft, pausiert) | Secrets-Umzug in ein Release-Environment | vor dem Launch entscheiden (Dev-Preview- und Dev-Keystore-Teil offen); Repo-Secrets bis dahin unverändert |
| [#606](https://github.com/SGNemo/schweizer-taschenmesser/pull/606) Dependabot | Dev-Abhängigkeiten `web/` | mergen, wenn grün |

**Handtests:** alle in [MANUAL-TESTS.md](MANUAL-TESTS.md). Neu aus den letzten Merges: „Handtests aus gemergten PRs“ GM1–GM23, Fernsteuerung FB1–FB12 und „Fernsteuerung, PC-Seite“ R3–R7, PC-Befehle ohne Hänger (Windows) N1a und H1–H7, Logo LG7, Heimnetz-Sync L9 a–c und L17.

**Entscheidungen** (Empfehlung in Klammern):

1. Übersicht ohne Daten springt je Laden um 0,18: hinnehmen oder das Raster erst nach allen Karten packen? (keine Empfehlung; [qa/round-6/STATUS.md](qa/round-6/STATUS.md))
2. Pflicht-Check `Web` im `develop`-Ruleset in GitHub eintragen? (ja; danach Bullet in `decisions/meta.md`)
3. Die Angabe „seit n Tagen“ überall in der App einheitlich machen: als eigenes Paket starten? (ja; Fund C27 aus der Abnahme #496)
4. Bestätigen: kein Muster hinter Text im Modulkopf (AE2, kommt mit 0b-2), und die Einblend-Bewegung auf der Website bleibt (AE6, seit #674 so gebaut)? (ja)
5. Die Website nennt Listen und Budgets noch „optional“ (`fresh` in `modules.json`): ändern? (ja, als eigener kleiner Site-PR)
6. Browser-Erweiterung: Store oder Release-Zip? (erst X1–X14 auf Hardware prüfen, dann entscheiden)
7. Unterlagen: Titel der Einträge auf der Übersicht zeigen, als Opt-in? (nein; aus #489)
8. Backup-Seite: „Was ging wohin?“ auch ohne „In Arbeit anzeigen“ zeigen? (keine Empfehlung; aus #566)
9. Merkliste und Unterlagen haben denselben Kopf: so lassen? Und: Akzent-Varianten gegen den festen 25°-Abstand der Modulfarben (keine Empfehlung; beides aus #485).
10. Weitere Fragen stehen nur in den PR-Texten unter „Open questions“ und sind von hier aus nicht zu beantworten: #656 (vor allem: darf `disk_delete` nur per Attribut `async` bleiben), #632, #490, #492 (Planer: Budget von `plan.md`, Seed-Widget-Test, Swipe-Clip, schema-history).

**Handgriffe:**

- `ci.yml`-Patch aus dem PR-Text von #653 einspielen (`GITHUB_TOKEN` nur am Ratschen-Schritt; steht heute im Job-`env` von `stimulus-budget`).
- `nemo-merge` aus `meta/agents-v3/nemo-merge.json` neu anlegen, Wegwerf-PR mit echter Signatur, Probelauf `ratchet.mjs --pr`, Treffer von #640/#642 nachträglich ansehen (zuerst `ratchet.mjs`; auf Dezember verschoben, `decisions/meta.md`).
- Agenten v3.1: `docs/meta/AGENTS.md` nennt jetzt die sieben Agenten; dazu gehören noch dein `ant apply` und ein Bullet in `decisions/meta.md` ([agents-v3/README.md](meta/agents-v3/README.md) „Switch-over“). Wenn v3.1 nicht gelten soll: Commit zu AGENTS.md zurücknehmen.
- Auf Zuruf starten: `feat/remote-volume-keys` (Lautstärketasten am Handy).
- Nachrichten an A, B, C, D aus `docs/qa/round-5/<x>/MESSAGE.md` mit Dev-Preview-Link schicken.
- Chats starten: `fix/ui6-head-heights` (U41), `fix/ui6-followups`; nach 0b-8: Website Runde 5 Paket 1 und alle Bildschirmfotos (README, Website, Social-Preview) neu.
- L9 b: Zeit bis zum Einfrieren in `design/sync-lan/CONCEPT.md` §9 nachtragen.

## Läuft gerade (Running work)

| Topic | Branch | Area / files | State | Updated |
| --- | --- | --- | --- | --- |
| UI-Audit 4.0, Paket 0b-2 Kopf und Navigation | `feat/ui4-0b-2-head-nav` (#688, Draft) | `web/src/layout/**`, module heads, `.changes/` | in work | 2026-11-10 |
| Fernsteuerung: Latenzmessung | `feat/remote-latency-probe` (#690) | `web/src/core`, `docs/design/remote-control` | PR open | 2026-11-10 |
| Lookup-Doku nach Themen teilen (MAP, decisions, ci, connectors, DATA-FLOWS) | `docs/split-lookup-docs` (+ `docs/split-decisions-1`, `-2`, `docs/split-howto-ci`) | `docs/ARCHITECTURE-MAP.md`, `docs/decisions/{core,ui-shell,modules,features,plan,meta,focus}.md`, `docs/howto/ci.md`, `docs/architecture/connectors.md`, `docs/legal/DATA-FLOWS.md` (nur verschieben) | in work | 2026-11-10 |

Add your row in the **first commit** of your branch, remove it in the **last commit** of your PR. On a merge conflict here keep both rows. Agent threads of one session share one row.

## Hotspots (announce first)

| File / area | Rule |
| --- | --- |
| root `CLAUDE.md`, area `CLAUDE.md`, `docs/RULES.md` | only when a rule changes; own PR; Sven merges (`meta/agents-v3/SHARED.md`) |
| `web/src/strings.ts` | append inside your module's block only; never reorder or reformat others |
| `web/src/core/modules/types.ts`, `core/modules/registry.ts` | manifest contract: one chat at a time (row here) |
| `web/src/core/platform/types.ts`, `core/platform/tauri/index.ts`, `core/platform/web.ts` | platform seam: one chat at a time |
| `web/src/ui/tokens.css` (+ `tokens.test.ts`) | token changes: one chat at a time |
| `web/package.json`, lock files, `web/src-tauri/Cargo.toml`/`Cargo.lock` | dependencies in a small separate commit; lock files regenerated by tools, never hand-merged |
| `core/db/schema.snapshot.json`, Dexie version | on conflict re-run `npm run db:bump` after merging `develop`; never hand-edit |
| `web/src/pages/Settings.tsx`, `layout/AppShell.tsx`, `router.tsx` | small edits, local to your section |
| images under `docs/` | none ([DOCS-GUIDE](meta/DOCS-GUIDE.md#images)); screenshots go into the PR text |
| `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/HOW-TO.md`, `docs/ARCHITECTURE-MAP.md`, `README.md` | touch only on real change; one line / one block, no reformatting |

## Hand-over conventions

- PR description = hand-over: **Done / Open / Next / How to verify**, links to files, no history.
- Unfinished work: push the branch, keep the row with State `paused – <what is missing>`, list open items in the PR.
- A problem outside your scope: note it in the PR text (or open an issue), do not fix it silently.
- Do not merge another chat's PR; do not push to another chat's branch.
- A decision that changes a root rule or a hotspot contract goes into `decisions/` in the same PR.
