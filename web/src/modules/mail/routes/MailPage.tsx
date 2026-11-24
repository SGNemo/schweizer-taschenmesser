import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listMailAccounts } from '@/core/mail/accounts';
import { mailLabels } from '@/core/mail/service';
import type { MailAccountRef, MailLabel } from '@/core/mail/types';
import { useSettings } from '@/core/settings/settings';
import { settingsPath } from '@/core/settings/registry/paths';
import { useUiStore } from '@/stores/ui';
import { PlanMarkLink, usePlanMarks } from '@/core/entitylinks/PlanMark';
import { t } from '@/strings';
import { useModuleStates } from '@/core/modules/activation';
import {
  Button,
  Chip,
  Chips,
  GroupedList,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  EmptyState,
  PageAction,
  PageHeader,
  SelectField,
  Skeleton,
  TextField,
  useMediaQuery,
  useSelection,
  type GroupedListGroup,
  type RowMenuItem,
} from '@/ui';
import { SignatureMark } from '@/ui/identity';
import { DEMO_ACCOUNT, DEMO_EMAIL, type CachedThreadView } from '../cache';
import { MailError } from '../components/MailError';
import { MailSettingsPanel } from '../components/MailSettingsPanel';
import { ComposeDialog } from '../components/ComposeDialog';
import { PendingSendBar } from '../components/PendingSendBar';
import { InvoiceLine } from '../components/InvoiceLine';
import { ThreadView } from '../components/ThreadView';
import { BatchBar } from '../components/BatchBar';
import { createInvoice, noteReminder, type InvoiceOffer } from '../invoiceRow';
import { useInvoiceOffers } from '../useInvoiceOffers';
import { emptyCompose, type ComposeState } from '../composeState';
import { hasFeature } from '@/core/mail/service';
import { usePageWidthAtLeast } from '@/ui/pageWidth';
import { InboxHead } from '../components/InboxHead';
import { PlanAllDialog } from '../components/PlanAllDialog';
import {
  deletedThreads,
  openPlans,
  planMail,
  planMany,
  plannedThreads,
  planTitle,
  safeThreadId,
} from '../planMail';
import styles from '../components/mail.module.css';
import { dayGroup, personName, shortWhen, subjectOf, type DayGroup } from '../format';
import { threadRepo } from '../repo';
import { settings } from '../settings';
import { rowAction } from '../rowActions';
import { STEPS } from '../mailActions';
import { answeredRows, closeAnswered } from '../answered';
import {
  FILTERS,
  forgetSearch,
  hasFilter,
  isSaved,
  readSaved,
  readSearches,
  rememberSearch,
  saveSearch,
  suggestionsFor,
  toggleFilter,
} from '../searchHistory';
import { focusedThreadId, useMailKeys } from '../useMailKeys';
import { useMailbox } from '../useMailbox';
import { KIND_FILTERS, kindFilterOf, kindOf } from '../kinds';
import { markDone, markLater, readMarks, unmark, waitingThreads, type WaitingRule } from '../queue';
import { loadThreads } from '../cache';
import { now } from '@/core/time/now';
import { useLocalSearch } from '../useLocalSearch';
import type { HitLine } from '../searchIndex';
import { Highlight } from '../components/Highlight';
import { useMailSummary } from '../useSummary';

const GROUPS: DayGroup[] = ['today', 'yesterday', 'week', 'older'];
const DEFAULT_LABELS: MailLabel[] = ['INBOX', 'STARRED', 'IMPORTANT', 'SENT'].map((id) => ({
  id,
  name: id,
  kind: 'system',
}));

const labelName = (l: MailLabel) => t.mail.page.labels[l.id] ?? l.name;

/** A part of the search result: „Auf diesem Gerät“ or „Im Postfach“, with a quiet line when it has no rows. */
interface ListSection {
  id: string;
  label: string;
  detail?: string;
  threads: CachedThreadView[];
  note?: string;
  /** More hits than shown: a quiet button shows the next ones. */
  more?: { count: number; onShow: () => void };
  /** All hits of the part when only some are shown. */
  total?: number;
}

