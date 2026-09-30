/** Device-local connector status (`_meta`, never synced). */
import { useLiveQuery } from 'dexie-react-hooks';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { DISCONNECTED, type ConnectorStatus } from './types';

const key = (id: string) => `connector.${id}`;
const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

export async function loadStatus(
  id: string,
  database: TaschenmesserDB = defaultDb,
): Promise<ConnectorStatus> {
  const value = (await meta(database).get(key(id)))?.value as Partial<ConnectorStatus> | undefined;
  return { ...DISCONNECTED, ...value, features: value?.features ?? [] };
}

export async function saveStatus(
  id: string,
  patch: Partial<ConnectorStatus>,
  database: TaschenmesserDB = defaultDb,
): Promise<ConnectorStatus> {
  const next = { ...(await loadStatus(id, database)), ...patch };
  await meta(database).put({ key: key(id), value: next });
  return next;
}

export async function clearStatus(
  id: string,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await meta(database).delete(key(id));
}

export function useConnectorStatus(id: string): ConnectorStatus | undefined {
  return useLiveQuery(() => loadStatus(id), [id]);
}

/** Small device-local key/value store for sync bookkeeping (sync tokens, selected calendars …). */
export async function getLocal<T>(
  name: string,
  database: TaschenmesserDB = defaultDb,
): Promise<T | undefined> {
  return (await meta(database).get(name))?.value as T | undefined;
}

export async function setLocal(
  name: string,
  value: unknown,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  if (value === undefined) await meta(database).delete(name);
  else await meta(database).put({ key: name, value });
}

export async function deleteLocalPrefix(
  prefix: string,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await meta(database).where('key').startsWith(prefix).delete();
}
