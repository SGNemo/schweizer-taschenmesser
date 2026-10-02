import type { AppMigration } from './appMigrations';

/**
 * Every app migration, oldest first. A step is added with the package that merges or retires a
 * module (recipe: `docs/howto/merge-retire-module.md`); once the old table has left the schema
 * the step goes too. The steps of 0.5.0–0.7.0 (shopping, packing, launcher, contracts, birthdays,
 * gifts, reminders) were removed with their tables in 0.9.0 – see `docs/decisions/modules.md`.
 */
export const APP_MIGRATIONS: readonly AppMigration[] = [];
