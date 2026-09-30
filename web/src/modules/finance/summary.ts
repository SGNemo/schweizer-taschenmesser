import { useLiveQuery } from 'dexie-react-hooks';
import { useModuleStates } from '@/core/modules/activation';
import { sumMinor } from '@/core/money';
import { useSettings } from '@/core/settings/settings';
import { endOfMonthStr, today } from '@/core/time/dates';
// Sanctioned cross-module read access (see CLAUDE.md): only the public.ts of these two modules.
import { sumOpenInvoices } from '@/modules/invoices/public';
import { listSubscriptionCharges } from '@/modules/subscriptions/public';
import { accountRepo, categoryRepo, transactionRepo } from './repo';
import { availability, balances, sortAccounts } from './logic';
import type { FinanceData } from './types';
import { settings } from './settings';

/** All finance data in one live query; personal-scale data volumes make this cheap. */
export function useFinanceData(): FinanceData | undefined {
  return useLiveQuery(async (): Promise<FinanceData> => {
    const [accounts, categories, txs] = await Promise.all([
      accountRepo.active().toArray(),
      categoryRepo.active().toArray(),
      transactionRepo.active().toArray(),
    ]);
    return { accounts: sortAccounts(accounts), categories, txs };
  }, []);
}

/**
 * What is really available: balance minus open invoices and subscription charges until the end
 * of the month. Parts of disabled modules (and of switched-off settings) are left out.
 */
export function useAvailability(totalBalance: number | undefined) {
  const states = useModuleStates();
  const [prefs] = useSettings('module.finance', settings.schema, settings.defaults);
  const useInvoices = Boolean(
    states?.invoices &&
    (prefs as { includeOpenInvoices?: boolean } | undefined)?.includeOpenInvoices,
  );
  const useSubs = Boolean(
    states?.subscriptions &&
    (prefs as { includeSubscriptions?: boolean } | undefined)?.includeSubscriptions,
  );

  const openInvoices = useLiveQuery(
    async () => (useInvoices ? sumOpenInvoices() : 0),
    [useInvoices],
  );
  const subscriptions = useLiveQuery(async () => {
    if (!useSubs) return 0;
    const day = today();
    return sumMinor(
      (await listSubscriptionCharges(day, endOfMonthStr(day))).map((c) => c.amountMinor),
    );
  }, [useSubs]);

  if (totalBalance === undefined || openInvoices === undefined || subscriptions === undefined)
    return undefined;
  return {
    ...availability(totalBalance, openInvoices, subscriptions),
    useInvoices,
    useSubs,
    /** True when something is actually deducted, i.e. "available" differs from the balance. */
    deducting: (useInvoices && openInvoices > 0) || (useSubs && subscriptions > 0),
  };
}

export function totalBalance(data: FinanceData | undefined): number | undefined {
  if (!data) return undefined;
  return sumMinor(balances(data.accounts, data.txs, today()).values());
}
