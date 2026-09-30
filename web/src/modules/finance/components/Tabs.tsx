import { useState } from 'react';
import { formatMoney } from '@/core/money';
import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, EmptyState, Icon } from '@/ui';
import { AccountEditor, CategoryEditor, type AccountTarget, type CategoryTarget } from './Editors';
import { balances, signed } from '../logic';
import type { FinanceData } from '../types';
import type { Stored } from '@/core/db/types';
import type { Transaction } from '../schema';
import styles from '../routes/finance.module.css';
import { StartDataButton } from '@/core/importer/StartDataButton';

export function TransactionsTab({
  data,
  month,
  onOpen,
}: {
  data: FinanceData;
  month: string;
  onOpen: (tx: Stored<Transaction>) => void;
}) {
  const category = new Map(data.categories.map((c) => [c.id, c.name]));
  const account = new Map(data.accounts.map((a) => [a.id, a.name]));
  const inMonth = data.txs
    .filter((x) => x.date.slice(0, 7) === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  if (inMonth.length === 0)
    return (
      <EmptyState icon="wallet" title={t.finance.noTransactions}>
        <StartDataButton moduleId="finance" />
      </EmptyState>
    );

  const days = [...new Set(inMonth.map((x) => x.date))];
  return (
    <div>
      {days.map((d) => (
        <section key={d} aria-label={formatDay(d, 'EEEE, d. MMMM')}>
          <h3 className={styles.dayHead}>{formatDay(d, 'EEEE, d. MMMM')}</h3>
          <ul className={styles.list}>
            {inMonth
              .filter((x) => x.date === d)
              .map((x) => (
                <li key={x.id}>
                  <button type="button" className={styles.row} onClick={() => onOpen(x)}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>
                        {x.payee || x.note || (x.categoryId && category.get(x.categoryId)) || '–'}
                      </span>
                      <span className={styles.rowMeta}>
                        {(x.categoryId && category.get(x.categoryId)) || t.finance.noCategory} ·{' '}
                        {account.get(x.accountId) ?? '–'}
                      </span>
                    </span>
                    <span
                      className={`${styles.amount} ${x.kind === 'income' ? styles.income : ''}`}
                    >
                      {x.kind === 'income' ? '+' : '−'}
                      {formatMoney(Math.abs(signed(x)))}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function AccountsTab({ data }: { data: FinanceData }) {
  const [target, setTarget] = useState<AccountTarget>(null);
  const map = balances(data.accounts, data.txs, today());
  return (
    <>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Button
          variant="primary"
          onClick={() => setTarget({ draft: true, order: data.accounts.length })}
        >
          <Icon name="plus" size={18} />
          {t.finance.addAccount}
        </Button>
      </div>
      {data.accounts.length === 0 ? (
        <EmptyState icon="wallet" title={t.finance.noAccounts} />
      ) : null}
      <ul className={styles.list}>
        {data.accounts.map((a) => (
          <li key={a.id}>
            <button type="button" className={styles.row} onClick={() => setTarget(a)}>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{a.name}</span>
              </span>
              <span className={styles.amount} data-testid={`balance-${a.name}`}>
                {formatMoney(map.get(a.id) ?? 0)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <AccountEditor target={target} onClose={() => setTarget(null)} />
    </>
  );
}

export function CategoriesTab({ data }: { data: FinanceData }) {
  const [target, setTarget] = useState<CategoryTarget>(null);
  const groups = [
    { kind: 'expense' as const, title: t.finance.expenseCategories },
    { kind: 'income' as const, title: t.finance.incomeCategories },
  ];
  return (
    <>
      {groups.map((g) => (
        <section key={g.kind} aria-label={g.title}>
          <h3 className={styles.sectionTitle}>{g.title}</h3>
          <ul className={styles.list}>
            {data.categories
              .filter((c) => c.kind === g.kind)
              .sort((a, b) => a.name.localeCompare(b.name, 'de'))
              .map((c) => (
                <li key={c.id}>
                  <button type="button" className={styles.row} onClick={() => setTarget(c)}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{c.name}</span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button onClick={() => setTarget({ draft: true, kind: g.kind })}>
              <Icon name="plus" size={18} />
              {t.finance.addCategory}
            </Button>
          </div>
        </section>
      ))}
      <CategoryEditor target={target} onClose={() => setTarget(null)} />
    </>
  );
}
