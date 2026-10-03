/** Device-local memory of notifications the user answered ("Erledigt"); stops the one follow-up. */
import { db } from '@/core/db/db';

const KEY = 'reminders.acked';
const MAX = 200;
const meta = () => db.table<{ key: string; value: unknown }, string>('_meta');

async function read(): Promise<string[]> {
  const value = (await meta().get(KEY))?.value;
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

export async function ackNotification(key: string): Promise<void> {
  const keys = await read();
  if (!keys.includes(key)) await meta().put({ key: KEY, value: [...keys, key].slice(-MAX) });
}

export async function isAcked(key: string): Promise<boolean> {
  return (await read()).includes(key);
}