function ThreadList({
  threads,
  onOpen,
  menuFor,
  planned,
  planLabel,
  plannerOn,
  onPlan,
  titleOf,
  invoices,
  onInvoice,
  selection,
  answered,
  onAnswered,
  sections,
  terms,
  hitLines,
}: {
  threads: CachedThreadView[];
  /** A running search: these parts instead of the day groups (every part open). */
  sections?: ListSection[];
  /** Search words to mark in sender, subject and preview (as text, never HTML). */
  terms?: readonly string[];
  /** Where a hit was found when the row's own lines do not show it. */
  hitLines?: ReadonlyMap<string, HitLine>;
  /** Select mode: a checkbox per row (Shift-click takes a range). */
  selection?: {
    isSelected: (id: string) => boolean;
    toggle: (id: string, extend: boolean) => void;
  };
  onOpen: (id: string) => void;
  /** Quick actions of one row (in den Plan, read/unread, archive). */
  menuFor?: (th: CachedThreadView) => RowMenuItem[];
  /** Threads that have a ToDo made from them: the row says „im Plan“ instead of offering it. */
  planned: ReadonlySet<string>;
  /** „In den Plan“ (planner on) or „Als ToDo“. */
  planLabel: string;
  /** Planner on: the row mark says „im Plan“, else „als ToDo da“. */
  plannerOn: boolean;
  onPlan?: (th: CachedThreadView) => void;
  /** The ToDo title the action would write (the label names it). */
  titleOf: (th: CachedThreadView) => string;
  /** Rows read as an invoice or payment reminder: the muted line with its values and one verb. */
  invoices: ReadonlyMap<string, InvoiceOffer>;
  onInvoice: (th: CachedThreadView, offer: InvoiceOffer) => void;
  /** Planned rows whose newest message is the person's own: thread id → open ToDo id („Beantwortet?“). */
  answered: ReadonlyMap<string, string>;
  onAnswered: (todoId: string) => void;
}) {
  const hover = useMediaQuery('(hover: hover)');
  // „Im Plan · Mi“ (planner hub 2, package 10b): one read for every row shown, the day of the ToDo made from the
  // thread (its `origin` link). Without a day yet the row keeps its own „im Plan“ (as before 10b).
  const listed = sections ? sections.flatMap((sec) => sec.threads) : threads;
  const marks = usePlanMarks(
    'mail',
    plannerOn
      ? listed.map((th) => ({ id: th.id, ...(planned.has(th.id) ? { fallback: true } : {}) }))
      : [],
  );
  const dayOf = (id: string) => {
    const mark = marks?.get(id);
    return mark && mark.kind !== 'noDay' ? mark : undefined;
  };
  const rowsOf = (rows: CachedThreadView[]) => (
    <ItemList>
      {rows.map((th) => (
        <ItemRow
          key={th.id}
          // Sender and time share the title line, subject and snippet are two lines at most: a row keeps
          // its height beside the reading pane (design check G1, G4).
          title={
            <span className={styles.rowTitle} data-thread-id={th.id}>
              <span className={th.unread ? styles.unreadRow : styles.rowFrom}>
                <Highlight text={personName(th.from)} terms={terms} />
                {th.messageCount > 1 ? ` (${th.messageCount})` : ''}
              </span>
              <span className={styles.rowWhen}>
                {th.labelIds.includes('STARRED') ? (
                  <span
                    className={styles.starMark}
                    role="img"
                    aria-label={t.mail.page.starredMark}
                    data-testid="mail-starred"
                  >
                    <Icon name="star" size={14} />{' '}
                  </span>
                ) : null}
                {/* „als ToDo da“ / „im Plan“ until the plan gives the ToDo a day: then the shared mark stands under
                    the meta line instead. */}
                {planned.has(th.id) && !(plannerOn && dayOf(th.id)) ? (
                  <span className={styles.planMark} data-testid="mail-in-plan">
                    {plannerOn ? t.mail.plan.mark : t.mail.plan.todo.mark} ·{' '}
                  </span>
                ) : null}
                {shortWhen(th.date)}
              </span>
            </span>
          }
          meta={
            <span className={styles.rowText}>
              <span className={th.unread ? styles.unreadRow : undefined}>
                <Highlight text={subjectOf(th.subject)} terms={terms} />
              </span>
              {th.snippet ? (
                <span className={styles.snippet}>
                  {' – '}
                  <Highlight text={th.snippet} terms={terms} />
                </span>
              ) : null}
            </span>
          }
          below={plannerOn && dayOf(th.id) ? <PlanMarkLink state={dayOf(th.id)} /> : undefined}
          onOpen={() => onOpen(th.id)}
          selectable={!!selection}
          selected={selection?.isSelected(th.id)}
          onSelectChange={(_, extend) => selection?.toggle(th.id, extend)}
          menu={menuFor?.(th)}
          // A quiet button only where the pointer hovers (PC); on touch it is in ⋯ and a swipe,
          // so a phone row never carries a standing button.
          actions={
            hover && onPlan && !planned.has(th.id) ? (
              <Button
                size="sm"
                variant="ghost"
                aria-label={t.mail.plan.actionFor(planLabel, titleOf(th))}
                onClick={() => onPlan(th)}
                data-testid="mail-plan-row"
              >
                {planLabel}
              </Button>
            ) : undefined
          }
          onSwipeLeft={onPlan && !planned.has(th.id) ? () => onPlan(th) : undefined}
          swipeLeftLabel={planLabel}
        >
          {hitLines?.get(th.id) ? (
            <p className={styles.hitLine} data-testid="mail-hit-line">
              {hitLines.get(th.id)!.kind === 'file' ? t.mail.find.inFile : t.mail.find.inText}
              {': '}
              <Highlight text={hitLines.get(th.id)!.text} terms={terms} />
            </p>
          ) : null}
          {invoices.get(th.id) ? (
            <InvoiceLine
              offer={invoices.get(th.id)!}
              onAct={() => onInvoice(th, invoices.get(th.id)!)}
            />
          ) : null}
          {answered.get(th.id) ? (
            <AnsweredLine title={titleOf(th)} onDone={() => onAnswered(answered.get(th.id)!)} />
          ) : null}
        </ItemRow>
      ))}
    </ItemList>
  );
  if (sections)
    return (
      <GroupedList
        listId="mail-search"
        forceOpen
        groups={sections.map((sec) => ({
          id: sec.id,
          label: sec.label,
          count: sec.total ?? sec.threads.length,
          countHidden: (sec.total ?? sec.threads.length) === 0,
          detail: sec.detail,
          children: (
            <>
              {/* A status line that stays mounted (a live region must exist before its text changes): a screen
                  reader hears „nothing more“ or „not reachable“ when the part settles. */}
              <p className={sec.note ? styles.sectionNote : 'sr-only'} role="status">
                {sec.note ?? ''}
              </p>
              {sec.threads.length > 0 ? rowsOf(sec.threads) : null}
              {sec.more ? (
                <div className={styles.row}>
                  <Button variant="ghost" onClick={sec.more.onShow}>
                    {t.mail.find.onDeviceMore(sec.more.count)}
                  </Button>
                </div>
              ) : null}
            </>
          ),
        }))}
      />
    );
  const groups: GroupedListGroup[] = GROUPS.map((g) => {
    const rows = threads.filter((th) => dayGroup(th.date) === g);
    return { id: g, label: t.mail.page.groups[g], count: rows.length, children: rowsOf(rows) };
  }).filter((g) => g.count > 0);
  return <GroupedList listId="mail" groups={groups} />;
}

const NO_OFFERS: ReadonlyMap<string, InvoiceOffer> = new Map();
const NO_ANSWERED: ReadonlyMap<string, string> = new Map();
const NO_PLANS: ReadonlyMap<string, string> = new Map();

