import { compareText } from '@/core/i18n/format';
import { useState } from 'react';
import { formatMoney } from '@/core/money';
import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { changeWithUndo, deleteWithUndo } from '@/core/undo/withToast';
import {
  Button,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  patternStyles,
  Segmented,
  TextField,
} from '@/ui';
import { transactionRepo } from '../repo';
import { AccountEditor, CategoryEditor, type AccountTarget, type CategoryTarget } from './Editors';
import { balances, filterTransactions, signed, type TxFilter } from '../logic';
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
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<TxFilter['kind']>('all');
  const category = new Map(data.categories.map((c) => [c.id, c.name]));
  const account = new Map(data.accounts.map((a) => [a.id, a.name]));
  // A text search looks through all months ("where was that booking"); the kind chips stay in the month.
  const searching = query.trim() !== '';
  const inMonth = filterTransactions(
    searching ? data.txs : data.txs.filter((x) => x.date.slice(0, 7) === month),
    { query, kind },
    (id) => (id ? category.get(id) : undefined),
  ).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const filtering = searching || kind !== 'all';
  if (data.txs.length === 0 || (inMonth.length === 0 && !filtering))
    return (
      <EmptyState title={t.finance.noTransactions}>
        <StartDataButton moduleId="finance" />
      </EmptyState>
    );

  const days = [...new Set(inMonth.map((x) => x.date))];
  const dayFormat = searching ? 'EEEE, d. MMMM yyyy' : 'EEEE, d. MMMM';
  return (
    <div>
      <TextField
        label={t.finance.searchBookings}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Segmented
        label={t.finance.filterKind}
        value={kind}
        options={[
          { value: 'all' as const, label: t.finance.filterAll },
          { value: 'expense' as const, label: t.finance.expenseOne },
          { value: 'income' as const, label: t.finance.incomeOne },
        ]}
        onChange={setKind}
      />
      {searching ? (
        <p className={styles.muted}>{t.finance.searchAllMonths(inMonth.length)}</p>
      ) : null}
      {filtering && inMonth.length === 0 ? <p>{t.finance.noMatches}</p> : null}
      {days.map((d) => (
        <section key={d} aria-label={formatDay(d, dayFormat)}>
          <h3 className={styles.dayHead}>{formatDay(d, dayFormat)}</h3>
          <ItemList label={formatDay(d, dayFormat)}>
            {inMonth
              .filter((x) => x.date === d)
              .map((x) => {
                const title =
                  x.payee || x.note || (x.categoryId && category.get(x.categoryId)) || '–';
                const remove = () => void deleteWithUndo(() => transactionRepo.remove(x.id));
                return (
                  <ItemRow
                    key={x.id}
                    title={title}
                    meta={`${(x.categoryId && category.get(x.categoryId)) || t.finance.noCategory} · ${account.get(x.accountId) ?? '–'}${x.repeat ? ` · ${t.finance.repeatMeta(t.finance.repeatOptions[x.repeat])}` : ''}`}
                    onOpen={() => onOpen(x)}
                    onSwipeLeft={remove}
                    swipeLeftLabel={t.actions.delete}
                    menu={[
                      ...data.categories
                        .filter((c) => c.kind === x.kind && c.id !== x.categoryId)
                        .sort((a, b) => compareText(a.name, b.name))
                        .map((c) => ({
                          id: `cat-${c.id}`,
                          group: t.finance.changeCategory,
                          label: c.name,
                          onSelect: () =>
                            void changeWithUndo(() =>
                              transactionRepo.update(x.id, { categoryId: c.id }),
                            ),
                        })),
                      { id: 'delete', label: t.actions.delete, danger: true, onSelect: remove },
                    ]}
                    end={
                      <span
                        className={`${styles.amount} ${x.kind === 'income' ? styles.income : ''}`}
                      >
                        {x.kind === 'income' ? '+' : '−'}
                        {formatMoney(Math.abs(signed(x)))}
                      </span>
                    }
                  />
                );
              })}
          </ItemList>
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
      <div className={patternStyles.gapBottom}>
        <Button
          variant="primary"
          onClick={() => setTarget({ draft: true, order: data.accounts.length })}
        >
          <Icon name="plus" size={18} />
          {t.finance.addAccount}
        </Button>
      </div>
      {data.accounts.length === 0 ? <EmptyState title={t.finance.noAccounts} /> : null}
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
              .sort((a, b) => compareText(a.name, b.name))
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
