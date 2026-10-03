/**
 * "Später": a notification that was answered with a delay. The entries live in the synced settings
 * scope `reminders`, so "Am PC" works across devices: the entry fires once on the desktop app and is
 * removed there (and, by sync, everywhere). Pure helpers here, storage at the bottom.
 */
import { z } from 'zod';
import type { DueNotification } from '@/core/modules/types';
import type { PlatformKind } from '@/core/platform/types';
import { getSettings, setSettings } from '@/core/settings/settings';
import { now } from '@/core/time/now';

export const REMINDERS_SCOPE = 'reminders';
export const SNOOZE_OPTIONS = ['10min', '1h', 'evening', 'tomorrow', 'pc'] as const;
export type SnoozeOption = (typeof SNOOZE_OPTIONS)[number];

const MINUTE = 60_000;
/** Hour of day "Heute Abend" and the earliest hour after which it is no longer offered. */
const EVENING_HOUR = 18;
const TOMORROW_HOUR = 9;
const MAX_ENTRIES = 50;

const entrySchema = z.object({
  id: z.string(),
  until: z.number(),
  title: z.string(),
  body: z.string().optional(),
  url: z.string().optional(),
  /** Fire on the desktop app only ("Wenn ich am PC bin"). */
  desktopOnly: z.boolean().optional(),
});
export type SnoozeEntry = z.infer<typeof entrySchema>;
const schema = z.object({ snoozed: z.array(entrySchema).max(MAX_ENTRIES) });

/** When the option ends, given the current time (local clock). */
export function snoozeUntil(option: SnoozeOption, at: number): number {
  const d = new Date(at);
  switch (option) {
    case '10min':
      return at + 10 * MINUTE;
    case '1h':
      return at + 60 * MINUTE;
    case 'evening':
      d.setHours(EVENING_HOUR, 0, 0, 0);
      return d.getTime();
    case 'tomorrow':
      d.setDate(d.getDate() + 1);
      d.setHours(TOMORROW_HOUR, 0, 0, 0);
      return d.getTime();
    case 'pc':
      return at;
  }
}

/** The options that make sense right now: "Heute Abend" only before the evening, "Am PC" only away from it. */
export function snoozeOptions(at: number, platform: PlatformKind): SnoozeOption[] {
  return SNOOZE_OPTIONS.filter((o) => {
    if (o === 'evening') return new Date(at).getHours() < EVENING_HOUR - 1;
    if (o === 'pc') return platform !== 'desktop';
    return true;
  });
}

/** Entries due in (from, to] on this platform; "Am PC" entries fire at the next check on the desktop app. */
export function snoozedDue(
  entries: readonly SnoozeEntry[],
  range: { from: number; to: number },
  platform: PlatformKind,
): DueNotification[] {
  return entries.flatMap((e) => {
    if (e.desktopOnly) {
      return platform === 'desktop' && e.until <= range.to
        ? [{ key: `snooze:${e.id}`, at: range.to, title: e.title, body: e.body, url: e.url }]
        : [];
    }
    return e.until > range.from && e.until <= range.to
      ? [{ key: `snooze:${e.id}`, at: e.until, title: e.title, body: e.body, url: e.url }]
      : [];
  });
}

/* --------------------------------- storage (synced) --------------------------------- */

export async function getSnoozed(): Promise<SnoozeEntry[]> {
  return (await getSettings(REMINDERS_SCOPE, schema, { snoozed: [] })).snoozed;
}

const save = (snoozed: SnoozeEntry[]) => setSettings(REMINDERS_SCOPE, { snoozed });

export async function snoozeNotification(
  n: { key: string; title: string; body?: string; url?: string },
  option: SnoozeOption,
  at: number = now(),
): Promise<SnoozeEntry> {
  const until = snoozeUntil(option, at);
  const entry: SnoozeEntry = {
    id: `${n.key}@${until}`,
    until,
    title: n.title,
    ...(n.body ? { body: n.body } : {}),
    ...(n.url ? { url: n.url } : {}),
    ...(option === 'pc' ? { desktopOnly: true } : {}),
  };
  // Entries of the past day are dropped on every write; the list stays small.
  const keep = (await getSnoozed()).filter(
    (e) => e.id !== entry.id && (e.desktopOnly || e.until > at - 24 * 60 * MINUTE),
  );
  await save([...keep, entry].slice(-MAX_ENTRIES));
  return entry;
}

/** Removes an entry once it was shown (`snooze:<id>` keys are accepted too). */
export async function removeSnoozed(idOrKey: string): Promise<void> {
  const id = idOrKey.replace(/^snooze:/, '');
  const all = await getSnoozed();
  if (all.some((e) => e.id === id)) await save(all.filter((e) => e.id !== id));
}
