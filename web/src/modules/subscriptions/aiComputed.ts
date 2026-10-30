import { formatTotals } from '@/core/money';
import type { AiComputedResult } from '@/core/modules/types';
import { t } from '@/strings';
import { pickTotals, totalsByCurrency } from './logic';
import { subscriptionRepo } from './repo';

export default async function compute(name: string): Promise<AiComputedResult | undefined> {
  if (name !== 'costs') return undefined;
  const subs = await subscriptionRepo.active().toArray();
  const sum = totalsByCurrency(subs);
  return {
    title: t.subscriptions.title,
    lines: [
      { label: t.ai.computed.activeSubs, value: String(subs.filter((s) => s.active).length) },
      { label: t.ai.computed.perMonth, value: formatTotals(pickTotals(sum, 'monthly')) },
      { label: t.ai.computed.perYear, value: formatTotals(pickTotals(sum, 'yearly')) },
    ],
  };
}
