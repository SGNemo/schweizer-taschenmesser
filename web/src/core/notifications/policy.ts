/**
 * Calm notification policy: quiet hours for automatic extras and a limit per hour. Pure functions
 * (no clock, no storage), applied centrally so every channel (in-app, Android schedule, Web Push)
 * behaves the same. Rules: docs/design/FOCUS-GUIDELINES.md → notification limits.
 */
import type { DueNotification } from '@/core/modules/types';

/** "Stumm": a pause that began at `from` and ends at `until` (epoch ms). */
export interface Mute {
  from: number;
  until: number;
}

export interface Policy {
  /** Quiet hours as 'HH:mm'; absent = none. They may wrap midnight (22:00 → 07:00). */
  quiet?: { from: string; to: string };
  /** At most this many per hour; 0 = unlimited. */
  maxPerHour: number;
  /** A running "Stumm" pause; absent = none. */
  mute?: Mute;
  /** Game mode on a device without a tone (Android, PWA): everything arrives on the quiet channel. */
  quietAll?: boolean;
}

const minutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function minuteOfDay(at: number): number {
  const d = new Date(at);
  return d.getHours() * 60 + d.getMinutes();
}

/** `…:r3` = third repeat of an unanswered reminder ("Ruhige Erinnerungen"). */
const REPEAT_RE = /:r\d+$/;
export const isRepeatKey = (key: string): boolean => REPEAT_RE.test(key);

/** The reminder an extra notification (`…:s60` stage, `…:f` old follow-up, `…:r2` repeat) belongs to. */
export const baseKey = (key: string): string => key.replace(/:(s\d+|f|r\d+)$/, '');

/**
 * After a long pause (app closed, device off) a whole series may be overdue at once. Only the latest
 * of a reminder and its repeats is shown then, so reopening the app never plays back a pile of
 * "Noch offen". Everything else passes unchanged.
 */
export function collapseRepeats(items: readonly DueNotification[]): DueNotification[] {
  const repeated = new Set(items.filter((n) => isRepeatKey(n.key)).map((n) => baseKey(n.key)));
  const latest = new Map<string, DueNotification>();
  for (const n of items) {
    const base = baseKey(n.key);
    if (!repeated.has(base) || /:s\d+$/.test(n.key)) continue;
    const seen = latest.get(base);
    if (!seen || n.at > seen.at) latest.set(base, n);
  }
  return items.filter((n) => {
    const base = baseKey(n.key);
    return !repeated.has(base) || /:s\d+$/.test(n.key) || latest.get(base) === n;
  });
}

export interface RepeatOptions {
  /** Minutes between two repeats. */
  everyMin: number;
  /** At most this many repeats; the last one says politely that it is the last. */
  max: number;
}

/**
 * The repeats of an unanswered reminder that fall into (from, to]: `…:r1` … `…:r<max>` every
 * `everyMin` minutes after the reminder. A pure time series: an answered reminder ("Erledigt" or
 * "Später") has no repeats, so the caller passes `answered` and the series ends at once. Quiet hours
 * and "Stumm" later drop single repeats (they count, they are not moved), see `applyQuiet`/`applyMute`.
 */
export function repeatSeries(
  base: Pick<DueNotification, 'key' | 'at' | 'url' | 'title'>,
  opts: RepeatOptions,
  answered: boolean,
  range: { from: number; to: number },
  text: (n: number, last: boolean) => { title: string; body?: string },
): DueNotification[] {
  if (answered || opts.everyMin < 1 || opts.max < 1) return [];
  const out: DueNotification[] = [];
  for (let n = 1; n <= opts.max; n++) {
    const at = base.at + n * opts.everyMin * 60_000;
    if (at <= range.from || at > range.to) continue;
    out.push({
      key: `${base.key}:r${n}`,
      at,
      url: base.url,
      baseTitle: base.title,
      soft: true,
      ...text(n, n === opts.max),
    });
  }
  return out;
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
  // A repeat in the night is dropped, not moved: no pile of "Noch offen" at seven in the morning.
  return items
    .filter((n) => !(isRepeatKey(n.key) && inQuiet(n.at, quiet)))
    .map((n) => (n.soft && inQuiet(n.at, quiet) ? { ...n, at: quietEnd(n.at, quiet) } : n));
}

/**
 * At most `max` notifications per local clock hour: the first `max - 1` stay, everything else of
 * that hour becomes one summary ("Weitere Erinnerungen · 3"). Nothing is lost, nothing floods.
 */
export function applyLimit(
  items: readonly DueNotification[],
  max: number,
  summary: (count: number, titles: string[]) => { title: string; body?: string },
): DueNotification[] {
  if (max <= 0) return [...items];
  const byHour = new Map<number, DueNotification[]>();
  for (const n of [...items].sort((a, b) => a.at - b.at)) {
    // Start of the local clock hour (not the UTC hour: half-hour zones would shift the cap).
    const bucket = new Date(n.at).setMinutes(0, 0, 0);
    byHour.set(bucket, [...(byHour.get(bucket) ?? []), n]);
  }
  const out: DueNotification[] = [];
  for (const [bucket, list] of byHour) {
    if (list.length <= max) {
      out.push(...list);
      continue;
    }
    // Repeats never push a first-time reminder of the same hour into the summary.
    list.sort((a, b) => Number(isRepeatKey(a.key)) - Number(isRepeatKey(b.key)));
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
      members: rest,
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * While muted nothing is lost and nothing the user set explicitly is held back: explicit
 * notifications in the pause still arrive, without sound (`quiet`); automatic extras (`soft`) wait
 * until the pause is over.
 */
const inMutedRepeat = (n: DueNotification, mute: Mute | undefined): boolean =>
  !!mute && isRepeatKey(n.key) && n.at >= mute.from && n.at < mute.until;

export function applyMute(
  items: readonly DueNotification[],
  mute: Mute | undefined,
): DueNotification[] {
  if (!mute) return [...items];
  // Repeats during the pause are dropped (the reminder itself still arrives, quietly).
  return items
    .filter((n) => !(isRepeatKey(n.key) && n.at >= mute.from && n.at < mute.until))
    .map((n) => {
      if (n.at < mute.from || n.at >= mute.until) return n;
      return n.soft ? { ...n, at: mute.until } : { ...n, quiet: true };
    });
}

/** Marks every notification quiet (no sound or vibration); nothing is moved or dropped. */
export function applyQuietAll(
  items: readonly DueNotification[],
  on: boolean | undefined,
): DueNotification[] {
  return on ? items.map((n) => (n.quiet ? n : { ...n, quiet: true })) : [...items];
}

/** De-duplicates by key (first wins), then quiet hours, the hourly limit, and last a running mute. */
export function applyPolicy(
  items: readonly DueNotification[],
  policy: Policy,
  summary: Parameters<typeof applyLimit>[2],
): DueNotification[] {
  const unique = new Map<string, DueNotification>();
  for (const n of items) if (!unique.has(n.key)) unique.set(n.key, n);
  // A repeat dropped by a pause never counts toward the hour's cap (same as a quiet-hour repeat).
  const unmuted = [...unique.values()].filter((n) => !inMutedRepeat(n, policy.mute));
  const limited = applyLimit(applyQuiet(unmuted, policy.quiet), policy.maxPerHour, summary);
  // Last, so the summary notification of a limited hour is silenced too.
  return applyQuietAll(applyMute(limited, policy.mute), policy.quietAll).sort(
    (a, b) => a.at - b.at,
  );
}
