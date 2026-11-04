# Change notes and changelog

Data flow: `.changes/*.md` (one note per PR) → release step `npm run changelog:release -- <x.y.z>` → `CHANGELOG.md` (EN) + `CHANGELOG.de.md` + `web/src/generated/changelog.json` → app (Settings → Über Nemo → "Änderungen dieser Version", offline). Notes are deleted when processed. Commits no longer feed the changelog.

## Create a note (every PR, before opening it)

`npm run change` in `web/` (interactive), or by hand `.changes/<branch-or-slug>-<type>.md`; several entries per file, each its own `---` block:

```
---
type: fixed            # added | changed | fixed | removed | security | performance
area: calendar         # module or tool id, or app | home (alias overview) | ui | settings | sync | ai | backup | accessibility | automation | platform | tools
breaking: false
highlight: true        # optional: the 1–3 most important points of a release
pr: 123                # optional
de: Der Kalender zeigt Feiertage jetzt auch in der Jahresansicht.
en: The calendar now shows holidays in the year view as well.
---
```

`npm run check:changes` validates (type, area, both languages, ≤ 200 characters, one line). CI rule for PRs into `develop`: at least one new file in `.changes/` **or** the label `no-changelog` (docs, tests, CI only). New module/tool ids need a label in `AREAS` (`web/scripts/lib/changes.ts`; a test checks it).

## What belongs in a note

One sentence, from the user's view, no technology, no ticket jargon; say what changes for them.

- Good: "Todos haben jetzt Tags und eine Board-Ansicht." · "Fixed: the calendar no longer shows a holiday twice."
- Bad: "Refactor useCalendarStore", "feat(todos): add tags (#395)", "Improved performance" (what got faster?).
- Skip pure refactors, tests, docs and CI (use `no-changelog`).
- Breaking (`breaking: true`): data, format or version consequences the user must act on.

## Release (maintainer's release chat, in the release-branch step)

1. `npm run changelog:release -- 1.2.0` in `web/`: adds `## [1.2.0] – date` (Highlights, then by type; breaking first; area prefix) to both changelogs and the JSON, deletes the notes. `-beta.N` versions change nothing. `--dry` previews, `--notes` prints the GitHub release text (German above, English below).
2. The files belong to the release commit. `release.yml` then builds the GitHub release text with `node scripts/changelog-notes.mjs <x.y.z>` (the `## [x.y.z]` sections of `CHANGELOG.de.md` above `CHANGELOG.md`) and fails with a clear message when a section is missing.
3. Dev-Preview release text: `node scripts/changelog-release.mjs --unreleased` (open notes, nothing deleted).

CI: `.github/workflows/change-note.yml` (PRs into `develop`; own workflow so labelling does not re-run the heavy CI) runs `check-changes.mjs --pr`.

## Dev-Preview and the app

Previews (Dev channel, `-beta`/`-dev` versions, `npm run dev`) read the open `.changes/` at build time as "Unveröffentlicht" (`virtual:changelog`, `scripts/lib/changelogBuild.ts`); stable builds only embed released versions. The list shows the running version, then older ones folded; text German or English (other languages show English). "Neu" mark: device-local (`_meta` keys `changelog.seen`, `changelog.hint`), no pop-up, switchable.
