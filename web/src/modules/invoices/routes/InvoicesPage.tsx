import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { formatMoney } from '@/core/money';
import type { Stored } from '@/core/db/types';
import { formatDay, today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { groupByTime } from '@/core/time/groups';
import { t } from '@/strings';
import { deleteWithUndo } from '@/core/undo/withToast';
import { isTypingTarget } from '@/core/keyboard/typing';
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
  SelectionBar,
  SplitView,
  StateBadge,
  Tabs,
  TextField,
  useAdvancedMenuItem,
  useOpenParam,
  useSelection,
  useSplitView,
} from '@/ui';
import { InvoiceDetail } from '../components/InvoiceDetail';
import { InvoiceEditor, type InvoiceTarget } from '../components/InvoiceEditor';
import { PayStep } from '../components/PayStep';
import { markOpen } from '../actions';
import { payManyWithUndo, payWithUndo } from '../quickActions';
import { invoiceState, matchesQuery, openTotalText, remainingMinor, sortInvoices } from '../logic';
import { copyPaymentData } from '../pay';
import { InvoicesHead } from '../components/InvoicesHead';
import { InvoicesOverview } from '../components/InvoicesOverview';
import { SignatureMark } from '@/ui/identity';
import { usePageWidthAtLeast } from '@/ui/pageWidth';
import { invoiceRepo } from '../repo';
import { returnRoute } from '../returnTo';
import type { Invoice } from '../schema';
import styles from './invoices.module.css';
import { StartDataMenu } from '@/core/importer/StartDataMenu';

type View = 'open' | 'paid' | 'all' | 'overview';

