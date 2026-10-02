import type { AppMigration } from './appMigrations';

/** Every app migration, oldest first. Steps are added with the package that merges or retires a module. */
export const APP_MIGRATIONS: readonly AppMigration[] = [];
