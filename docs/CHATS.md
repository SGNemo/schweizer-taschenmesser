# Chats – running work and hand-over

Several Claude chats work in parallel and only see each other through GitHub. `cd web && npm run chats:status` lists the other branches, their files and the overlap with yours. Source of truth for PRs is GitHub (`list_pull_requests`); this page adds topic, area and what waits on the maintainer. Notes between chats: root [CLAUDE.md](../CLAUDE.md) step 2. Last full review: 2026-11-10 ([meta/DOCS-DIET-2026-11.md](meta/DOCS-DIET-2026-11.md)).

**Keeping this page to one screen (budget 2 000 tokens, `check:docs`):**

- A row is about an **open** PR or an **open** decision. When the PR merges, the row goes: `nemo-merge` (or whoever merges) deletes it in the same breath, and every chat that edits this page deletes the rows whose PR is merged.
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
| [#542](https://github.com/SGNemo/schweizer-taschenmesser/pull/542) `ci/signing-release-split` (Draft, pausiert) | Secrets-Umzug in ein Release-Environment | vor dem Launch entscheiden; Repo-Secrets bis dahin unverändert |
| [#606](https://github.com/SGNemo/schweizer-taschenmesser/pull/606) Dependabot | Dev-Abhängigkeiten `web/` | mergen, wenn grün |

**Handtests:** alle in [MANUAL-TESTS.md](MANUAL-TESTS.md). Neu aus den letzten Merges: „Handtests aus gemergten PRs“ GM1–GM23, Fernsteuerung FB1–FB12 und R3–R7, Hauptthread N1a und H1–H7, Logo LG7, Heimnetz-Sync L9 a–c und L17.

**Entscheidungen** (Empfehlung in Klammern):

1. Übersicht ohne Daten springt je Laden um 0,18: hinnehmen oder das Raster erst nach allen Karten packen ([qa/round-6/STATUS.md](qa/round-6/STATUS.md)).
2. Pflicht-Check `Web` im `develop`-Ruleset (ja; heute beschreibt `decisions/meta.md` das Ruleset ohne ihn).
3. C27 „seit n Tagen“ app-weit als eigenes Paket (aus #496).
4. AE2 Muster im Kopf (A: nie hinter Text; der Kopf-Teil kommt mit 0b-2) und AE6 Bewegung auf der Website (faktisch ja seit #674; bitte bestätigen).
5. Website zeigt Listen und Budgets weiter als „optional“ (eigener kleiner Site-PR).
6. Browser-Erweiterung: Store oder Release-Zip.
7. `feat/remote-volume-keys` (Lautstärketasten am Handy) starten: auf Zuruf.
8. Unbeantwortete Fragen in gemergten PR-Texten, einmal durchsehen: #656 (`disk_delete`), #632, #566 („Was ging wohin?“ ohne „In Arbeit anzeigen“), #490, #492 (vier von fünf), #485 (Akzent-Varianten, Merkliste/Unterlagen gleicher Kopf), #489 (Titel der Unterlagen auf der Übersicht: nein).

**Handgriffe:**

- `ci.yml`-Patch aus dem PR-Text von #653 einspielen (`GITHUB_TOKEN` nur am Ratschen-Schritt; steht heute im Job-`env` von `stimulus-budget`).
- `nemo-merge` aus der JSON neu anlegen, Wegwerf-PR mit echter Signatur, Probelauf `ratchet.mjs --pr` (auf Dezember verschoben, `decisions/meta.md`).
- Nachrichten an A, B, C, D aus `docs/qa/round-5/<x>/MESSAGE.md` mit Dev-Preview-Link schicken.
- Chats starten: `fix/ui6-head-heights` (U41), `fix/ui6-followups`; nach 0b-8: Website Runde 5 Paket 1 und alle Bildschirmfotos (README, Website, Social-Preview) neu.
- L9 b: Zeit bis zum Einfrieren in `design/sync-lan/CONCEPT.md` §9 nachtragen.

## Läuft gerade (Running work)

| Topic | Branch | Area / files | State | Updated |
| --- | --- | --- | --- | --- |
| UI-Audit 4.0, Paket 0b-2 Kopf und Navigation | `feat/ui4-0b-2-head-nav` (#688, Draft) | `web/src/layout/**`, module heads, `.changes/` | in work | 2026-11-10 |
| Fernsteuerung: Latenzmessung | `feat/remote-latency-probe` (#690) | `web/src/core`, `docs/design/remote-control` | PR open | 2026-11-10 |
| Docs-Diät: Markdown kürzen, Startkosten senken | `docs/diet-2026-11` | `CLAUDE.md`, area `CLAUDE.md`, `docs/**` (no HOW-TO CI table), `scripts/docs/` | in work | 2026-11-10 |

Add your row in the **first commit** of your branch, remove it in the **last commit** of your PR. On a merge conflict here keep both rows. Agent threads of one session share one row.

## Hotspots (announce first)

| File / area | Rule |
| --- | --- |
| root `CLAUDE.md`, area `CLAUDE.md`, `docs/RULES.md` | only when a rule changes; own PR; Sven merges |
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
