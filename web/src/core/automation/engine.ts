/**
 * The engine: an event comes in, every rule on that trigger is checked (conditions, loop guard,
 * limits), its actions run (or, in a dry run, only say what they would do) and one row goes to the
 * log. Events are handled one after the other, so limits and duplicates are exact.
 */
import { undoGroup } from '@/core/ai/write/commit';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { newBatchId } from '@/core/importer/batches';
import type { ModuleManifest } from '@/core/modules/types';
import { now } from '@/core/time/now';
import { today } from '@/core/time/now';
import { runActions, undoSideEffects } from './actions';
import { matches } from './conditions';
import { checkGuards, recordRun, type Refusal } from './guards';
import { appendLog, markUndone, type LogRow } from './log';
import { removeNotices } from './notices';
import { loadGuard, saveGuard } from './state';
import type { AutomationSettings } from './settings';
import { EXCLUDED_MODULES, type AutomationEvent, type Rule, type RunCause } from './types';

export interface EngineDeps {
  rules: () => Promise<Rule[]>;
  settings: () => Promise<Pick<AutomationSettings, 'enabled' | 'dryRun' | 'globalPerHour'>>;
  /** Enabled modules (the only ones rules may read or write). */
  manifests: () => readonly ModuleManifest[];
  /** All modules, to tell "disabled" from "unknown". */
  known?: () => readonly ModuleManifest[];
  database?: TaschenmesserDB;
}

/** The run that is writing right now; events that arrive meanwhile carry it as their cause. */
let active: RunCause | undefined;
export const currentCause = (): RunCause | undefined => active;

let chain: Promise<unknown> = Promise.resolve();
function enqueue<R>(fn: () => Promise<R>): Promise<R> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

const matchesTrigger = (rule: Rule, event: AutomationEvent): boolean =>
  rule.trigger.kind === 'event'
    ? rule.trigger.type === event.type
    : event.type === 'schedule.fire' && event.data.ruleId === rule.id;

/** Which refusals are worth a log line (a duplicate is the normal case, not news). */
const LOGGED_REFUSALS: readonly Refusal[] = ['loop', 'depth', 'limit', 'global-limit'];
const refusalLoggedAt = new Map<string, number>();

export interface RunReport {
  ruleId: string;
  result: LogRow['result'];
  reason?: Refusal;
  groupId?: string;
  actions: LogRow['actions'];
}

export function processEvent(event: AutomationEvent, deps: EngineDeps): Promise<RunReport[]> {
  if (event.moduleId && EXCLUDED_MODULES.includes(event.moduleId)) return Promise.resolve([]);
  return enqueue(async () => {
    const settings = await deps.settings();
    if (!settings.enabled) return [];
    const rules = (await deps.rules()).filter((r) => matchesTrigger(r, event));
    const reports: RunReport[] = [];
    for (const rule of rules) {
      if (!matches(rule.conditions, event)) continue;
      reports.push(await runRule(rule, event, deps, settings.dryRun, settings.globalPerHour));
    }
    return reports.filter((r) => r.result !== 'skipped' || r.reason !== 'duplicate');
  });
}

/** "Regel ausführen": runs one rule now with a synthetic occurrence, ignoring trigger and conditions. */
export function runRuleNow(rule: Rule, deps: EngineDeps, dryRun = false): Promise<RunReport> {
  return enqueue(async () => {
    const at = now();
    const event: AutomationEvent = { type: 'manual', key: `manual:${at}`, at, data: {} };
    const settings = await deps.settings();
    return runRule(rule, event, deps, dryRun || settings.dryRun, 0);
  });
}

async function runRule(
  rule: Rule,
  event: AutomationEvent,
  deps: EngineDeps,
  dryRun: boolean,
  globalPerHour: number,
): Promise<RunReport> {
  const database = deps.database ?? defaultDb;
  const at = now();
  // A dry run keeps its own books: it must neither use up the real limits nor the real occurrence.
  const id = dryRun ? `dry:${rule.id}` : rule.id;
  let guard = await loadGuard(database);
  const refusal = checkGuards(
    { id, limitPerHour: rule.limitPerHour },
    event,
    guard,
    at,
    dryRun ? 0 : globalPerHour,
  );
  const row = {
    at,
    ruleId: rule.id,
    ruleTitle: rule.title,
    trigger: event.type,
    eventKey: event.key,
    ...(event.title ? { eventTitle: event.title.slice(0, 120) } : {}),
    dryRun,
  };
  if (refusal) {
    const logKey = `${rule.id}|${refusal}`;
    if (LOGGED_REFUSALS.includes(refusal) && at - (refusalLoggedAt.get(logKey) ?? 0) > 3_600_000) {
      refusalLoggedAt.set(logKey, at);
      await appendLog({ ...row, result: 'skipped', reason: refusal, actions: [] }, database);
    }
    return { ruleId: rule.id, result: 'skipped', reason: refusal, actions: [] };
  }

  const groupId = newBatchId();
  const cause: RunCause = {
    runId: groupId,
    ruleIds: [...(event.cause?.ruleIds ?? []), rule.id],
    depth: (event.cause?.depth ?? 0) + 1,
  };
  guard = recordRun(guard, id, event.key, at, !dryRun);
  await saveGuard(database, guard, at);

  active = cause;
  let actions: LogRow['actions'];
  try {
    actions = await runActions({
      rule,
      event,
      groupId,
      at,
      today: today(),
      dryRun,
      manifests: deps.manifests(),
      known: (deps.known ?? deps.manifests)(),
      database,
    });
  } finally {
    active = undefined;
  }
  const failed = actions.some((a) => !a.ok);
  const result: LogRow['result'] = dryRun
    ? 'dry'
    : failed && actions.every((a) => !a.ok)
      ? 'error'
      : 'done';
  const wrote = !dryRun && actions.some((a) => a.ok);
  await appendLog({ ...row, result, ...(wrote ? { groupId } : {}), actions }, database);
  return { ruleId: rule.id, result, ...(wrote ? { groupId } : {}), actions };
}

/** Takes back everything one run did: entries (edited ones stay), notices, focus round, profile. */
export async function undoRun(
  groupId: string,
  deps: Pick<EngineDeps, 'manifests' | 'database'>,
): Promise<{ removed: number; kept: number }> {
  const database = deps.database ?? defaultDb;
  const r = await undoGroup(groupId, { manifests: deps.manifests(), database });
  await removeNotices({ groupId }, database);
  await undoSideEffects(groupId, database);
  await markUndone(groupId, database);
  return r;
}
