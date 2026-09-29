import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatMonth, addMonthsToMonth, monthOf, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Icon, IconButton } from '@/ui';
import { TransactionEditor, type TransactionTarget } from '../components/Editors';
import { OverviewTab } from '../components/OverviewTab';
import { AccountsTab, CategoriesTab, TransactionsTab } from '../components/Tabs';
import { ensureDefaults } from '../repo';
import { useFinanceData } from '../summary';
import styles from './finance.module.css';

const TABS = ['overview', 'transactions', 'accounts', 'categories'] as const;
type Tab = (typeof TABS)[number];
const MONTH_RE = /^\d{4}-\d{2}$/;

export default function FinancePage() {
  const data = useFinanceData();
  const [params, setParams] = useSearchParams();
  const [target, setTarget] = useState<TransactionTarget>(null);

  useEffect(() => {
    void ensureDefaults();
  }, []);

  const rawTab = params.get('tab');
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'overview';
  const rawMonth = params.get('month');
  const month = rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : monthOf(today());

  function go(next: { tab?: Tab; month?: string }) {
    const p = new URLSearchParams(params);
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

      <div
        className={`${styles.segment} ${styles.tabs}`}
        role="group"
        aria-label={t.finance.tabsLabel}
      >
        {TABS.map((k) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => go({ tab: k })}>
            {t.finance.tabs[k]}
          </button>
        ))}
      </div>

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

      {data ? (
        <>
          {tab === 'overview' ? <OverviewTab data={data} month={month} /> : null}
          {tab === 'transactions' ? (
            <TransactionsTab data={data} month={month} onOpen={setTarget} />
          ) : null}
          {tab === 'accounts' ? <AccountsTab data={data} /> : null}
          {tab === 'categories' ? <CategoriesTab data={data} /> : null}
          <TransactionEditor target={openTarget} data={data} onClose={closeEditor} />
        </>
      ) : null}
    </>
  );
}
