import { NowStrip } from '@/core/modules/NowStrip';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAdvanced } from '@/core/settings/comfort';
import { DEFAULT_CURRENCY } from '@/core/money';
import { formatMonth, addMonthsToMonth, monthOf, today } from '@/core/time/dates';
import { t } from '@/strings';
import {
  AdvancedToggle,
  Button,
  Card,
  Icon,
  IconButton,
  patternStyles,
  Segmented,
  SplitView,
  useOpenParam,
  useSplitView,
} from '@/ui';
import { TransactionEditor, type TransactionTarget } from '../components/Editors';
import { OverviewTab } from '../components/OverviewTab';
import { AccountsTab, CategoriesTab, TransactionsTab } from '../components/Tabs';
import { DEFAULT_CATEGORY_IDS, ensureDefaults, transactionRepo } from '../repo';
import { useFinanceData } from '../summary';
import { CurrencyContext } from '../currency';
import { currenciesOf, filterByCurrency } from '../logic';
import styles from './finance.module.css';

const TABS = ['overview', 'transactions', 'accounts', 'categories'] as const;
type Tab = (typeof TABS)[number];
const MONTH_RE = /^\d{4}-\d{2}$/;

export default function FinancePage() {
  const data = useFinanceData();
  const [params, setParams] = useSearchParams();
  const [target, setTarget] = useState<TransactionTarget>(null);
  useOpenParam((id) => transactionRepo.get(id), setTarget);
  const wideScreen = useSplitView();

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

  function go(next: { tab?: Tab; month?: string; cur?: string }) {
    const p = new URLSearchParams(params);
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

  return (
    <>
      <div className={styles.header}>
        <h1>{t.finance.title}</h1>
        <div className={patternStyles.hstackCenter}>
          <AdvancedToggle moduleId="finance" />
          <Button
            variant="primary"
            onClick={() => setTarget({ draft: true })}
            aria-label={t.finance.addTransaction}
            disabled={!data || data.accounts.length === 0}
          >
            <Icon name="plus" size={18} />
            {t.finance.addTransactionShort}
          </Button>
        </div>
      </div>

      <NowStrip modules={['finance', 'invoices', 'budgets']} />
      <div className={styles.tabs}>
        <Segmented
          label={t.finance.tabsLabel}
          value={tab}
          options={tabs.map((k) => ({ value: k, label: t.finance.tabs[k] }))}
          onChange={(k) => go({ tab: k })}
        />
      </div>

      {currencies.length > 1 && (tab === 'overview' || tab === 'transactions') ? (
        <div className={styles.tabs}>
          <Segmented
            label={t.money.currency}
            value={currency}
            options={currencies.map((c) => ({ value: c, label: c }))}
            onChange={(c) => go({ cur: c })}
          />
        </div>
      ) : null}

      {tab === 'overview' || tab === 'transactions' ? (
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
          {/* Wide screens: the month's bookings sit next to the overview instead of a tab away. */}
          <SplitView
            enabled={wideScreen && tab === 'overview'}
            asideLabel={t.finance.tabs.transactions}
            aside={
              <Card title={t.finance.tabs.transactions}>
                <TransactionsTab data={view} month={month} onOpen={setTarget} />
              </Card>
            }
          >
            {tab === 'overview' ? (
              <OverviewTab data={view} month={month} narrow={wideScreen} />
            ) : null}
            {tab === 'transactions' ? (
              <TransactionsTab data={view} month={month} onOpen={setTarget} />
            ) : null}
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
