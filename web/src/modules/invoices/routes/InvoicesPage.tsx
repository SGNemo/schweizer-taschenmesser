import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatMoney } from '@/core/money';
import { formatDay, relativeDayLabel, today } from '@/core/time/dates';
import { dueTone } from '@/core/time/due';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Card, EmptyState, Icon } from '@/ui';
import { InvoiceEditor, type InvoiceTarget } from '../components/InvoiceEditor';
import { markOpen, markPaid } from '../actions';
import { openTotal, sortInvoices } from '../logic';
import { invoiceRepo } from '../repo';
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

  // `?new=1` (Quick-Add) opens the create dialog; derived from the URL.
  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const shown = (invoices ?? []).filter((i) => i.status === view);

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
        <div className={styles.segment} role="group" aria-label={t.invoices.view}>
          {(['open', 'paid'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              {t.invoices[v]}
            </button>
          ))}
        </div>
      </div>

      {invoices && shown.length === 0 ? (
        <EmptyState
          icon="receipt"
          title={view === 'open' ? t.invoices.empty : t.invoices.emptyPaid}
        >
          {view === 'open' ? <StartDataButton moduleId="invoices" /> : null}
        </EmptyState>
      ) : null}
      <ul className={styles.list}>
        {shown.map((i) => {
          const tone = dueTone(i.dueDate, i.status === 'paid', day);
          return (
            <Card as="li" key={i.id}>
              <div className={styles.row}>
                <button type="button" className={styles.main} onClick={() => setTarget(i)}>
                  <span className={styles.payee}>{i.payee}</span>
                  <span className={styles.muted}>
                    {i.status === 'paid' ? (
                      `${t.invoices.paidAt}: ${formatDay(i.paidAt ?? i.dueDate, 'd. MMM yyyy')}`
                    ) : (
                      <span
                        className={
                          tone === 'overdue' ? styles.overdue : tone === 'today' ? styles.today : ''
                        }
                      >
                        {tone === 'overdue' ? `${t.invoices.overdue}: ` : `${t.invoices.dueDate}: `}
                        {relativeDayLabel(i.dueDate, day)}
                      </span>
                    )}
                    {i.reference ? ` · ${i.reference}` : ''}
                  </span>
                </button>
                <span className={styles.amount}>{formatMoney(i.amountMinor)}</span>
                {i.status === 'open' ? (
                  <Button onClick={() => void pay(i.id)}>{t.invoices.markPaid}</Button>
                ) : (
                  <Button variant="ghost" onClick={() => void markOpen(i.id)}>
                    {t.invoices.reopen}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </ul>

      <InvoiceEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
