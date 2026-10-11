# Backup fixtures per release

One backup file per released app version, **invented data only**. `src/core/backup/releaseFixtures.test.ts` restores each one into the current schema and checks the counts.

- Made by `node scripts/gen-backup-fixtures.mjs` (needs the release tags: `git fetch --tags`). The table list comes from that tag's `schema.snapshot.json`; the row shapes from that tag's module schemas.
- Present: `v0.3.0-beta.1`, `v0.3.0`, `v0.3.1` (schema version 13 in all three).
- Not present: `v0.2.0-beta.1`, `v0.2.0-beta.2`, `v0.2.0` (decision of the maintainer: from 0.3.x on). There is no 1.0.0 yet.
- New release: add the tag to `RELEASES` in the script, run it, commit the JSON. If the module schemas changed since the last release, extend `FACTORIES` for the changed tables.
