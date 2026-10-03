/**
 * Notification centre logic (manual reminders). A reminder has no "done" state of its own, so "open"
 * is derived: everything that fell due in the last day (`collectDue`, same sources and calm policy as
 * the scheduler) minus what the user answered on this device ("Erledigt" or "Später").
 */
import { activeManifests } from '@/core/modules/contributions';
import { loadModuleStates } from '@/core/modules/activation';
import type { DueNotification } from '@/core/modules/types';
import { now as clockNow } from '@/core/time/now';
import { ackNotification, isAcked } from './ack';
import { collectDue } from './collect';
import { MAX_CATCH_UP_MS } from './scheduler';
import { snoozeNotification, type SnoozeOption } from './snooze';

/** `…:s60` (staged lead) and `…:f` (follow-up) belong to the base reminder. */
export const baseKey = (key: string): string => key.replace(/:(s\d+|f)$/, '');

/**
 * Open reminders, oldest first, one per base reminder (the latest stage wins). Pure: `acked`
 * holds the base keys the user answered.
 */
export function pickOpen(
  due: readonly DueNotification[],
  acked: ReadonlySet<string>,
): DueNotification[] {
  const byBase = new Map<string, DueNotification>();
  for (const n of due) {
    const base = baseKey(n.key);
    if (acked.has(base)) continue;
    const seen = byBase.get(base);
    if (!seen || n.at > seen.at) byBase.set(base, n);
  }
  return [...byBase.values()].sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}

/** The earliest open reminder ("Nächste Erinnerung"). */
export const nextOpen = (open: readonly DueNotification[]): DueNotification | undefined => open[0];

/** A random open reminder; `exceptKey` avoids showing the same one twice in a row when there is a choice. */
export function randomOpen(
  open: readonly DueNotification[],
  exceptKey?: string,
  random: () => number = Math.random,
): DueNotification | undefined {
  const pool = open.length > 1 ? open.filter((n) => n.key !== exceptKey) : open;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export async function loadOpen(at: number = clockNow()): Promise<DueNotification[]> {
  const due = await collectDue(
    { from: at - MAX_CATCH_UP_MS, to: at },
    activeManifests(await loadModuleStates()),
  );
  const acked = new Set<string>();
  for (const n of due) if (await isAcked(baseKey(n.key))) acked.add(baseKey(n.key));
  return pickOpen(due, acked);
}

/** The next reminder that has not fired yet (within a day), shown when nothing is open. */
export async function loadUpcoming(at: number = clockNow()): Promise<DueNotification | undefined> {
  const due = await collectDue(
    { from: at, to: at + MAX_CATCH_UP_MS },
    activeManifests(await loadModuleStates()),
  );
  return [...due].sort((a, b) => a.at - b.at)[0];
}

export const markDone = (n: Pick<DueNotification, 'key'>): Promise<void> =>
  ackNotification(baseKey(n.key));

export async function markAllDone(open: readonly DueNotification[]): Promise<void> {
  for (const n of open) await markDone(n);
}

/** "Später": a new reminder at the chosen time; the original leaves the open list. */
export async function snoozeOpen(n: DueNotification, option: SnoozeOption): Promise<void> {
  await snoozeNotification(n, option);
  await markDone(n);
}
