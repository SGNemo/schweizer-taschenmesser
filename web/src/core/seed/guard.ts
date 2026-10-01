/**
 * Seed rows are device-local test data: sync and backup skip them (stable and dev builds alike, so
 * a seed row can never leak even if a stable build opens a database a dev build filled). Only the
 * Dev-Preview "Seed-Sync erlauben" switch lifts the sync part. The registry table `_seeds` is
 * written by the dev-only runner; here it is only read.
 */
import type { TaschenmesserDB } from '@/core/db/db';

export const SEED_TABLE = '_seeds';
/** `_meta` key of the dev switch that lets seed rows sync (default: off). */
export const SEED_SYNC_KEY = 'seed.sync';

export interface SeedRegistryRow {
  /** `<table>|<record id>` */
  id: string;
  table: string;
  rowId: string;
  batchId: string;
}

export const seedKey = (table: string, rowId: string): string => `${table}|${rowId}`;

export async function seedSyncAllowed(database: TaschenmesserDB): Promise<boolean> {
  const row = await database
    .table<{ key: string; value: unknown }, string>('_meta')
    .get(SEED_SYNC_KEY);
  return row?.value === true;
}

/** The subset of `pairs` ([table, id]) that is registered as seed data. */
export async function seededOf(
  database: TaschenmesserDB,
  pairs: readonly (readonly [string, string])[],
): Promise<Set<string>> {
  if (pairs.length === 0) return new Set();
  const keys = pairs.map(([t, id]) => seedKey(t, id));
  const found = await database.table<SeedRegistryRow, string>(SEED_TABLE).bulkGet(keys);
  return new Set(found.filter((r) => r !== undefined).map((r) => r!.id));
}

/** All seed record ids of one table. */
export async function seededIdsOfTable(
  database: TaschenmesserDB,
  table: string,
): Promise<Set<string>> {
  const rows = await database
    .table<SeedRegistryRow, string>(SEED_TABLE)
    .where('table')
    .equals(table)
    .toArray();
  return new Set(rows.map((r) => r.rowId));
}
