import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { formatMoney } from '@/core/money';
import type { Stored } from '@/core/db/types';
import { formatDay, today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { groupByTime } from '@/core/time/groups';
import { t } from '@/strings';
import { deleteWithUndo } from '@/core/undo/withToast';
import {
  Button,
  EmptyState,
  GroupedList,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  PageAction,
  PageHeader,
  SplitView,
  StateBadge,
  Tabs,
  useAdvancedMenuItem,
  useOpenParam,
  useSplitView,
} from '@/ui';
import { InvoiceDetail } from '../components/InvoiceDetail';
import { InvoiceEditor, type InvoiceTarget } from '../components/InvoiceEditor';
import { markOpen } from '../actions';
import { payWithUndo } from '../quickActions';
import { invoiceState, openTotalText, remainingMinor, sortInvoices } from '../logic';
import { copyPaymentData } from '../pay';
import { InvoicesHead } from '../components/InvoicesHead';
import { SignatureMark } from '@/ui/identity';
import { usePageWidthAtLeast } from '@/ui/pageWidth';
import { invoiceRepo } from '../repo';
import type { Invoice } from '../schema';
import styles from './invoices.module.css';
import { StartDataMenu } from '@/core/importer/StartDataMenu';

type View = 'open' | 'paid' | 'all';

export default function InvoicesPage() {
  const invoices = useLiveQuery(async () => sortInvoices(await invoiceRepo.active().toArray()), []);
  const [view, setView] = useState<View>('open');
  const [target, setTarget] = useState<InvoiceTarget>(null);
  useOpenParam((id) => invoiceRepo.get(id), setTarget);
  const [params, setParams] = useSearchParams();
  const day = today();
  // F15: the row's pay button follows the page, not the window (icon below 48 rem of page).
  const narrow = usePageWidthAtLeast(48) === false;
  const navigate = useNavigate();
  const advancedItem = useAdvancedMenuItem('invoices');
  // Master–detail (layout `split`): on a wide page an invoice opens in the panel beside the list, below that width
  // in its dialog (a sheet on the phone).
  const wide = useSplitView();
  const [picked, setPicked] = useState<{ id: string } | 'closed' | null>(null);

  // `?new=1` (Quick-Add) opens the create dialog; derived from the URL.
  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const shown = (invoices ?? []).filter((i) => view === 'all' || i.status === view);
  // Nothing open (or nothing at all): the empty state holds the one verb.
  const emptyOpen = !!invoices && shown.length === 0 && view !== 'paid';
  const timeGroups = groupByTime(shown, (i) => i.dueDate, day);
  // The panel shows the picked invoice, else the first row as the list shows it (the open view is grouped by time).
  const firstShown = view === 'open' ? timeGroups[0]?.items[0] : shown[0];
  const detail =
    picked === 'closed'
      ? undefined
      : ((picked ? shown.find((i) => i.id === picked.id) : undefined) ?? firstShown);
  const openRow = (i: Stored<Invoice>) => (wide ? setPicked({ id: i.id }) : setTarget(i));

  function renderRow(i: Stored<Invoice>) {
    const state = dueState(i.dueDate, day, { done: i.status === 'paid' });
    const inv = invoiceState(i, day);
    const extra = [
      inv.partial ? t.invoices.ext.state.partial : '',
      i.dunningLevel ? t.invoices.ext.dunning.level(i.dunningLevel) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const hasPayData = Boolean(i.iban || i.reference);
    const urgent = i.status === 'open' && (state.tone === 'overdue' || state.tone === 'today');
    return (
      <ItemRow
        key={i.id}
        title={i.payee}
        tone={urgent ? (state.tone as 'overdue' | 'today') : undefined}
        meta={
          i.status === 'paid'
            ? `${t.invoices.paidAt}: ${formatDay(i.paidAt ?? i.dueDate, 'd. MMM yyyy')}${i.reference ? ` · ${i.reference}` : ''}`
            : `${t.invoices.dueDate}: ${formatDay(i.dueDate, 'EEE, d. MMM')}${i.reference ? ` · ${i.reference}` : ''}${i.repeat ? ` · ${t.invoices.repeatMeta(t.invoices.repeatOptions[i.repeat])}` : ''}${extra ? ` · ${extra}` : ''}`
        }
        lead={
          <span
            className={styles.plate}
            data-initial={i.payee.slice(0, 1).toUpperCase()}
            aria-hidden="true"
          />
        }
        current={wide && detail?.id === i.id}
        onOpen={() => openRow(i)}
        onSwipeRight={i.status === 'open' ? () => void pay(i.id) : undefined}
        swipeRightLabel={t.invoices.markPaid}
        menu={
          i.status === 'open'
            ? [
                { id: 'pay', label: t.invoices.markPaid, onSelect: () => void pay(i.id) },
                // Master–detail: the row only picks the entry there; this opens its dialog at once.
                ...(wide
                  ? [{ id: 'edit', label: t.actions.edit, onSelect: () => setTarget(i) }]
                  : []),
                ...(hasPayData
                  ? [
                      {
                        id: 'copy',
                        label: t.invoices.ext.pay.copyAll,
                        onSelect: () => void copyPaymentData(i),
                      },
                    ]
                  : []),
                ...(i.payments?.length
                  ? [
                      {
                        id: 'booking',
                        label: t.invoices.ext.openBooking,
                        onSelect: () =>
                          void navigate(`/finance?open=inv-${i.id}-${i.payments![0]!.id}`),
                      },
                    ]
                  : []),
                {
                  id: 'delete',
                  label: t.actions.delete,
                  danger: true,
                  onSelect: () => void deleteWithUndo(() => invoiceRepo.remove(i.id)),
                },
              ]
            : [
                { id: 'open', label: t.invoices.reopen, onSelect: () => void markOpen(i.id) },
                // Master–detail: the row only picks the entry there; this opens its dialog at once.
                ...(wide
                  ? [{ id: 'edit', label: t.actions.edit, onSelect: () => setTarget(i) }]
                  : []),
                {
                  id: 'booking',
                  label: t.invoices.ext.openBooking,
                  onSelect: () => void navigate(`/finance?open=inv-${i.id}`),
                },
                {
                  id: 'delete',
                  label: t.actions.delete,
                  danger: true,
                  onSelect: () => void deleteWithUndo(() => invoiceRepo.remove(i.id)),
                },
              ]
        }
        end={
          <>
            {i.status === 'open' && state.tone !== 'later' ? (
              <StateBadge tone={state.tone} label={state.label} />
            ) : null}
            <span className={styles.amount}>
              {formatMoney(i.status === 'open' ? remainingMinor(i) : i.amountMinor, i.currency)}
            </span>
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

  const openGroups = timeGroups.map((g) => ({
    id: g.id,
    label: t.groups[g.id as keyof typeof t.groups] as string,
    count: g.items.length,
    tone: g.id === 'overdue' || g.id === 'today' ? (g.id as 'overdue' | 'today') : undefined,
    children: <ItemList>{g.items.map((i) => renderRow(i))}</ItemList>,
  }));

  const pay = payWithUndo;

  return (
    <>
      <PageHeader
        title={t.invoices.title}
        // The open view starts with a group heading; the flat lists start with a row that needs its width.
        besideContent={view === 'open'}
        views={
          <Tabs
            label={t.invoices.view}
            value={view}
            options={[
              { value: 'open', label: t.invoices.open },
              { value: 'paid', label: t.invoices.paid },
              { value: 'all', label: t.invoices.ext.views.all },
            ]}
            onChange={setView}
          />
        }
      >
        {/* U26: while the open list is empty, the empty state holds the one filled step. */}
        <PageAction
          short={t.invoices.meta.quickAdd}
          variant={emptyOpen ? 'secondary' : 'primary'}
          onClick={() => setTarget({ draft: true })}
        >
          <Icon name="plus" size={18} />
          {t.invoices.add}
        </PageAction>
        <StartDataMenu moduleId="invoices" items={[advancedItem]} />
      </PageHeader>

      {invoices ? <InvoicesHead invoices={invoices} /> : null}

      {/* The open sum stands in the head; this copy is a hook for tests only. */}
      <div className={styles.srOnly} aria-hidden="true">
        <span data-testid="open-total">{openTotalText(invoices ?? [])}</span>
      </div>

      <SplitView
        enabled={wide && detail !== undefined}
        asideLabel={t.invoices.ext.detail.label}
        aside={
          detail ? (
            <InvoiceDetail
              invoice={detail}
              onEdit={() => setTarget(detail)}
              onClose={() => setPicked('closed')}
            />
          ) : null
        }
      >
        {invoices && shown.length === 0 ? (
          <EmptyState
            title={view === 'paid' ? t.invoices.emptyPaid : t.invoices.empty}
            testId="invoices-empty"
            motif={<SignatureMark id="bill" size={64} />}
          >
            {emptyOpen ? (
              <Button variant="primary" onClick={() => setTarget({ draft: true })}>
                {t.invoices.add}
              </Button>
            ) : null}
          </EmptyState>
        ) : null}
        {view === 'open' ? (
          <GroupedList listId="invoices" groups={openGroups} label={t.invoices.title} />
        ) : (
          <ItemList label={t.invoices.title}>{shown.map((i) => renderRow(i))}</ItemList>
        )}
      </SplitView>

      <InvoiceEditor target={openTarget} onClose={closeEditor} onDuplicated={setTarget} />
    </>
  );
}
