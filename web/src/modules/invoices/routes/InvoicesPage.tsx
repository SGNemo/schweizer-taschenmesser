import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatMoney } from '@/core/money';
import type { Stored } from '@/core/db/types';
import { formatDay, today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { groupByTime } from '@/core/time/groups';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import {
  Button,
  EmptyState,
  GroupedList,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  Segmented,
  StateBadge,
  useMediaQuery,
} from '@/ui';
import { InvoiceEditor, type InvoiceTarget } from '../components/InvoiceEditor';
import { markOpen, markPaid } from '../actions';
import { openTotal, sortInvoices } from '../logic';
import { invoiceRepo } from '../repo';
import type { Invoice } from '../schema';
import styles from './invoices.module.css';
import { StartDataButton } from '@/core/importer/StartDataButton';

type View = 'open' | 'paid';

export default function InvoicesPage() {
  const invoices = useLiveQuery(async () => sortInvoices(await invoiceRepo.active().toArray()), []);
  const [view, setView] = useState<View>('open');
  const [target, setTarget] = useState<InvoiceTarget>(null);
  const [params, setParams] = useSearchParams();
  const toast = useUiStore((s) => s.toast);
  const day = today();
  const narrow = useMediaQuery('(max-width: 899px)');

  // `?new=1` (Quick-Add) opens the create dialog; derived from the URL.
  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const shown = (invoices ?? []).filter((i) => i.status === view);

  function renderRow(i: Stored<Invoice>) {
    const state = dueState(i.dueDate, day, { done: i.status === 'paid' });
    const urgent = i.status === 'open' && (state.tone === 'overdue' || state.tone === 'today');
    return (
      <ItemRow
        key={i.id}
        title={i.payee}
        tone={urgent ? (state.tone as 'overdue' | 'today') : undefined}
        meta={
          i.status === 'paid'
            ? `${t.invoices.paidAt}: ${formatDay(i.paidAt ?? i.dueDate, 'd. MMM yyyy')}${i.reference ? ` · ${i.reference}` : ''}`
            : `${t.invoices.dueDate}: ${formatDay(i.dueDate, 'EEE, d. MMM')}${i.reference ? ` · ${i.reference}` : ''}`
        }
        onOpen={() => setTarget(i)}
        end={
          <>
            {i.status === 'open' && state.tone !== 'later' ? (
              <StateBadge tone={state.tone} label={state.label} />
            ) : null}
            <span className={styles.amount}>{formatMoney(i.amountMinor)}</span>
            {i.status === 'open' ? (
              narrow ? (
                <IconButton label={t.invoices.markPaid} onClick={() => void pay(i.id)}>
                  <Icon name="check" />
                </IconButton>
              ) : (
                <Button size="sm" onClick={() => void pay(i.id)}>
                  {t.invoices.markPaid}
                </Button>
              )
            ) : (
              <Button size="sm" variant="ghost" onClick={() => void markOpen(i.id)}>
                {t.invoices.reopen}
              </Button>
            )}
          </>
        }
      />
    );
  }

  const openGroups = groupByTime(shown, (i) => i.dueDate, day).map((g) => ({
    id: g.id,
    label: t.groups[g.id as keyof typeof t.groups] as string,
    count: g.items.length,
    tone: g.id === 'overdue' || g.id === 'today' ? (g.id as 'overdue' | 'today') : undefined,
    children: <ItemList>{g.items.map((i) => renderRow(i))}</ItemList>,
  }));

  async function pay(id: string) {
    await markPaid(id);
    toast(t.invoices.markedPaid, { label: t.invoices.undo, run: () => void markOpen(id) });
  }

  return (
    <>
      <div className={styles.header}>
        <h1>{t.invoices.title}</h1>
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.invoices.add}
        </Button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t.invoices.openTotal}</span>
          <span className={styles.statValue} data-testid="open-total">
            {formatMoney(openTotal(invoices ?? []))}
          </span>
        </div>
        <Segmented
          label={t.invoices.view}
          value={view}
          options={[
            { value: 'open', label: t.invoices.open },
            { value: 'paid', label: t.invoices.paid },
          ]}
          onChange={setView}
        />
      </div>

      {invoices && shown.length === 0 ? (
        <EmptyState title={view === 'open' ? t.invoices.empty : t.invoices.emptyPaid}>
          {view === 'open' ? <StartDataButton moduleId="invoices" /> : null}
        </EmptyState>
      ) : null}
      {view === 'open' ? (
        <GroupedList listId="invoices" groups={openGroups} label={t.invoices.title} />
      ) : (
        <ItemList label={t.invoices.title}>{shown.map((i) => renderRow(i))}</ItemList>
      )}

      <InvoiceEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
