/**
 * Notifications the user answered ("Erledigt", or "Später" which hands over to a new one). Synced in
 * the settings scope `reminders` (next to the "Später" entries), so an answer on one device ends the
 * repeats on all devices. One field per answer (`ack:<key>` = time of the answer): the sync merges
 * fields independently, so two devices answering different reminders while offline lose nothing.
 * Answers older than three days are dropped on write (keys carry the date, they cannot match again).
 * Older answers live device-local in `_meta` and are still read.
 */
import { db } from '@/core/db/db';
import { ENVELOPE_KEYS } from '@/core/db/types';
import { settingsRepo } from '@/core/settings/settings';
import { now } from '@/core/time/now';
import { REMINDERS_SCOPE } from './snooze';

const LEGACY_KEY = 'reminders.acked';
const PREFIX = 'ack:';
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;
const envelope = new Set<string>(ENVELOPE_KEYS);
const meta = () => db.table<{ key: string; value: unknown }, string>('_meta');

async function readLegacy(): Promise<string[]> {
  const value = (await meta().get(LEGACY_KEY))?.value;
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

const row = async () =>
  (await settingsRepo.get(REMINDERS_SCOPE)) as Record<string, unknown> | undefined;

/** All answered keys (synced and legacy), read once per collection run. */
export async function loadAcked(): Promise<Set<string>> {
  const keys = new Set(await readLegacy());
  for (const field of Object.keys((await row()) ?? {}))
    if (field.startsWith(PREFIX)) keys.add(field.slice(PREFIX.length));
  return keys;
}

export async function ackNotification(key: string): Promise<void> {
  const at = now();
  const data = Object.fromEntries(
    Object.entries((await row()) ?? {}).filter(([field, value]) => {
      if (envelope.has(field)) return false;
      return !(field.startsWith(PREFIX) && typeof value === 'number' && value < at - KEEP_MS);
    }),
  );
  if (PREFIX + key in data) return;
  await settingsRepo.upsert(REMINDERS_SCOPE, { ...data, [PREFIX + key]: at });
}

export async function isAcked(key: string): Promise<boolean> {
  return (await loadAcked()).has(key);
}
