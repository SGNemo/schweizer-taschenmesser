/**
 * Small device-local values in `_meta` (never synced) for modules, which may not import the Dexie
 * database themselves: remembered column mappings, rules of the bank import, "already told" flags.
 * Keys are `<module>.<name>`; the value must be JSON-like.
 */
import { db } from './db';

const table = () => db.table<{ key: string; value: unknown }, string>('_meta');

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await table().get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await table().put({ key, value });
}
