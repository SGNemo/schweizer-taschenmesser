/**
 * The clock of the engine: schedule triggers ("Sundays 18:00") and the modules' state checks
 * (detectors: invoice due soon, stock below minimum, price changed). One tick per minute, a cursor
 * in `_meta` so a closed app catches up (at most 24 hours back) and nothing fires twice.
 */
import { db as defaultDb } from '@/core/db/db';
import { now, today } from '@/core/time/now';
import { currentCause, processEvent, type EngineDeps } from './engine';
import { readKv, writeKv } from './kv';
import { pruneLog } from './log';
import { pruneNotices } from './notices';
import type { AutomationEvent, Rule } from './types';

export const TICK_MS = 60_000;
export const DETECT_EVERY_MS = 10 * 60_000;
export const MAX_CATCH_UP_MS = 24 * 3_600_000;
const CURSOR = 'automation.cursor';
const DETECTED = 'automation.detected';

/** A state check of a module. Cheap, read-only, returns events with stable keys (one per occurrence). */
export type Detector = (ctx: { at: number; today: string }) => Promise<AutomationEvent[]>;

export interface TickDeps extends EngineDeps {
  detectors?: () => Promise<readonly Detector[]> | readonly Detector[];
}

/** Times a schedule rule is due in (from, to], local clock. Pure. */
export function scheduleOccurrences(
  trigger: { time: string; weekdays?: number[] },
  from: number,
  to: number,
): number[] {
  const out: number[] = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  const h = +trigger.time.slice(0, 2);
  const m = +trigger.time.slice(3);
  for (; day.getTime() <= to; day.setDate(day.getDate() + 1)) {
    if (trigger.weekdays?.length && !trigger.weekdays.includes(day.getDay())) continue;
    const at = new Date(day);
    at.setHours(h, m, 0, 0);
    if (at.getTime() > from && at.getTime() <= to) out.push(at.getTime());
  }
  return out;
}

export async function runTick(deps: TickDeps, at: number = now()): Promise<void> {
  const database = deps.database ?? defaultDb;
  const settings = await deps.settings();
  const last = await readKv<number>(database, CURSOR);
  await writeKv(database, CURSOR, at);
  if (!settings.enabled) return;
  const from = Math.max(last ?? at, at - MAX_CATCH_UP_MS);

  const rules = await deps.rules();
  for (const rule of rules) {
    if (rule.trigger.kind !== 'schedule') continue;
    for (const when of scheduleOccurrences(rule.trigger, from, at)) {
      await processEvent(scheduleEvent(rule, when), deps);
    }
  }

  const lastDetected = (await readKv<number>(database, DETECTED)) ?? 0;
  if (at - lastDetected >= DETECT_EVERY_MS && deps.detectors) {
    await writeKv(database, DETECTED, at);
    for (const detect of await deps.detectors()) {
      let events: AutomationEvent[] = [];
      try {
        events = await detect({ at, today: today() });
      } catch (e) {
        console.error('[automation] detector failed', e);
      }
      for (const event of events) await processEvent(event, deps);
    }
  }
  await pruneLog(at, database);
  await pruneNotices(at, database);
}

function scheduleEvent(rule: Rule, when: number): AutomationEvent {
  const cause = currentCause();
  return {
    type: 'schedule.fire',
    key: `schedule:${rule.id}:${when}`,
    at: when,
    data: { ruleId: rule.id },
    ...(cause ? { cause } : {}),
  };
}

/** Starts the tick (once now, then every minute and when the page comes back). Returns the stop function. */
export function startAutomationScheduler(deps: TickDeps): () => void {
  const tick = () => void runTick(deps).catch((e) => console.error('[automation] tick failed', e));
  const timer = setInterval(tick, TICK_MS);
  const onVisible = () => document.visibilityState === 'visible' && tick();
  document.addEventListener('visibilitychange', onVisible);
  tick();
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
