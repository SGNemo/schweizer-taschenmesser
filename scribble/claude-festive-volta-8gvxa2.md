# claude/festive-volta-8gvxa2 (setup step core.migrate) – for the next chat:
- `core/setup/migrate.ts` owns the state, the point list (`MIGRATE_ITEMS`) and the pure `migrateItems`/`migrateOutcome`; add a new origin = one entry in `ORIGINS`, items, `TARGETS` in `MigrateStep.tsx`, strings in 5 languages.
- Points match batches by module only (any committed batch of the module newer than the choice); T2's OFX/QIF land in `finance` and are covered automatically.
- The Bitwarden tile closes the assistant and navigates to `/accounts?tools=1` (one additive param in `AccountsPage`); the vault import itself is untouched.
- `ChecklistCard` pins the "Umzug" row into the last of five slots; `check:i18n` needed `same-as-source.json` for "Obsidian / Markdown".
- Open: Google Takeout ZIP is not unpacked (no dependency); Android file picker not hand-tested.