export default function InvoicesPage() {
  const invoices = useLiveQuery(async () => sortInvoices(await invoiceRepo.active().toArray()), []);
  const [view, setViewState] = useState<View>('open');
  const [query, setQuery] = useState('');
  // Selection mode ("Auswählen"): open rows get a tick box, the bar marks the ticked ones as paid at once.
  const [selecting, setSelecting] = useState(false);
  const [target, setTarget] = useState<InvoiceTarget>(null);
  const [paying, setPaying] = useState<Stored<Invoice> | null>(null);
  // The invoice shown in the detail panel of the wide page (master–detail).
  const [picked, setPicked] = useState<{ id: string } | 'closed' | null>(null);
  const [params, setParams] = useSearchParams();
  // `?open=<id>` and `?do=pay` are untrusted input (the app is URL-addressable, and paying books into finance,
  // CONCEPT-LINKS §2 L7): the id must name a live invoice of this module (`invoiceRepo.get` – anything else opens
  // nothing), and `do=pay` only OPENS the pay step of an invoice that is still open. Nothing is written until
  // the person confirms there. Any other value of `do` is ignored; both parameters leave the URL after reading.
  // `from` (M-1) is only a key of the fixed list in `returnTo.ts` (`plan` → the planner): after „Bezahlt“ the
  // page hands the person back there; any other value means staying here. It leaves the URL with `do`.
  const doParam = useRef<string | null>(null);
  const fromParam = useRef<string | null>(null);
  useEffect(() => {
    doParam.current = params.get('do');
    fromParam.current = params.get('from');
  });
  const [returnTo, setReturnTo] = useState<string | undefined>();
  useOpenParam(
    (id) => invoiceRepo.get(id),
    (invoice) => {
      setPicked({ id: invoice.id });
      if (doParam.current === 'pay' && invoice.status === 'open') {
        setPaying(invoice);
        setReturnTo(returnRoute(fromParam.current));
      } else setTarget(invoice);
    },
  );
  // Without an id there is nothing to do: `do`, `from` (and an empty `open`) just leave the URL.
  const strayDo = (params.has('do') || params.has('from')) && !params.get('open');
  useEffect(() => {
    if (!strayDo) return;
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete('do');
        next.delete('from');
        if (!next.get('open')) next.delete('open');
        return next;
      },
      { replace: true },
    );
  }, [strayDo, setParams]);
  const day = today();
  // F15: the row's pay button follows the page, not the window (icon below 48 rem of page).
  const narrow = usePageWidthAtLeast(48) === false;
  const navigate = useNavigate();
  const advancedItem = useAdvancedMenuItem('invoices');
  // Master–detail (layout `split`): on a wide page an invoice opens in the panel beside the list, below that width
  // in its dialog (a sheet on the phone).
  const wide = useSplitView();
  // Beside the detail panel the list has about 60 % of the page: below 80 rem of page the pay button is the icon
  // there too, so status, amount and button stay on the row's first line (a 1280-px laptop).
  const roomy = usePageWidthAtLeast(80) !== false;

  // `?new=1` (Quick-Add) opens the create dialog; derived from the URL.
  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const overview = view === 'overview';
  // The overview tab lists nothing: no row, no detail panel.
  const inView = overview
    ? []
    : (invoices ?? []).filter((i) => view === 'all' || i.status === view);
  const shown = inView.filter((i) => matchesQuery(i, query));
  // Nothing open (or nothing at all): the empty state holds the one verb. A search that finds nothing is no
  // empty module: it says so beside the field.
  const emptyOpen = !!invoices && inView.length === 0 && (view === 'open' || view === 'all');
  const noMatch = inView.length > 0 && shown.length === 0;
  const timeGroups = groupByTime(shown, (i) => i.dueDate, day);
  // Open view: what is past its date stands in its own calm section above the time groups.
  const lateItems =
    view === 'open' ? (timeGroups.find((g) => g.id === 'overdue')?.items ?? []) : [];
  const restGroups = view === 'open' ? timeGroups.filter((g) => g.id !== 'overdue') : timeGroups;
  const selectable = (
    view === 'open' ? [...lateItems, ...restGroups.flatMap((g) => g.items)] : shown
  )
    .filter((i) => i.status === 'open')
    .map((i) => i.id);
  const selection = useSelection(selectable);
  // What the bar counts and pays: ticked rows that are still on screen and open (paid elsewhere meanwhile, or
  // hidden by the search, they drop out).
  const ticked = selection.ids;
  // Nothing left to tick (all paid elsewhere): the mode ends by itself, so it never comes back on unasked.
  const nothingToPick = selectable.length === 0;
  // (Adjusted while rendering, React's pattern for state that follows other state.)
  if (nothingToPick && selecting) setSelecting(false);
  // Esc ends the mode, not only the ticks (the hook clears them).
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !isTypingTarget(e.target) &&
        !document.querySelector('dialog[open]')
      )
        setSelecting(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selecting]);
  const stopSelecting = () => {
    selection.clear();
    setSelecting(false);
  };
  const setView = (next: View) => {
    stopSelecting();
    setViewState(next);
  };
  const payPicked = async () => {
    const ids = ticked;
    stopSelecting();
    await payManyWithUndo(ids);
  };
  // The panel shows the picked invoice, else the first row as the list shows it (the open view is grouped by time).
  const firstShown = view === 'open' ? timeGroups[0]?.items[0] : shown[0];
  const detail =
    picked === 'closed'
      ? undefined
      : ((picked ? shown.find((i) => i.id === picked.id) : undefined) ?? firstShown);
  const firstOpenId = (
    view === 'open' ? timeGroups[0]?.items[0] : shown.find((i) => i.status === 'open')
  )?.id;
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
    const badge =
      i.status === 'open' && state.tone !== 'later' ? (
        <StateBadge tone={state.tone} label={state.label} />
      ) : null;
    return (
      <ItemRow
        key={i.id}
        title={i.payee}
        // No plan mark on the row: it broke the page's stimulus budget, so „Im Plan · Mi“ is in the detail only
        // (package 10b, hand-off 10 „Stimulus“).
        tone={urgent ? (state.tone as 'overdue' | 'today') : undefined}
        meta={
          i.status === 'paid' ? (
            narrow ? (
              <>
                <span className={styles.amount}>{formatMoney(i.amountMinor, i.currency)}</span>
                {` · ${t.invoices.paidAt}: ${formatDay(i.paidAt ?? i.dueDate, 'd. MMM yyyy')}`}
              </>
            ) : (
              `${t.invoices.paidAt}: ${formatDay(i.paidAt ?? i.dueDate, 'd. MMM yyyy')}${i.reference ? ` · ${i.reference}` : ''}`
            )
          ) : narrow ? (
            // Phone (design check G4): one meta line. The state says when it is due ("war am 17. Sep. fällig",
            // "in 2 Tagen"), so it stands here instead of in a second row of its own; the reference and the
            // repeat are in the entry's dialog.
            // 0b-8 follow-up 4: the amount opens this line (paid rows too) instead of standing beside the name,
            // so the payee has the row's width ("Stadtwerke…" before).
            <>
              <span className={styles.amount}>{formatMoney(remainingMinor(i), i.currency)}</span>
              {' · '}
              {badge ?? formatDay(i.dueDate, 'EEE, d. MMM')}
              {extra ? ` · ${extra}` : ''}
            </>
          ) : (
            `${t.invoices.dueDate}: ${formatDay(i.dueDate, 'EEE, d. MMM')}${i.reference ? ` · ${i.reference}` : ''}${i.repeat ? ` · ${t.invoices.repeatMeta(t.invoices.repeatOptions[i.repeat])}` : ''}${extra ? ` · ${extra}` : ''}`
          )
        }
        lead={
          <span
            className={styles.plate}
            data-initial={i.payee.slice(0, 1).toUpperCase()}
            aria-hidden="true"
          />
        }
        current={wide && detail?.id === i.id}
        selectable={selecting && i.status === 'open'}
        selected={selection.isSelected(i.id)}
        onSelectChange={(_, extend) => selection.toggle(i.id, extend)}
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
            {narrow ? null : badge}
            {narrow ? null : (
              <span className={styles.amount}>
                {formatMoney(i.status === 'open' ? remainingMinor(i) : i.amountMinor, i.currency)}
              </span>
            )}
            {i.status === 'open' ? (
              // Phone (G4): only the first open row keeps its pay button (the next one to pay); the others pay
              // from the swipe and the row's menu, so the name keeps the row's width.
              narrow && i.id !== firstOpenId ? null : narrow ||
                (wide && detail !== undefined && !roomy) ? (
                <IconButton label={t.invoices.markPaid} onClick={() => void pay(i.id)}>
                  <Icon name="check" />
                </IconButton>
              ) : (
                <Button size="sm" onClick={() => void pay(i.id)}>
                  {t.invoices.markPaid}
                </Button>
              )
            ) : narrow ? null : (
              // Phone: "Wieder öffnen" is in the row's menu, the payee keeps the row's width.
              <Button size="sm" variant="ghost" onClick={() => void markOpen(i.id)}>
                {t.invoices.reopen}
              </Button>
            )}
          </>
        }
      />
    );
  }

  const toGroup = (g: (typeof timeGroups)[number]) => ({
    id: g.id,
    label: t.groups[g.id as keyof typeof t.groups] as string,
    count: g.items.length,
    tone: g.id === 'overdue' || g.id === 'today' ? (g.id as 'overdue' | 'today') : undefined,
    children: <ItemList>{g.items.map((i) => renderRow(i))}</ItemList>,
  });
  const openGroups = restGroups.map(toGroup);
  const lateGroups = lateItems.length ? [toGroup({ id: 'overdue', items: lateItems })] : [];

  const pay = payWithUndo;

  return (
    <>
      <PageHeader
        title={t.invoices.title}
        // A list starts with its search row (room left for the menu at its end); an empty open view with its empty
        // state; the overview and the empty paid list start with something that needs the width.
        besideContent={inView.length > 0 || view === 'open'}
        views={
          <Tabs
            label={t.invoices.view}
            value={view}
            options={[
              { value: 'open', label: t.invoices.open },
              { value: 'paid', label: t.invoices.paid },
              { value: 'all', label: t.invoices.ext.views.all },
              { value: 'overview', label: t.invoices.ext.overview.tab },
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

      {overview ? (
        invoices ? (
          <InvoicesOverview
            invoices={invoices}
            onShowLate={() => {
              // The late invoices it promised: the whole open list, not one still filtered by an old search.
              setQuery('');
              setView('open');
            }}
          />
        ) : null
      ) : (
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
          {inView.length > 0 ? (
            <div className={styles.listBar}>
              <TextField
                label={t.invoices.ext.search.label}
                labelHidden
                type="search"
                placeholder={t.invoices.ext.search.placeholder}
                data-list-search
                value={query}
                onChange={(e) => {
                  // A new search starts a new selection: nothing hidden stays ticked.
                  selection.clear();
                  setQuery(e.target.value);
                }}
              />
              {selectable.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={selecting}
                  onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
                  data-testid="invoices-select"
                >
                  {t.invoices.ext.batch.select}
                </Button>
              ) : null}
            </div>
          ) : null}
          {selecting ? (
            <SelectionBar count={ticked.length} onCancel={stopSelecting}>
              <Button variant="primary" onClick={() => void payPicked()}>
                {t.invoices.markPaid}
              </Button>
              {ticked.length < selectable.length ? (
                <Button variant="ghost" onClick={selection.selectAll}>
                  {t.invoices.ext.batch.selectAll}
                </Button>
              ) : null}
            </SelectionBar>
          ) : null}
          {noMatch ? (
            <p className={styles.noMatch} data-testid="invoices-no-match">
              {t.invoices.ext.search.none(query.trim())}{' '}
              <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                {t.invoices.ext.search.clear}
              </Button>
            </p>
          ) : null}
          {invoices && inView.length === 0 ? (
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
          {lateGroups.length > 0 ? (
            // What is past its date stands apart: its own area under a hairline in the warning tone above the other groups; the red
            // stays on the group's word and the rows' badges (red only for overdue money). Same list id, so the fold
            // state of "Überfällig" is the one it always had.
            <div className={styles.late} data-testid="invoices-late">
              <GroupedList listId="invoices" groups={lateGroups} label={t.groups.overdue} />
            </div>
          ) : null}
          {view === 'open' ? (
            <GroupedList listId="invoices" groups={openGroups} label={t.invoices.title} />
          ) : (
            <ItemList label={t.invoices.title}>{shown.map((i) => renderRow(i))}</ItemList>
          )}
        </SplitView>
      )}

      <InvoiceEditor target={openTarget} onClose={closeEditor} onDuplicated={setTarget} />
      <PayStep
        invoice={paying}
        onClose={() => {
          setPaying(null);
          setReturnTo(undefined);
        }}
        // Back where the step was asked for (the planner keeps its day): the visit here was a step, not a place,
        // so it gives its history entry to the plan. The toast with the undo stays.
        onPaid={returnTo ? () => void navigate(returnTo, { replace: true }) : undefined}
      />
    </>
  );
}
