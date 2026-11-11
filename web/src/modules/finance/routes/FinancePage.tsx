import { NowStrip } from '@/core/modules/NowStrip';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAdvanced } from '@/core/settings/comfort';
import { DEFAULT_CURRENCY } from '@/core/money';
import { formatMonth, addMonthsToMonth, monthOf, today } from '@/core/time/dates';
import { YearView } from '../components/YearView';
import { t } from '@/strings';
import {
  Button,
  Icon,
  IconButton,
  PageAction,
  PageHeader,
  Segmented,
  SplitView,
  Tabs,
  useAdvancedMenuItem,
  useOpenParam,
  useSplitView,
} from '@/ui';
import { TransactionEditor, type TransactionTarget } from '../components/Editors';
import { OverviewTab } from '../components/OverviewTab';
import { NetWorthTab } from '../components/NetWorthTab';
import { AccountsTab, CategoriesTab, TransactionsTab } from '../components/Tabs';
import { DEFAULT_CATEGORY_IDS, ensureDefaults, transactionRepo } from '../repo';
import { totalBalance, useAvailability, useFinanceData } from '../summary';
import { formatMoney } from '@/core/money';
import { TransactionDetail } from '../components/TransactionDetail';
import type { Stored } from '@/core/db/types';
import type { Transaction } from '../schema';
import { CurrencyContext } from '../currency';
import { currenciesOf, filterByCurrency } from '../logic';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { StartDataMenu } from '@/core/importer/StartDataMenu';
import styles from './finance.module.css';

const TABS = ['overview', 'transactions', 'trend', 'accounts', 'categories'] as const;
type Tab = (typeof TABS)[number];
const MONTH_RE = /^\d{4}-\d{2}$/;

