/**
 * Notifications the user answered ("Erledigt", or "Später" which hands over to a new one). Synced in
 * the settings scope `reminders` (next to the "Später" entries), so an answer on one device ends the
 * repeats on all devices. Older answers live device-local in `_meta` and are still read.
 */
import { z } from 'zod';
import { db } from '@/core/db/db';
import { getSettings, setSettings } from '@/core/settings/settings';
import { REMINDERS_SCOPE } from './snooze';

const KEY = 'reminders.acked';
const MAX = 200;
const meta = () => db.table<{ key: string; value: unknown }, string>('_meta');
const schema = z.object({ acked: z.array(z.string()).max(MAX) });

async function readLegacy(): Promise<string[]> {
  const value = (await meta().get(KEY))?.value;
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

async function read(): Promise<string[]> {
  const synced = (await getSettings(REMINDERS_SCOPE, schema, { acked: [] })).acked;
  return [...(await readLegacy()), ...synced];
}

export async function ackNotification(key: string): Promise<void> {
  const synced = (await getSettings(REMINDERS_SCOPE, schema, { acked: [] })).acked;
  if (!synced.includes(key))
    await setSettings(REMINDERS_SCOPE, { acked: [...synced, key].slice(-MAX) });
}

export async function isAcked(key: string): Promise<boolean> {
  return (await read()).includes(key);
}
