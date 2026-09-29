import { loadModuleStates } from '@/core/modules/activation';
import { formatMoney, sumMinor } from '@/core/money';
import { getSettings } from '@/core/settings/settings';
import type { AiComputedResult } from '@/core/modules/types';
import { endOfMonthStr } from '@/core/time/dates';
import { t } from '@/strings';
// Sanctioned cross-module read access (see CLAUDE.md), same as summary.ts.
import { sumOpenInvoices } from '@/modules/invoices/public';
import { listSubscriptionCharges } from '@/modules/subscriptions/public';
import { availability, balances, sortAccounts } from './logic';
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
  const total = sumMinor(perAccount.values());

  const useInvoices = Boolean(states.invoices && prefs.includeOpenInvoices);
  const useSubs = Boolean(states.subscriptions && prefs.includeSubscriptions);
  const invoices = useInvoices ? await sumOpenInvoices() : 0;
  const subs = useSubs
    ? sumMinor(
        (await listSubscriptionCharges(ctx.today, endOfMonthStr(ctx.today))).map(
          (c) => c.amountMinor,
        ),
      )
    : 0;
  const avail = availability(total, invoices, subs);

  const lines = [
    ...(accounts.length > 1
      ? accounts.map((a) => ({ label: a.name, value: formatMoney(perAccount.get(a.id) ?? 0) }))
      : []),
    { label: t.finance.balance, value: formatMoney(total) },
  ];
  if (invoices > 0 || subs > 0) {
    if (invoices > 0)
      lines.push({ label: t.ai.computed.openInvoices, value: formatMoney(invoices) });
    if (subs > 0) lines.push({ label: t.ai.computed.subsUntilMonthEnd, value: formatMoney(subs) });
    lines.push({ label: t.finance.available, value: formatMoney(avail.available) });
  }
  return { title: t.finance.title, lines };
}
