/**
 * Calm notification policy: quiet hours for automatic extras and a limit per hour. Pure functions
 * (no clock, no storage), applied centrally so every channel (in-app, Android schedule, Web Push)
 * behaves the same. Rules: docs/design/FOCUS-GUIDELINES.md → notification limits.
 */
import type { DueNotification } from '@/core/modules/types';

const HOUR_MS = 3_600_000;

export interface Policy {
  /** Quiet hours as 'HH:mm'; absent = none. They may wrap midnight (22:00 → 07:00). */
  quiet?: { from: string; to: string };
  /** At most this many per hour; 0 = unlimited. */
  maxPerHour: number;
}

const minutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function minuteOfDay(at: number): number {
  const d = new Date(at);
  return d.getHours() * 60 + d.getMinutes();
}

export function inQuiet(at: number, quiet: { from: string; to: string }): boolean {
  const m = minuteOfDay(at);
  const from = minutes(quiet.from);
  const to = minutes(quiet.to);
  if (from === to) return false;
  return from < to ? m >= from && m < to : m >= from || m < to;
}

/** The next moment the quiet hours end at or after `at` (epoch ms). */
export function quietEnd(at: number, quiet: { from: string; to: string }): number {
  const to = minutes(quiet.to);
  const d = new Date(at);
  d.setHours(Math.floor(to / 60), to % 60, 0, 0);
  if (d.getTime() < at) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** Moves soft notifications out of the quiet hours; explicit ones stay where the user put them. */
export function applyQuiet(
  items: readonly DueNotification[],
  quiet: Policy['quiet'],
): DueNotification[] {
  if (!quiet) return [...items];
  return items.map((n) =>
    n.soft && inQuiet(n.at, quiet) ? { ...n, at: quietEnd(n.at, quiet) } : n,
  );
}

/**
 * At most `max` notifications per clock hour: the first `max - 1` stay, everything else of that hour
 * becomes one summary ("Weitere Erinnerungen · 3"). Nothing is lost, nothing floods.
 */
export function applyLimit(
  items: readonly DueNotification[],
  max: number,
  summary: (count: number, titles: string[]) => { title: string; body?: string },
): DueNotification[] {
  if (max <= 0) return [...items];
  const byHour = new Map<number, DueNotification[]>();
  for (const n of [...items].sort((a, b) => a.at - b.at)) {
    const bucket = Math.floor(n.at / HOUR_MS);
    byHour.set(bucket, [...(byHour.get(bucket) ?? []), n]);
  }
  const out: DueNotification[] = [];
  for (const [bucket, list] of byHour) {
    if (list.length <= max) {
      out.push(...list);
      continue;
    }
    const keep = Math.max(1, max - 1);
    const rest = list.slice(keep);
    out.push(...list.slice(0, keep));
    const text = summary(
      rest.length,
      rest.map((n) => n.title),
    );
    out.push({
      key: `summary:${bucket}:${rest.length}`,
      at: rest[0]!.at,
      title: text.title,
      body: text.body,
      url: '/',
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** De-duplicates by key (first wins), then quiet hours, then the hourly limit. */
export function applyPolicy(
  items: readonly DueNotification[],
  policy: Policy,
  summary: Parameters<typeof applyLimit>[2],
): DueNotification[] {
  const unique = new Map<string, DueNotification>();
  for (const n of items) if (!unique.has(n.key)) unique.set(n.key, n);
  return applyLimit(applyQuiet([...unique.values()], policy.quiet), policy.maxPerHour, summary);
}