/** „Beantwortet? · Erledigt“: a question, never a claim; the one verb ticks the ToDo off (with undo). */
function AnsweredLine({ title, onDone }: { title: string; onDone: () => void }) {
  return (
    <p className={styles.invoiceLine} data-testid="mail-answered">
      <span className={styles.invoiceText}>{t.mail.answered.question}</span>
      <Button
        size="sm"
        variant="ghost"
        aria-label={t.mail.answered.doneFor(title)}
        onClick={onDone}
      >
        {t.mail.answered.done}
      </Button>
    </p>
  );
}

/** Page width (rem) from which folders, list and reading pane stand side by side: 12 + 20 + 24 rem and two gaps. */
const MAIL_COLUMNS_REM = 58;
/** Hits of the device part shown at once, and added per „weitere zeigen“. */
const DEVICE_PAGE = 50;

export default function MailPage() {
  const [params, setParams] = useSearchParams();
  const [prefs] = useSettings('module.mail', settings.schema, settings.defaults);
  const live = useLiveQuery(() => listMailAccounts(), []);
  const demoCount = useLiveQuery(
    () =>
      threadRepo.table
        .where('accountKey')
        .equals(DEMO_ACCOUNT)
        .filter((r) => r.deletedAt === null)
        .count(),
    [],
  );
  const accounts: MailAccountRef[] = useMemo(() => {
    if (!live) return [];
    if (live.length > 0) return live;
    return demoCount ? [{ key: DEMO_ACCOUNT, connectorId: 'demo', email: DEMO_EMAIL }] : [];
  }, [live, demoCount]);

  const account = accounts.find((a) => a.key === params.get('account')) ?? accounts[0];
  const labelId = params.get('label') ?? 'INBOX';
  const query = params.get('q') ?? '';
  const threadId = params.get('thread');
  const personalOnly = params.get('personal') === '1';
  const kind = kindFilterOf(params.get('kind'));
  // „Wartet auf mich“: the folder entry, or `?view=waiting` (the planner's jump). The address word is read once
  // and removed (it is untrusted input; only this one value means anything), nothing is written.
  const [queueOpen, setQueueOpen] = useState(false);
  const viewParam = params.get('view');
  if (viewParam === 'waiting' && !queueOpen) setQueueOpen(true);
  useEffect(() => {
    if (viewParam === null) return;
    const p = new URLSearchParams(params);
    p.delete('view');
    if (viewParam === 'waiting') p.delete('q');
    setParams(p, { replace: true });
  }, [viewParam, params, setParams]);
  const states = useModuleStates();
  const planLabel = states?.planner ? t.mail.plan.action : t.mail.plan.asTodo;
  const canPlan = !!states?.todos;
  const planned =
    useLiveQuery(
      () => (account ? plannedThreads(account.key) : Promise.resolve(new Set<string>())),
      [account?.key],
    ) ?? new Set<string>();
  const [planAll, setPlanAll] = useState(false);
  // Read when the preview opens: which listed mails had a ToDo that was deleted since.
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState(query);
  const [seenQuery, setSeenQuery] = useState(query);
  if (seenQuery !== query) {
    // the address changed (search ended, link followed): the field follows
    setSeenQuery(query);
    setDraft(query);
  }
  const [panel, setPanel] = useState(false);
  const [compose, setCompose] = useState<
    { state: ComposeState; title: string; account: MailAccountRef } | undefined
  >();
  const [fetched, setFetched] = useState<{ key: string; labels: MailLabel[] } | undefined>();
  const labels =
    account && fetched?.key === account.key && account.key !== DEMO_ACCOUNT
      ? fetched.labels
      : DEFAULT_LABELS;

  const box = useMailbox(account, labelId, query);
  // A running search: the hits on this device first (instant, also offline), the mailbox's answer below without them.
  const searching = query.trim() !== '';
  const inQueue = queueOpen && !searching;
  const waitingRule = (prefs as { waitingRule?: WaitingRule } | undefined)?.waitingRule ?? 'reply';
  // The queue reads the cached headers (all folders of this device, newest 200) and the device-local marks.
  const cachedHeaders = useLiveQuery(
    () => (account ? loadThreads(account.key, { limit: 200 }) : Promise.resolve([])),
    [account?.key],
  );
  const [marks, setMarks] = useState(readMarks);
  const waiting = useMemo(
    () =>
      account && cachedHeaders
        ? waitingThreads(cachedHeaders, {
            rule: waitingRule,
            marks,
            accountKey: account.key,
            me: account.email,
            at: now(),
          })
        : [],
    [account, cachedHeaders, waitingRule, marks],
  );
  const local = useLocalSearch(account?.key, query, box.tick);
  const localIds = useMemo(() => new Set(local?.hits.map((h) => h.thread.id)), [local]);
  const listed = useMemo(() => {
    if (inQueue) return waiting;
    if (!searching) return box.threads;
    // A thread both parts know shows the mailbox's fresh copy (labels, unread) in the device part.
    const fresh = new Map(box.threads.map((th) => [th.id, th]));
    return [
      ...(local?.hits.map((h) => {
        const f = fresh.get(h.thread.id);
        // The index knows attachments from opened mails that Gmail's list does not report.
        return f ? { ...f, hasAttachment: f.hasAttachment || h.thread.hasAttachment } : h.thread;
      }) ?? []),
      ...box.threads.filter((th) => !localIds.has(th.id)),
    ];
  }, [inQueue, waiting, searching, local, localIds, box.threads]);
  // The device part shows 50 hits at first (a broad word can match hundreds); „N weitere zeigen“ adds more.
  const limitKey = `${account?.key}|${query}`;
  const [deviceLimit, setDeviceLimit] = useState({ q: limitKey, n: DEVICE_PAGE });
  if (deviceLimit.q !== limitKey) setDeviceLimit({ q: limitKey, n: DEVICE_PAGE });
  const hitLines = useMemo(() => {
    const m = new Map<string, HitLine>();
    for (const h of local?.hits ?? []) if (h.line) m.set(h.thread.id, h.line);
    return m;
  }, [local]);
  // Three columns follow the room the page really has (sidebar, rail and window all count); outside a page container the window decides.
  const pageWide = usePageWidthAtLeast(MAIL_COLUMNS_REM);
  const windowWide = useMediaQuery('(min-width: 1200px)');
  const wide = pageWide ?? windowWide;
  const summary = useMailSummary();
  const [recent, setRecent] = useState<string[]>(readSearches);
  const [saved, setSaved] = useState<string[]>(readSaved);
  const searchForm = useRef<HTMLFormElement>(null);
  // The remembered entry that matches the running search (any case), in its stored spelling.
  const savedQuery = query
    ? saved.find((x) => x.toLowerCase() === query.trim().toLowerCase())
    : undefined;
  const senders = useMemo(() => [...new Set(listed.map((th) => personName(th.from)))], [listed]);
  const suggestions = suggestionsFor(draft, recent, senders);
  const images = (prefs as { images?: string } | undefined)?.images === 'always';
  const cacheBodies = (prefs as { cacheBodies?: boolean } | undefined)?.cacheBodies ?? true;
  const confirmMoves = (prefs as { confirmMoves?: boolean } | undefined)?.confirmMoves ?? true;
  const localAi = (prefs as { localAi?: boolean } | undefined)?.localAi ?? false;
  const offerPersonal = (prefs as { offerPersonal?: boolean } | undefined)?.offerPersonal ?? true;
  const offerPlanAll = (prefs as { offerPlanAll?: boolean } | undefined)?.offerPlanAll ?? true;
  const shown = useMemo(() => {
    // „Persönlich“ shapes the inbox, not a search: a search looks at every mail (an invoice is not from a person).
    // Headers cached before the flag existed (`personal` unknown) stay in until the next fetch.
    if (searching) {
      const here = listed.filter((th) => localIds.has(th.id)).slice(0, deviceLimit.n);
      return [...here, ...listed.filter((th) => !localIds.has(th.id))];
    }
    if (inQueue || !offerPersonal) return listed;
    if (kind) return listed.filter((th) => kindOf(th) === kind);
    return personalOnly ? listed.filter((th) => th.personal !== false) : listed;
  }, [inQueue, searching, listed, localIds, deviceLimit.n, personalOnly, kind, offerPersonal]);
  const offerInvoices = (prefs as { offerInvoices?: boolean } | undefined)?.offerInvoices ?? true;
  const invoices = useInvoiceOffers(shown, offerInvoices) ?? NO_OFFERS;
  // Select mode (manage permission): checkboxes on the rows and the batch bar. A new folder, search or
  // account starts without a selection.
  const [selecting, setSelecting] = useState(false);
  // The row that holds the select switch (`Button` takes no ref): focus goes back to the switch after a batch.
  const selectRow = useRef<HTMLDivElement>(null);
  // Bumped when a batch changed the thread open beside the list: it loads again with its new labels.
  const [viewTick, setViewTick] = useState(0);
  const order = useMemo(() => shown.map((th) => th.id), [shown]);
  const selection = useSelection(order);
  // Only what is on screen counts (a reload can drop a selected thread).
  const selected = shown.filter((th) => selection.isSelected(th.id));
  // A batch emptied the list: select mode ends with it (its switch is gone).
  if (selecting && shown.length === 0 && !box.loading) setSelecting(false);
  const viewKey = `${account?.key}|${labelId}|${query}|${personalOnly}|${kind}|${inQueue}`;
  const [seenView, setSeenView] = useState(viewKey);
  if (seenView !== viewKey) {
    setSeenView(viewKey);
    setSelecting(false);
    if (selection.count > 0) selection.clear();
  }
  const showAnswered = (prefs as { showAnswered?: boolean } | undefined)?.showAnswered ?? true;
  const openTodos =
    useLiveQuery(
      () =>
        // Only while ToDos are on: nobody else can tick the ToDo off.
        account && showAnswered && canPlan ? openPlans(account.key) : Promise.resolve(NO_PLANS),
      [account?.key, showAnswered, canPlan],
    ) ?? NO_PLANS;
  const answered = useMemo(
    () => answeredRows(shown, openTodos, showAnswered),
    [shown, openTodos, showAnswered],
  );
  // An unsure invoice row asked for the sheet: the thread opens with it (never a write without a look).
  const [startInvoice, setStartInvoice] = useState<string | undefined>();
  // The filter hides every mail loaded so far: say so and offer the way back, never a bare „empty“.
  const filteredOut =
    !inQueue && (personalOnly || !!kind) && offerPersonal && box.threads.length > 0;
  // Walking through the queue one mail at a time (the step bar above the open mail).
  const [walking, setWalking] = useState(false);
  if (walking && !inQueue) setWalking(false);

  // `?open=<threadId>` (a link back from a ToDo or the planner) is untrusted: a plain id, and only a
  // thread this account has in its cache, is opened; anything else is dropped without a request.
  const openParam = params.get('open');
  useEffect(() => {
    if (openParam === null || !account) return;
    const id = safeThreadId(openParam);
    void (async () => {
      const known = id ? await threadRepo.get(`${account.key}|${id}`) : undefined;
      const p = new URLSearchParams(params);
      p.delete('open');
      if (known) p.set('thread', id!);
      // Not on this device (another device's entry, an old cache): say so instead of a silent inbox.
      // A malformed value is dropped without a word: it names no mail.
      else if (id) useUiStore.getState().toast(t.mail.plan.notHere);
      setParams(p, { replace: true });
    })();
  }, [openParam, account, params, setParams]);

  useEffect(() => {
    if (!account || account.key === DEMO_ACCOUNT) return;
    let alive = true;
    void mailLabels(account)
      .then((l) => alive && setFetched({ key: account.key, labels: l }))
      .catch(() => undefined); // the standard folders stay
    return () => {
      alive = false;
    };
  }, [account]);

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p);
  }

  const canWrite =
    !!account && (hasFeature(account, 'mail-send') || hasFeature(account, 'mail-modify'));
  const shortcuts = (prefs as { shortcuts?: boolean } | undefined)?.shortcuts ?? true;
  // Page-level keys; the open thread adds its own (archive, star, reply …) in `ThreadView`.
  useMailKeys(shortcuts && !!account, {
    compose: () => {
      if (canWrite && account)
        setCompose({ state: emptyCompose(), title: t.mail.write.compose.titleNew, account });
    },
    search: () => searchForm.current?.querySelector<HTMLInputElement>('input')?.focus(),
    back: () => {
      if (!threadId) return;
      setStartInvoice(undefined);
      update({ thread: null });
    },
    open: () => {
      const id = focusedThreadId();
      if (id) update({ thread: id });
    },
    select: () => {
      const id = focusedThreadId();
      if (!id || !account || !hasFeature(account, 'mail-modify')) return;
      setSelecting(true);
      selection.toggle(id, false);
    },
  });
  const header = (
    <>
      <InboxHead unread={summary && summary.total > 0 ? summary.unread : undefined} />
      <PageHeader title={t.mail.meta.name}>
        {canWrite && account ? (
          <PageAction
            short={t.mail.write.short}
            plusName={t.mail.write.newMail}
            onClick={() =>
              setCompose({ state: emptyCompose(), title: t.mail.write.compose.titleNew, account })
            }
          >
            <Icon name="plus" size={18} />
            {t.mail.write.newMail}
          </PageAction>
        ) : null}
        {/* In the head, so the panel (it alone clears the mail cache) opens in every state of the page: no account,
            loading, an open mail in a narrow window. Named in words: the gear beside it is the module's. */}
        <Button variant="ghost" onClick={() => setPanel(true)}>
          {t.mail.page.settings}
        </Button>
      </PageHeader>
    </>
  );

  if (live && accounts.length === 0)
    return (
      <>
        {header}
        <EmptyState
          title={t.mail.connect.title}
          testId="mail-empty"
          motif={<SignatureMark id="stamp" size={64} />}
        >
          <p>{t.mail.connect.body}</p>
          <Link to={settingsPath('verbindungen', 'connectors')}>{t.mail.connect.action}</Link>
        </EmptyState>
        <MailSettingsPanel open={panel} onClose={() => setPanel(false)} />
      </>
    );
  if (!account)
    return (
      <>
        {header}
        <Skeleton height="8rem" />
        <MailSettingsPanel open={panel} onClose={() => setPanel(false)} />
      </>
    );

  const writeUi = (
    <>
      <PendingSendBar
        onReopen={(state, acc) =>
          setCompose({ state, title: t.mail.write.compose.titleNew, account: acc })
        }
      />
      {compose ? (
        <ComposeDialog
          account={compose.account}
          initial={compose.state}
          title={compose.title}
          onClose={() => setCompose(undefined)}
        />
      ) : null}
    </>
  );

  const threadView = threadId ? (
    <ThreadView
      key={`${account.key}|${threadId}|${startInvoice === threadId ? 'invoice' : ''}|${viewTick}`}
      account={account}
      threadId={threadId}
      cacheBodies={cacheBodies}
      autoLoadImages={images}
      labels={labels}
      confirmMoves={confirmMoves}
      localAi={localAi}
      shortcuts={shortcuts}
      onChanged={box.reload}
      // A forward that finished loading never replaces a compose window the user opened meanwhile.
      onCompose={(state, title) => setCompose((cur) => cur ?? { state, title, account })}
      onBack={() => {
        setStartInvoice(undefined);
        update({ thread: null });
      }}
      startInvoice={startInvoice === threadId}
    />
  ) : null;

  const walkIndex = walking && threadId ? waiting.findIndex((th) => th.id === threadId) : -1;
  /** The next mail of the walk after the open one (the list is read before a mark changes it). */
  const walkOn = (from: number, marked: boolean) => {
    const next = waiting[from + 1];
    if (next) return update({ thread: next.id });
    setWalking(false);
    update({ thread: null });
    // After a mark its undo notice stays (one notice at a time); the end of the walk speaks for itself then.
    if (!marked) useUiStore.getState().toast(t.mail.queue.walkEnd);
  };
  const doneWith = (th: CachedThreadView, how: 'done' | 'later') => {
    setMarks(how === 'done' ? markDone(account.key, th.id) : markLater(account.key, th.id));
    useUiStore.getState().toast(how === 'done' ? t.mail.queue.doneToast : t.mail.queue.laterToast, {
      label: t.ui.undo,
      run: () => setMarks(unmark(account.key, th.id)),
    });
  };
  const stepBar =
    walkIndex >= 0 ? (
      <div className={styles.stepBar} role="group" aria-label={t.mail.queue.stepBar}>
        <span className={styles.stepText}>{t.mail.queue.step(walkIndex + 1, waiting.length)}</span>
        <Button
          size="sm"
          aria-label={t.mail.queue.doneFor(planTitle(account, waiting[walkIndex]!))}
          onClick={() => {
            const th = waiting[walkIndex]!;
            doneWith(th, 'done');
            walkOn(walkIndex, true);
          }}
        >
          {t.mail.queue.done}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={t.mail.queue.laterFor(planTitle(account, waiting[walkIndex]!))}
          onClick={() => {
            const th = waiting[walkIndex]!;
            doneWith(th, 'later');
            walkOn(walkIndex, true);
          }}
        >
          {t.mail.queue.later}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => walkOn(walkIndex, false)}>
          {t.mail.queue.next}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setWalking(false);
            update({ thread: null });
          }}
        >
          {t.mail.queue.leave}
        </Button>
      </div>
    ) : null;

  // Phone and narrow windows: the mail replaces the list. From 58 rem of page both stay (see below).
  if (threadId && !wide)
    return (
      <>
        {header}
        {writeUi}
        {stepBar}
        {threadView}
        <MailSettingsPanel open={panel} onClose={() => setPanel(false)} />
      </>
    );

  const canModify = hasFeature(account, 'mail-modify');
  const onPlan = canPlan
    ? (th: CachedThreadView) => void planMail(account, th, box.reload)
    : undefined;
  const menuFor =
    onPlan || canModify || inQueue
      ? (th: (typeof box.threads)[number]): RowMenuItem[] => [
          ...(inQueue
            ? [
                { id: 'done', label: t.mail.queue.done, onSelect: () => doneWith(th, 'done') },
                { id: 'later', label: t.mail.queue.later, onSelect: () => doneWith(th, 'later') },
              ]
            : []),
          ...(onPlan && !planned.has(th.id)
            ? [{ id: 'plan', label: planLabel, onSelect: () => onPlan(th) }]
            : []),
          ...(canModify ? modifyItems(th) : []),
        ]
      : undefined;
  const starItem = (th: (typeof box.threads)[number]): RowMenuItem =>
    th.labelIds.includes('STARRED')
      ? {
          id: 'unstar',
          label: t.mail.page.rowUnstar,
          onSelect: () => void rowAction(account, th, 'unstar', box.reload),
        }
      : {
          id: 'star',
          label: t.mail.page.rowStar,
          onSelect: () => void rowAction(account, th, 'star', box.reload),
        };
  const modifyItems = (th: (typeof box.threads)[number]): RowMenuItem[] => [
    th.unread
      ? {
          id: 'read',
          label: t.mail.page.rowRead,
          onSelect: () => void rowAction(account, th, 'read', box.reload),
        }
      : {
          id: 'unread',
          label: t.mail.page.rowUnread,
          onSelect: () => void rowAction(account, th, 'unread', box.reload),
        },
    starItem(th),
    ...(th.labelIds.includes('INBOX')
      ? [
          {
            id: 'archive',
            label: t.mail.page.rowArchive,
            onSelect: () => void rowAction(account, th, 'archive', box.reload),
          },
        ]
      : []),
  ];

  const openRow = (id: string) => {
    // In select mode a tap on a row ticks it (a mis-tap never leaves the list).
    if (selecting) return selection.toggle(id, false);
    setStartInvoice(undefined);
    update({ thread: id });
  };
  const onInvoice = (th: CachedThreadView, offer: InvoiceOffer) => {
    if (offer.kind === 'create') void createInvoice(account, th, offer, box.reload);
    else if (offer.kind === 'note') void noteReminder(account, th, offer, box.reload);
    else if (offer.kind === 'check') {
      setStartInvoice(th.id);
      update({ thread: th.id });
    }
  };
  const demo = account.key === DEMO_ACCOUNT;
  /** The two parts of a search; each says in words when it has nothing (never a bare empty list). */
  const searchSections = (): ListSection[] => {
    const here = shown.filter((th) => localIds.has(th.id));
    const there = shown.filter((th) => !localIds.has(th.id));
    const device: ListSection = {
      id: 'device',
      label: t.mail.find.onDevice,
      detail:
        local && local.unsupported.length === 0
          ? t.mail.find.onDeviceDetail(local.searched)
          : undefined,
      threads: here,
      total: local ? Math.max(here.length, local.hits.length) : undefined,
      more:
        local && local.hits.length > here.length
          ? {
              count: Math.min(DEVICE_PAGE, local.hits.length - here.length),
              onShow: () => setDeviceLimit({ q: limitKey, n: deviceLimit.n + DEVICE_PAGE }),
            }
          : undefined,
      note: !local
        ? t.mail.find.onDeviceSearching
        : local.unsupported.length > 0
          ? demo
            ? t.mail.find.onDeviceOnlyDemo(local.unsupported[0]!)
            : t.mail.find.onDeviceOnly(local.unsupported[0]!)
          : here.length === 0
            ? demo
              ? t.mail.find.onDeviceNoneDemo
              : t.mail.find.onDeviceNone
            : undefined,
    };
    if (demo) return [device];
    const mailbox: ListSection = {
      id: 'mailbox',
      label: t.mail.find.inMailbox,
      threads: there,
      note:
        box.error === 'network'
          ? t.mail.find.inMailboxOffline
          : box.loading && there.length === 0
            ? t.mail.find.inMailboxLoading
            : there.length === 0 && box.error
              ? t.mail.find.inMailboxError
              : there.length === 0
                ? t.mail.find.inMailboxNone
                : undefined,
    };
    return [device, mailbox];
  };

  const listPane = (
    <>
      {demo ? <p className={styles.notice}>{t.mail.page.demo}</p> : null}
      <form
        className={styles.toolbar}
        ref={searchForm}
        onSubmit={(e) => {
          e.preventDefault();
          setRecent(rememberSearch(draft));
          if (draft.trim()) setQueueOpen(false);
          update({ q: draft.trim(), thread: null });
        }}
        role="search"
      >
        {accounts.length > 1 ? (
          <div className={styles.picker}>
            <SelectField
              label={t.mail.page.account}
              value={account.key}
              onChange={(e) => update({ account: e.target.value, thread: null })}
            >
              {accounts.map((a, i) => (
                <option key={a.key} value={a.key}>
                  {a.email ?? t.mail.page.accountN(i + 1)}
                </option>
              ))}
            </SelectField>
          </div>
        ) : null}
        {wide ? null : (
          <div className={styles.picker}>
            <SelectField
              label={t.mail.page.label}
              value={inQueue ? 'view:waiting' : savedQuery ? `q:${savedQuery}` : labelId}
              disabled={query !== '' && !savedQuery}
              onChange={(e) => {
                const v = e.target.value;
                setQueueOpen(v === 'view:waiting');
                if (v === 'view:waiting') update({ q: null, thread: null });
                else if (v.startsWith('q:')) update({ q: v.slice(2), thread: null });
                else update({ label: v, q: null });
              }}
            >
              {waitingRule !== 'off' ? (
                <option value="view:waiting">
                  {t.mail.queue.title}
                  {waiting.length ? ` (${waiting.length})` : ''}
                </option>
              ) : null}
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {labelName(l)}
                  {l.unread ? ` (${l.unread})` : ''}
                </option>
              ))}
              {saved.length > 0 ? (
                <optgroup label={t.mail.find.saved}>
                  {saved.map((q) => (
                    <option key={q} value={`q:${q}`}>
                      {q}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </SelectField>
          </div>
        )}
        <div className={styles.search}>
          <TextField
            label={t.mail.page.searchLabel}
            labelHidden
            hint={t.mail.page.searchHint}
            placeholder={t.mail.page.searchPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            list="mail-suggest"
            autoComplete="off"
          />
          <datalist id="mail-suggest">
            {suggestions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>
        {/* The head's "Neue Mail" is the page's one filled button. */}
        <Button type="submit">{t.mail.page.searchLabel}</Button>
        {query ? (
          <Button onClick={() => update({ q: null })}>{t.mail.page.searchEnd}</Button>
        ) : null}
        {query && !isSaved(saved, query) ? (
          <Button
            variant="ghost"
            onClick={() => {
              if (saved.length >= 10) return useUiStore.getState().toast(t.mail.find.savedFull);
              setSaved(saveSearch(query));
              useUiStore.getState().toast(t.mail.find.savedDone);
            }}
          >
            {t.mail.find.save}
          </Button>
        ) : query ? (
          <Button
            variant="ghost"
            onClick={() => {
              setSaved(forgetSearch(query));
              useUiStore.getState().toast(t.mail.find.forgotten);
            }}
          >
            {t.mail.find.forgetThis}
          </Button>
        ) : null}
        <IconButton label={t.mail.page.refresh} onClick={box.reload} disabled={box.loading}>
          <Icon name="sync" />
        </IconButton>
      </form>
      {/* Quick filters write Gmail operators into the search; shown once a search is typed or running. */}
      {draft.trim() || query ? (
        <div className={styles.row} role="group" aria-label={t.mail.find.filters}>
          <Chips>
            {FILTERS.map((f) => (
              <Chip
                key={f}
                label={t.mail.find.filter[f] ?? f}
                selected={hasFilter(draft, f)}
                onClick={() => {
                  const next = toggleFilter(draft, f);
                  setRecent(rememberSearch(next));
                  setDraft(next);
                  update({ q: next || null, thread: null });
                }}
              />
            ))}
          </Chips>
        </div>
      ) : null}

      {inQueue ? (
        <div className={styles.queueHead}>
          <p className={styles.hint}>
            {waitingRule === 'starred' ? t.mail.queue.ruleStarred : t.mail.queue.ruleReply}{' '}
            <Link to={settingsPath('module', 'module-mail', 'waitingRule')}>
              {t.mail.queue.change}
            </Link>
          </p>
          {waiting.length > 0 ? (
            <Button
              variant="ghost"
              onClick={() => {
                setWalking(true);
                update({ thread: waiting[0]!.id });
              }}
              data-testid="mail-queue-walk"
            >
              {t.mail.queue.walk}
            </Button>
          ) : null}
        </div>
      ) : null}

      {(offerPersonal || (offerPlanAll && onPlan) || canModify) && box.threads.length > 0 ? (
        <div className={styles.row} ref={selectRow}>
          {offerPersonal && !searching && !inQueue ? (
            // One quiet choice instead of a row of chips (stimulus budget): all, from people, invoices, newsletters.
            <div className={styles.picker}>
              <SelectField
                label={t.mail.kind.show}
                labelHidden
                value={kind ?? (personalOnly ? 'personal' : 'all')}
                onChange={(e) => {
                  const v = e.target.value;
                  update({
                    personal: v === 'personal' ? '1' : null,
                    kind: kindFilterOf(v) ?? null,
                    thread: null,
                  });
                }}
              >
                <option value="all">{t.mail.kind.all}</option>
                <option value="personal">{t.mail.plan.personal}</option>
                {KIND_FILTERS.map((k) => (
                  <option key={k} value={k}>
                    {t.mail.kind[k]}
                  </option>
                ))}
              </SelectField>
            </div>
          ) : null}
          {offerPlanAll && onPlan && shown.length > 0 ? (
            <Button
              variant="ghost"
              onClick={() =>
                void deletedThreads(shown.map((th) => th.id)).then((d) => {
                  setDeleted(d);
                  setPlanAll(true);
                })
              }
              data-testid="mail-plan-all-open"
            >
              {states?.planner ? t.mail.plan.all : t.mail.plan.todo.all}
            </Button>
          ) : null}
          {canModify && shown.length > 0 ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  if (selecting) selection.clear();
                  setSelecting(!selecting);
                }}
                data-testid="mail-select"
              >
                {selecting ? t.mail.batch.selectEnd : t.mail.batch.select}
              </Button>
              {selecting && selected.length < shown.length ? (
                <Button variant="ghost" onClick={selection.selectAll}>
                  {t.mail.batch.selectAll}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      {selecting && selected.length > 0 ? (
        <BatchBar
          account={account}
          targets={selected}
          labelId={query ? '' : labelId}
          confirmMoves={confirmMoves}
          onCancel={() => {
            selection.clear();
            setSelecting(false);
          }}
          onSettled={(failed) => {
            selection.clear();
            for (const id of failed) selection.toggle(id, false);
            // The bar goes away with the selection: focus stays on the page instead of falling to the body.
            if (failed.length === 0)
              selectRow.current?.querySelector<HTMLElement>('[data-testid="mail-select"]')?.focus();
          }}
          onDone={(direction, ids, action) => {
            if (direction === 'do') {
              if (threadId && ids.includes(threadId) && STEPS[action].leaves)
                update({ thread: null });
            }
            // The open thread was part of it: it reloads, so its buttons show the new state.
            if (threadId && ids.includes(threadId)) setViewTick((n) => n + 1);
            box.reload();
          }}
        />
      ) : null}
      {planAll ? (
        <PlanAllDialog
          threads={shown}
          titleOf={(th) => planTitle(account, th)}
          planned={planned}
          deleted={deleted}
          plannerOn={!!states?.planner}
          onClose={() => setPlanAll(false)}
          onPlan={(picked) => {
            setPlanAll(false);
            void planMany(account, picked, box.reload, deleted);
          }}
        />
      ) : null}

      {/* While searching, an unreachable mailbox is a quiet line in its part: the hits on this device still stand. */}
      {box.error && !(searching && box.error === 'network') ? <MailError code={box.error} /> : null}
      {box.fromCache ? <p className={styles.hint}>{t.mail.page.cached}</p> : null}

      {searching ? (
        <ThreadList
          threads={shown}
          sections={searchSections()}
          terms={local?.terms}
          hitLines={hitLines}
          onOpen={openRow}
          menuFor={selecting ? undefined : menuFor}
          planned={planned}
          planLabel={planLabel}
          plannerOn={!!states?.planner}
          onPlan={selecting ? undefined : onPlan}
          titleOf={(th) => planTitle(account, th)}
          invoices={invoices}
          selection={selecting ? selection : undefined}
          answered={selecting ? NO_ANSWERED : answered}
          onAnswered={(todoId) => void closeAnswered(todoId)}
          onInvoice={onInvoice}
        />
      ) : shown.length === 0 && box.loading ? (
        <Skeleton height="10rem" />
      ) : shown.length === 0 && !box.error ? (
        <EmptyState
          title={
            inQueue
              ? waitingRule === 'off'
                ? t.mail.queue.off
                : t.mail.queue.empty
              : query
                ? t.mail.page.emptySearch
                : filteredOut
                  ? kind === 'invoice'
                    ? t.mail.kind.emptyInvoice
                    : kind === 'newsletter'
                      ? t.mail.kind.emptyNewsletter
                      : t.mail.plan.emptyPersonal
                  : t.mail.page.empty
          }
          testId="mail-empty"
          motif={<SignatureMark id="stamp" size={64} />}
        >
          {filteredOut ? (
            <Button onClick={() => update({ personal: null, kind: null })}>
              {kind ? t.mail.kind.clear : t.mail.plan.clearPersonal}
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <ThreadList
          threads={shown}
          onOpen={openRow}
          // While picking, rows carry only their checkbox (no menu, no plan or invoice buttons).
          menuFor={selecting ? undefined : menuFor}
          planned={planned}
          planLabel={planLabel}
          plannerOn={!!states?.planner}
          onPlan={selecting ? undefined : onPlan}
          titleOf={(th) => planTitle(account, th)}
          invoices={invoices}
          selection={selecting ? selection : undefined}
          answered={selecting ? NO_ANSWERED : answered}
          onAnswered={(todoId) => void closeAnswered(todoId)}
          onInvoice={onInvoice}
        />
      )}
      {box.hasMore ? (
        <div className={styles.row}>
          <Button onClick={box.loadMore} disabled={box.loading}>
            {t.mail.page.more}
          </Button>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      {header}
      {writeUi}
      {wide ? (
        <div className={styles.cols} data-testid="mail-columns">
          <nav className={styles.labelCol} aria-label={t.mail.page.labelsNav}>
            {waitingRule !== 'off' ? (
              <button
                type="button"
                className={styles.labelBtn}
                aria-current={inQueue ? 'true' : undefined}
                onClick={() => {
                  setQueueOpen(true);
                  update({ q: null, thread: null });
                }}
                data-testid="mail-queue"
              >
                <span>{t.mail.queue.title}</span>
                {/* A calm count, like a folder's: no colour, no badge that grows louder. */}
                {waiting.length ? (
                  <span className={styles.labelCount}>{waiting.length}</span>
                ) : null}
              </button>
            ) : null}
            {labels.map((l) => (
              <button
                key={l.id}
                type="button"
                className={styles.labelBtn}
                aria-current={l.id === labelId && !query && !inQueue ? 'true' : undefined}
                onClick={() => {
                  setQueueOpen(false);
                  update({ label: l.id, q: null, thread: null });
                }}
              >
                <span>{labelName(l)}</span>
                {l.unread ? <span className={styles.labelCount}>{l.unread}</span> : null}
              </button>
            ))}
            {saved.length > 0 ? (
              <>
                <p className={styles.savedHead}>{t.mail.find.saved}</p>
                {saved.map((q) => (
                  <div key={q} className={styles.savedRow}>
                    <button
                      type="button"
                      className={styles.labelBtn}
                      aria-current={q === savedQuery ? 'true' : undefined}
                      onClick={() => update({ q, thread: null })}
                    >
                      <span className={styles.savedText}>{q}</span>
                    </button>
                    <IconButton
                      label={t.mail.find.forget(q)}
                      onClick={() => setSaved(forgetSearch(q))}
                    >
                      <Icon name="close" size={16} />
                    </IconButton>
                  </div>
                ))}
              </>
            ) : null}
          </nav>
          <div className={styles.listCol}>{listPane}</div>
          <section className={styles.reading} aria-label={t.mail.view.back}>
            {stepBar}
            {threadView ?? <p className={styles.hint}>{t.mail.page.pickThread}</p>}
          </section>
        </div>
      ) : (
        listPane
      )}
      <MailSettingsPanel open={panel} onClose={() => setPanel(false)} />
    </>
  );
}
