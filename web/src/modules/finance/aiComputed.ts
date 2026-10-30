import { loadModuleStates } from '@/core/modules/activation';
import { currencyOf, DEFAULT_CURRENCY, formatMoney, sumMinor } from '@/core/money';
import { getSettings } from '@/core/settings/settings';
import type { AiComputedResult } from '@/core/modules/types';
import { endOfMonthStr } from '@/core/time/dates';
import { t } from '@/strings';
// Sanctioned cross-module read access (see CLAUDE.md), same as summary.ts.
import { sumOpenInvoices } from '@/modules/invoices/public';
import { listSubscriptionCharges } from '@/modules/subscriptions/public';
import { availability, balances, currenciesOf, sortAccounts } from './logic';
import { accountRepo, transactionRepo } from './repo';
import { settings } from './settings';

/** Answers "Kontostand" style questions locally, honouring the same switches as the dashboard. */
export default async function compute(
  name: string,
  ctx: { today: string },
): Promise<AiComputedResult | undefined> {
  if (name !== 'balance') return undefined;
  const [accountRows, txs, states, prefs] = await Promise.all([
    accountRepo.active().toArray(),
    transactionRepo.active().toArray(),
    loadModuleStates(),
    getSettings('module.finance', settings.schema, settings.defaults),
  ]);
  const accounts = sortAccounts(accountRows);
  const perAccount = balances(accounts, txs, ctx.today);
  const currencies = currenciesOf(accounts);
  const many = currencies.length > 1;

  const useInvoices = Boolean(states.invoices && prefs.includeOpenInvoices);
  const useSubs = Boolean(states.subscriptions && prefs.includeSubscriptions);
  const subs = useSubs
    ? sumMinor(
        (await listSubscriptionCharges(ctx.today, endOfMonthStr(ctx.today))).map(
          (c) => c.amountMinor,
        ),
      )
    : 0;

  const lines: AiComputedResult['lines'] = [
    ...(accounts.length > 1
      ? accounts.map((a) => ({
          label: a.name,
          value: formatMoney(perAccount.get(a.id) ?? 0, currencyOf(a)),
        }))
      : []),
  ];
  for (const currency of currencies) {
    const group = accounts.filter((a) => currencyOf(a) === currency);
    const total = sumMinor(group.map((a) => perAccount.get(a.id) ?? 0));
    const invoices = useInvoices ? await sumOpenInvoices(currency) : 0;
    // Subscriptions are in euro only (for now).
    const subsHere = currency === DEFAULT_CURRENCY ? subs : 0;
    const suffix = many ? ` (${currency})` : '';
    lines.push({ label: `${t.finance.balance}${suffix}`, value: formatMoney(total, currency) });
    if (invoices > 0 || subsHere > 0) {
      if (invoices > 0)
        lines.push({
          label: `${t.ai.computed.openInvoices}${suffix}`,
          value: formatMoney(invoices, currency),
        });
      if (subsHere > 0)
        lines.push({
          label: `${t.ai.computed.subsUntilMonthEnd}${suffix}`,
          value: formatMoney(subsHere, currency),
        });
      lines.push({
        label: `${t.finance.available}${suffix}`,
        value: formatMoney(availability(total, invoices, subsHere).available, currency),
      });
    }
  }
  return { title: t.finance.title, lines };
}