export default function FinancePage() {
  const data = useFinanceData();
  const [params, setParams] = useSearchParams();
  const [target, setTarget] = useState<TransactionTarget>(null);
  useOpenParam((id) => transactionRepo.get(id), setTarget);
  const wideScreen = useSplitView();
  // Master–detail (layout `split`): on a wide page a booking opens in the panel beside the list, below that width
  // in its dialog (a sheet on the phone).
  const [picked, setPicked] = useState<{ id: string } | 'closed' | null>(null);
  const advancedItem = useAdvancedMenuItem('finance');

  useEffect(() => {
    void ensureDefaults();
  }, []);

  const rawTab = params.get('tab');
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'overview';
  // Accounts and categories are set up once: they live in the Erweitert view, unless the user
  // already has more than the defaults (or is on that tab, e.g. from a link).
  const [advanced] = useAdvanced('finance');
  const hasMoreAccounts = (data?.accounts.length ?? 0) > 1;
  const hasOwnCategories = (data?.categories ?? []).some((c) => !DEFAULT_CATEGORY_IDS.has(c.id));
  const tabs = TABS.filter((k) =>
    k === 'accounts'
      ? advanced || hasMoreAccounts || tab === k
      : k === 'categories'
        ? advanced || hasOwnCategories || tab === k
        : true,
  );
  // Accounts in several currencies: one currency at a time, nothing is converted or mixed.
  const currencies = data ? currenciesOf(data.accounts) : [DEFAULT_CURRENCY];
  const rawCur = params.get('cur');
  const currency =
    rawCur && currencies.includes(rawCur) ? rawCur : (currencies[0] ?? DEFAULT_CURRENCY);
  const view = data && currencies.length > 1 ? filterByCurrency(data, currency) : data;
  const rawMonth = params.get('month');
  const month = rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : monthOf(today());

  // The head's one figure: what is available (or the balance while nothing is deducted). The page below never
  // repeats it; the line under the month says what it is made of.
  const balance = totalBalance(view);
  const availability = useAvailability(balance, currency);
  const deducting = availability?.deducting;
  const accountCount = view?.accounts.length ?? 0;

  const period = params.get('period') === 'year' ? 'year' : 'month';
  const rawYear = Number(params.get('year'));
  const year = Number.isInteger(rawYear) && rawYear > 1900 ? rawYear : Number(today().slice(0, 4));

  function go(next: { tab?: Tab; month?: string; cur?: string; period?: string; year?: number }) {
    const p = new URLSearchParams(params);
    if (next.period) p.set('period', next.period);
    if (next.year) p.set('year', String(next.year));
    if (next.cur) p.set('cur', next.cur);
    if (next.tab) p.set('tab', next.tab);
    if (next.month) p.set('month', next.month);
    p.delete('new');
    setParams(p, { replace: true });
  }

  // `?new=1` (Quick-Add) opens the booking dialog; derived from the URL.
  const openTarget =
    target ??
    (params.get('new') && data && data.accounts.length > 0 ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) {
      const p = new URLSearchParams(params);
      p.delete('new');
      setParams(p, { replace: true });
    }
  };

  const canAdd = !!data && data.accounts.length > 0;
  const addBooking = () => setTarget({ draft: true });
  /** An account, but no booking yet. */
  const firstUse = canAdd && data.txs.length === 0;

  // The panel shows the picked booking, else the newest of the month (the list's first row), so a wide page has
  // its detail from the start; "Details schließen" gives the list the whole width back.
  const monthTxs = (view?.txs ?? [])
    .filter((x) => x.date.slice(0, 7) === month && !x.transferId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const detail: Stored<Transaction> | undefined =
    picked === 'closed'
      ? undefined
      : // A pick from another month or currency no longer counts: the panel follows the list that is shown.
        ((picked ? monthTxs.find((x) => x.id === picked.id) : undefined) ?? monthTxs[0]);
  const openBooking = (tx: Stored<Transaction>) =>
    wideScreen ? setPicked({ id: tx.id }) : setTarget(tx);

  return (
    <>
      <PageHeader
        title={t.finance.title}
        // The month switch is a short first row; the other tabs start with wider content.
        besideContent={tab === 'overview' || tab === 'transactions'}
        views={
          <Tabs
            label={t.finance.tabsLabel}
            value={tab}
            options={tabs.map((k) => ({ value: k, label: t.finance.tabs[k] }))}
            onChange={(k) => go({ tab: k })}
          />
        }
      >
        {/* While nothing is booked the empty state holds the one filled step (U26). */}
        <PageAction
          short={t.finance.addTransactionShort}
          variant={
            firstUse && (tab === 'overview' || tab === 'transactions') ? 'secondary' : 'primary'
          }
          onClick={addBooking}
          aria-label={t.finance.addTransaction}
          disabled={!canAdd}
        >
          <Icon name="plus" size={18} />
          {t.finance.addTransactionShort}
        </PageAction>
        <StartDataMenu moduleId="finance" items={[advancedItem]} />
      </PageHeader>

      {availability && accountCount > 0 ? (
        <HeroSlot area="figure">
          <HeroFigure
            label={deducting ? t.finance.available : t.finance.balance}
            value={formatMoney(deducting ? availability.available : availability.balance, currency)}
            detail={t.finance.headline.named(!!deducting, accountCount)}
            tone={
              (deducting ? availability.available : availability.balance) < 0 ? 'danger' : undefined
            }
            sensitive
            testId="hero"
          />
        </HeroSlot>
      ) : null}

      <NowStrip modules={['finance', 'invoices', 'budgets']} />
      {currencies.length > 1 &&
      (tab === 'overview' || tab === 'transactions' || tab === 'trend') ? (
        <div className={styles.tabs}>
          <Segmented
            label={t.money.currency}
            value={currency}
            options={currencies.map((c) => ({ value: c, label: c }))}
            onChange={(c) => go({ cur: c })}
          />
        </div>
      ) : null}

      {/* The year view is a power view: the switch shows in Erweitert (or while the year is open, e.g. from a link). */}
      {tab === 'overview' && (advanced || period === 'year') ? (
        <div className={styles.tabs}>
          <Segmented
            label={t.finance.ext.period.label}
            value={period}
            options={[
              { value: 'month' as const, label: t.finance.ext.period.month },
              { value: 'year' as const, label: t.finance.ext.period.year },
            ]}
            onChange={(v) => go({ period: v })}
          />
        </div>
      ) : null}

      {tab === 'overview' && period === 'year' ? (
        <div className={styles.filter} role="group" aria-label={t.finance.ext.period.year}>
          <IconButton label={t.finance.ext.period.prevYear} onClick={() => go({ year: year - 1 })}>
            <span aria-hidden="true">‹</span>
          </IconButton>
          <span className={styles.monthLabel} aria-live="polite" data-testid="year-label">
            {year}
          </span>
          <IconButton label={t.finance.ext.period.nextYear} onClick={() => go({ year: year + 1 })}>
            <span aria-hidden="true">›</span>
          </IconButton>
        </div>
      ) : null}

      {!firstUse && (tab === 'transactions' || (tab === 'overview' && period === 'month')) ? (
        <div className={styles.filter} role="group" aria-label={t.finance.month}>
          <IconButton
            label={t.finance.prevMonth}
            onClick={() => go({ month: addMonthsToMonth(month, -1) })}
          >
            <span aria-hidden="true">‹</span>
          </IconButton>
          <span className={styles.monthLabel} aria-live="polite" data-testid="month-label">
            {formatMonth(month)}
          </span>
          <IconButton
            label={t.finance.nextMonth}
            onClick={() => go({ month: addMonthsToMonth(month, 1) })}
          >
            <span aria-hidden="true">›</span>
          </IconButton>
          {month !== monthOf(today()) ? (
            <Button variant="ghost" onClick={() => go({ month: monthOf(today()) })}>
              {t.finance.currentMonth}
            </Button>
          ) : null}
        </div>
      ) : null}

      {data && view ? (
        <CurrencyContext.Provider value={currency}>
          {/* Wide pages. Overview: the month's bookings sit next to it instead of a tab away. Buchungen: the list at
              the page width, the picked booking in the panel (master–detail). */}
          <SplitView
            enabled={
              wideScreen &&
              ((tab === 'overview' && period === 'month' && !firstUse) ||
                (tab === 'transactions' && detail !== undefined))
            }
            asideLabel={
              tab === 'transactions' ? t.finance.ext.detail.label : t.finance.tabs.transactions
            }
            aside={
              tab === 'transactions' && detail ? (
                <TransactionDetail
                  tx={detail}
                  data={view}
                  onEdit={() => setTarget(detail)}
                  onClose={() => setPicked('closed')}
                />
              ) : (
                <section aria-label={t.finance.tabs.transactions}>
                  <h2 className={styles.asideTitle}>{t.finance.tabs.transactions}</h2>
                  <TransactionsTab data={view} month={month} onOpen={setTarget} />
                </section>
              )
            }
          >
            {tab === 'overview' && period === 'month' ? (
              firstUse ? (
                // B6: nothing booked yet: no row of zeros and no flat curve, one sentence and one verb.
                <TransactionsTab data={view} month={month} onOpen={setTarget} onAdd={addBooking} />
              ) : (
                <OverviewTab data={view} month={month} narrow={wideScreen} />
              )
            ) : null}
            {tab === 'overview' && period === 'year' ? <YearView data={view} year={year} /> : null}
            {tab === 'transactions' ? (
              <TransactionsTab
                data={view}
                month={month}
                onOpen={openBooking}
                onEdit={setTarget}
                onAdd={canAdd ? addBooking : undefined}
                selectedId={wideScreen ? detail?.id : undefined}
              />
            ) : null}
            {tab === 'trend' ? <NetWorthTab data={view} /> : null}
            {tab === 'accounts' ? <AccountsTab data={data} /> : null}
            {tab === 'categories' ? <CategoriesTab data={data} /> : null}
          </SplitView>
          <TransactionEditor
            target={openTarget}
            data={data}
            onClose={closeEditor}
            onDuplicated={setTarget}
          />
        </CurrencyContext.Provider>
      ) : null}
    </>
  );
}
