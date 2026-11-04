/**
 * What the UI asks of the engine: switch changes take effect now, run a rule by hand, take back
 * the last run, try all rules without writing. Thin on purpose; the logic lives in the engine.
 */
import { listLog } from './log';
import { runRuleNow, undoRun } from './engine';
import { getLiveDeps } from './start';
import type { Rule } from './types';

/** After a settings change: re-read settings and modules now instead of at the next tick. */
export async function applyAutomationSettings(): Promise<void> {
  await getLiveDeps().refresh();
}

/** "Regel ausführen": one rule now, for real unless `dryRun`. Undefined when the rule is not on. */
export async function runRuleById(ruleId: string, dryRun = false) {
  const deps = getLiveDeps();
  await deps.refresh();
  const rule = (await deps.rules()).find((r) => r.id === ruleId);
  return rule ? runRuleNow(rule, deps, dryRun) : undefined;
}

/** Every rule that is on, tried without writing anything. Returns how many rules were checked. */
export async function dryRunAll(): Promise<number> {
  const deps = getLiveDeps();
  await deps.refresh();
  const rules: Rule[] = await deps.rules();
  for (const rule of rules) await runRuleNow(rule, deps, true);
  return rules.length;
}

/** Takes back the newest run that wrote something and was not taken back yet. */
export async function undoLastRun(): Promise<{ removed: number; kept: number } | undefined> {
  const last = (await listLog(100)).find((row) => row.groupId && !row.undone);
  if (!last?.groupId) return undefined;
  const deps = getLiveDeps();
  await deps.refresh();
  return undoRun(last.groupId, deps);
}

/** Takes back one run (the log's "Rückgängig"). */
export async function undoRunById(groupId: string): Promise<{ removed: number; kept: number }> {
  const deps = getLiveDeps();
  await deps.refresh();
  return undoRun(groupId, deps);
}
