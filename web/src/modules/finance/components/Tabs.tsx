import { compareText } from '@/core/i18n/format';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { currencyOf, formatMoney, parseMoney } from '@/core/money';
import { getPlatform } from '@/core/platform';
import { useUiStore } from '@/stores/ui';
import { useAdvanced } from '@/core/settings/comfort';
import { useCurrency } from '../currency';
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
  SelectField,
  Switch,
  TextField,
} from '@/ui';
import { transactionRepo } from '../repo';
import { AccountEditor, CategoryEditor, type AccountTarget, type CategoryTarget } from './Editors';
import { RulesList } from './RulesList';
import { balances, filterTransactions, isTransfer, signed, type TxFilter } from '../logic';
import { applyBookingFilter, type BookingFilter } from '../analysis';
import { bookingsCsv } from '../export';
import { decimalSeparator } from '@/core/i18n/format';
import { TransferEditor, transferPair, type TransferTarget } from './TransferEditor';
import type { FinanceData } from '../types';
import type { Stored } from '@/core/db/types';
import type { Transaction } from '../schema';
import { categoryIcon } from '../categoryIcon';
import styles from '../routes/finance.module.css';
import { SignatureMark } from '@/ui/identity';

export function TransactionsTab({
  data,
  month,
  onOpen,
}: {
  data: FinanceData;
  month: string;
  onOpen: (tx: Stored<Transaction>) => void;
}) {
  const currency = useCurrency();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<TxFilter['kind']>('all');
  // `?category=<id>` (the budget history link) starts the list filtered by that category.
  const urlCategory = params.get('category');
  const fromUrl =
    urlCategory && data.categories.some((c) => c.id === urlCategory) ? urlCategory : '';
  const [more, setMore] = useState(fromUrl !== '');
  const [advanced] = useAdvanced('finance');
  const [extra, setExtra] = useState<{
    accountId: string;
    categoryId: string;
    min: string;
    max: string;
    withTransfers: boolean;
  }>({ accountId: '', categoryId: fromUrl, min: '', max: '', withTransfers: true });
  const [transfer, setTransfer] = useState<TransferTarget>(null);
  const category = new Map(data.categories.map((c) => [c.id, c.name]));
  const account = new Map(data.accounts.map((a) => [a.id, a.name]));
  // A text search looks through all months ("where was that booking"); the kind chips stay in the month.
  const searching = query.trim() !== '';
  const advancedFilter: BookingFilter = {
    accountId: extra.accountId || undefined,
    categoryId: extra.categoryId || undefined,
    minMinor: parseMoney(extra.min) ?? undefined,
    maxMinor: parseMoney(extra.max) ?? undefined,
    withTransfers: extra.withTransfers,
  };
  const narrowed =
    extra.accountId !== '' ||
    extra.categoryId !== '' ||
    extra.min !== '' ||
    extra.max !== '' ||
    !extra.withTransfers;
  const inMonth = filterTransactions(
    applyBookingFilter(
      searching ? data.txs : data.txs.filter((x) => x.date.slice(0, 7) === month),
      advancedFilter,
      data.categories,
    ),
    { query, kind },
    (id) => (id ? category.get(id) : undefined),
  ).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const filtering = searching || kind !== 'all' || narrowed;
  if (data.txs.length === 0 || (inMonth.length === 0 && !filtering))
    return (
      <>
        {/* C23: one verb – the toolbar's "Buchung"; import and setup sit in the page's ⋯ menu, transfers on "Konten". */}
        <EmptyState
          title={t.finance.noTransactions}
          testId="finance-empty"
          motif={<SignatureMark id="bankCard" size={64} />}
        />
        <TransferEditor target={transfer} data={data} onClose={() => setTransfer(null)} />
      </>
    );

  async function exportCsv() {
    const e = t.finance.ext.export;
    const csv = bookingsCsv(
      inMonth,
      (id) => account.get(id) ?? '',
      (id) => (id ? (category.get(id) ?? '') : ''),
      { header: e.header, expense: e.expense, income: e.income, transfer: e.transfer },
      { decimal: decimalSeparator() === ',' ? ',' : '.', bom: true },
    );
    const name = `${e.file}-${searching || narrowed ? 'filter' : month}.csv`;
    if ((await getPlatform().saveFile({ fileName: name, data: csv, mime: 'text/csv' })) === 'saved')
      useUiStore.getState().toast(e.done);
  }

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
      {/* The export sits next to the list it exports (B07); the filters stay in the "Erweitert" layer. */}
      <div className={styles.toolbarRow}>
        {advanced || narrowed || more ? (
          <Button variant="ghost" aria-expanded={more} onClick={() => setMore(!more)}>
            {t.finance.ext.filter.more}
            {narrowed ? ' •' : ''}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => void exportCsv()} disabled={inMonth.length === 0}>
          {t.finance.ext.export.button}
        </Button>
      </div>
      {more ? (
        <div className={styles.filterBox}>
          <div className={styles.toolbarRow}>
            <Button
              variant="ghost"
              onClick={() => setTransfer({ draft: true })}
              disabled={data.accounts.length < 2}
            >
              <Icon name="repeat" size={18} />
              {t.finance.ext.transfer.button}
            </Button>
          </div>
          <div className={styles.split}>
            <SelectField
              label={t.finance.ext.filter.account}
              value={extra.accountId}
              onChange={(e) => setExtra({ ...extra, accountId: e.target.value })}
            >
              <option value="">{t.finance.ext.filter.allAccounts}</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={t.finance.ext.filter.category}
              value={extra.categoryId}
              onChange={(e) => setExtra({ ...extra, categoryId: e.target.value })}
            >
              <option value="">{t.finance.ext.filter.allCategories}</option>
              {data.categories
                .filter((c) => !c.parentId || c.id === extra.categoryId)
                .sort((a, b) => compareText(a.name, b.name))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </SelectField>
          </div>
          <div className={styles.split}>
            <TextField
              label={t.finance.ext.filter.minAmount}
              inputMode="decimal"
              value={extra.min}
              onChange={(e) => setExtra({ ...extra, min: e.target.value })}
            />
            <TextField
              label={t.finance.ext.filter.maxAmount}
              inputMode="decimal"
              value={extra.max}
              onChange={(e) => setExtra({ ...extra, max: e.target.value })}
            />
          </div>
          <Switch
            label={t.finance.ext.filter.withTransfers}
            checked={extra.withTransfers}
            onChange={(v) => setExtra({ ...extra, withTransfers: v })}
          />
          {narrowed ? (
            <Button
              variant="ghost"
              onClick={() =>
                setExtra({ accountId: '', categoryId: '', min: '', max: '', withTransfers: true })
              }
            >
              {t.finance.ext.filter.reset}
            </Button>
          ) : null}
        </div>
      ) : null}
      <TransferEditor target={transfer} data={data} onClose={() => setTransfer(null)} />
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
                const isTr = isTransfer(x);
                const pair = isTr ? transferPair(data, x) : undefined;
                const title = isTr
                  ? t.finance.ext.transfer.label
                  : x.payee || x.note || (x.categoryId && category.get(x.categoryId)) || '–';
                const metaCategory = isTr
                  ? pair
                    ? t.finance.ext.transfer.meta(
                        account.get(pair.out.accountId) ?? '–',
                        account.get(pair.in.accountId) ?? '–',
                      )
                    : (account.get(x.accountId) ?? '–')
                  : x.splits?.length
                    ? t.finance.ext.split.parts(x.splits.length)
                    : (x.categoryId && category.get(x.categoryId)) || t.finance.noCategory;
                const remove = () =>
                  void deleteWithUndo(() =>
                    pair
                      ? transactionRepo.removeMany([pair.out.id, pair.in.id])
                      : transactionRepo.remove(x.id),
                  );
                return (
                  <ItemRow
                    key={x.id}
                    lead={
                      <span className={styles.catIcon} aria-hidden="true">
                        <Icon
                          name={categoryIcon(data.categories.find((c) => c.id === x.categoryId))}
                          size={16}
                        />
                      </span>
                    }
                    title={title}
                    meta={`${metaCategory}${isTr ? '' : ` · ${account.get(x.accountId) ?? '–'}`}${x.repeat ? ` · ${t.finance.repeatMeta(t.finance.repeatOptions[x.repeat])}` : ''}`}
                    onOpen={() => (pair ? setTransfer(pair) : onOpen(x))}
                    onSwipeLeft={remove}
                    swipeLeftLabel={t.actions.delete}
                    menu={[
                      ...(isTr ? [] : data.categories)
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
                        className={`${styles.amount} ${x.kind === 'income' && !isTr ? styles.income : ''}`}
                      >
                        {x.kind === 'income' ? '+' : '−'}
                        {formatMoney(Math.abs(signed(x)), currency)}
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
  const [transfer, setTransfer] = useState<TransferTarget>(null);
  const map = balances(data.accounts, data.txs, today());
  return (
    <>
      <div className={patternStyles.gapBottom + ' ' + patternStyles.hstack}>
        <Button
          variant="primary"
          onClick={() => setTarget({ draft: true, order: data.accounts.length })}
        >
          <Icon name="plus" size={18} />
          {t.finance.addAccount}
        </Button>
        {data.accounts.length > 1 ? (
          <Button variant="ghost" onClick={() => setTransfer({ draft: true })}>
            <Icon name="repeat" size={18} />
            {t.finance.ext.transfer.button}
          </Button>
        ) : null}
      </div>
      {data.accounts.length === 0 ? (
        <EmptyState
          title={t.finance.noAccounts}
          motif={<SignatureMark id="bankCard" size={64} />}
        />
      ) : null}
      <ul className={styles.list}>
        {data.accounts.map((a) => (
          <li key={a.id}>
            <button type="button" className={styles.row} onClick={() => setTarget(a)}>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{a.name}</span>
                {a.kind ? (
                  <span className={styles.rowMeta}>{t.finance.ext.accountKind[a.kind]}</span>
                ) : null}
              </span>
              <span className={styles.amount} data-testid={`balance-${a.name}`}>
                {formatMoney(map.get(a.id) ?? 0, currencyOf(a))}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <AccountEditor target={target} onClose={() => setTarget(null)} />
      <TransferEditor target={transfer} data={data} onClose={() => setTransfer(null)} />
    </>
  );
}

export function CategoriesTab({ data }: { data: FinanceData }) {
  const [target, setTarget] = useState<CategoryTarget>(null);
  const groups = [
    { kind: 'expense' as const, title: t.finance.expenseCategories },
    { kind: 'income' as const, title: t.finance.incomeCategories },
  ];
  const byName = (a: { name: string }, b: { name: string }) => compareText(a.name, b.name);
  const row = (c: FinanceData['categories'][number], child: boolean) => (
    <li key={c.id} className={child ? styles.childRow : undefined}>
      <button type="button" className={styles.row} onClick={() => setTarget(c)}>
        <span className={styles.catIcon} aria-hidden="true">
          <Icon name={categoryIcon(c)} size={16} />
        </span>
        <span className={styles.rowMain}>
          <span className={styles.rowTitle}>{c.name}</span>
        </span>
      </button>
    </li>
  );
  return (
    <>
      {groups.map((g) => {
        const all = data.categories.filter((c) => c.kind === g.kind);
        const ids = new Set(all.map((c) => c.id));
        // A child whose parent is gone is shown as a top-level one.
        const tops = all.filter((c) => !c.parentId || !ids.has(c.parentId)).sort(byName);
        return (
          <section key={g.kind} aria-label={g.title}>
            <h3 className={styles.sectionTitle}>{g.title}</h3>
            <ul className={styles.list}>
              {tops.flatMap((c) => [
                row(c, false),
                ...all
                  .filter((k) => k.parentId === c.id)
                  .sort(byName)
                  .map((k) => row(k, true)),
              ])}
            </ul>
            <div className={patternStyles.hstack} style={{ marginTop: 'var(--space-3)' }}>
              <Button onClick={() => setTarget({ draft: true, kind: g.kind })}>
                <Icon name="plus" size={18} />
                {t.finance.addCategory}
              </Button>
            </div>
          </section>
        );
      })}
      <RulesList categories={data.categories} />
      <CategoryEditor
        target={target}
        categories={data.categories}
        onClose={() => setTarget(null)}
      />
    </>
  );
}
