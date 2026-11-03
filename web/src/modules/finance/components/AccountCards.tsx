import { currencyOf, formatMoney } from '@/core/money';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { BankCard } from '@/ui/identity';
import { balances, sortAccounts } from '../logic';
import { useAvailability, totalBalance } from '../summary';
import type { FinanceData } from '../types';
import styles from '../routes/finance.module.css';

const MAX_CARDS = 2;

/** Head signature: one card per account (the first two), balance large; the first card also names the available amount. */
export function AccountCards({ data }: { data: FinanceData }) {
  const accounts = sortAccounts(data.accounts).slice(0, MAX_CARDS);
  const perAccount = balances(data.accounts, data.txs, today());
  const first = accounts[0];
  const currency = first ? currencyOf(first) : undefined;
  const availability = useAvailability(totalBalance(data), currency ?? 'EUR');
  if (accounts.length === 0) return null;
  return (
    <div className={styles.cards} data-testid="account-cards">
      {accounts.map((a, i) => (
        <BankCard
          key={a.id}
          name={a.name}
          balance={formatMoney(perAccount.get(a.id) ?? 0, currencyOf(a))}
          detail={
            i === 0 && availability?.deducting
              ? t.finance.cardAvailable(formatMoney(availability.available, currencyOf(a)))
              : undefined
          }
          second={i > 0}
        />
      ))}
    </div>
  );
}
