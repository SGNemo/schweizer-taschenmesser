import { currencyOf, formatMoney, sumMinor } from '@/core/money';
import type { HeadlineFigure } from '@/core/modules/types';
import { t } from '@/strings';
import { balances, currenciesOf, sortAccounts } from './logic';
import { accountRepo, transactionRepo } from './repo';

/** The cockpit's large figure: the balance of all accounts (first currency), with the account count as context. */
export default async function headline(ctx: {
  today: string;
}): Promise<HeadlineFigure | undefined> {
  const [accountRows, txs] = await Promise.all([
    accountRepo.active().toArray(),
    transactionRepo.active().toArray(),
  ]);
  const accounts = sortAccounts(accountRows);
  if (accounts.length === 0) return undefined;
  const perAccount = balances(accounts, txs, ctx.today);
  const currency = currenciesOf(accounts)[0]!;
  const group = accounts.filter((a) => currencyOf(a) === currency);
  const total = sumMinor(group.map((a) => perAccount.get(a.id) ?? 0));
  return {
    label: t.finance.balance,
    value: formatMoney(total, currency),
    detail: t.finance.headline.accounts(group.length),
    to: '/finance',
  };
}
