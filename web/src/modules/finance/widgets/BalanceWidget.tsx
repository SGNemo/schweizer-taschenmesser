import { Link } from 'react-router';
import { formatMoney } from '@/core/money';
import { t } from '@/strings';
import { EmptyState, Skeleton } from '@/ui';
import { totalBalance, useAvailability, useFinanceData } from '../summary';
import styles from './widget.module.css';

export default function BalanceWidget() {
  const data = useFinanceData();
  const balance = totalBalance(data);
  const a = useAvailability(balance);
  if (!data || balance === undefined || !a) return <Skeleton width="60%" height="1.25rem" />;
  if (data.accounts.length === 0)
    return (
      <EmptyState compact title={t.finance.noAccounts}>
        <Link to="/finance?tab=accounts">{t.finance.title}</Link>
      </EmptyState>
    );
  const hasDeductions = a.deducting;
  return (
    <div>
      <p className={styles.total}>{formatMoney(balance)}</p>
      <p className={styles.muted}>{t.finance.balance}</p>
      {hasDeductions ? (
        <p className={styles.line}>
          <span>{t.finance.available}</span>
          <strong className={a.available < 0 ? styles.negative : ''}>
            {formatMoney(a.available)}
          </strong>
        </p>
      ) : null}
      <Link to="/finance">{t.finance.title}</Link>
    </div>
  );
}
