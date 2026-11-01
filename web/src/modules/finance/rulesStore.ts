/** The rules of the bank import, kept on this device (`_meta`, not synced). */
import { getMeta, setMeta } from '@/core/db/metaKv';
import type { BankRule, RuleProposal } from './rules';

export const BANK_RULES_KEY = 'finance.rules';
const MAX_RULES = 200;

function clean(value: unknown): BankRule[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is BankRule =>
      typeof r === 'object' &&
      r !== null &&
      typeof (r as BankRule).id === 'string' &&
      typeof (r as BankRule).match === 'string' &&
      (r as BankRule).match !== '',
  );
}

export async function loadRules(): Promise<BankRule[]> {
  return clean(await getMeta<unknown>(BANK_RULES_KEY));
}

/** Stores the confirmed proposals as rules; a pattern that already has a rule is left alone. */
export async function addRules(proposals: readonly RuleProposal[]): Promise<BankRule[]> {
  const rules = await loadRules();
  for (const p of proposals) {
    if (rules.some((r) => r.match === p.match)) continue;
    rules.push({
      id: `rule-${p.match.replace(/ /g, '-')}`,
      match: p.match,
      ...(p.categoryId ? { categoryId: p.categoryId } : {}),
      ...(p.subscriptionId ? { subscriptionId: p.subscriptionId } : {}),
    });
  }
  const next = rules.slice(-MAX_RULES);
  await setMeta(BANK_RULES_KEY, next);
  return next;
}

export async function removeRule(id: string): Promise<void> {
  await setMeta(
    BANK_RULES_KEY,
    (await loadRules()).filter((r) => r.id !== id),
  );
}
