import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listMailAccounts } from '@/core/mail/accounts';
import { mailLabels } from '@/core/mail/service';
import type { MailAccountRef, MailLabel } from '@/core/mail/types';
import { useSettings } from '@/core/settings/settings';
import { settingsPath } from '@/core/settings/registry/paths';
import { useUiStore } from '@/stores/ui';
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
import { readSearches, rememberSearch, suggestionsFor } from '../searchHistory';
import { useMailbox } from '../useMailbox';
import { useMailSummary } from '../useSummary';

const GROUPS: DayGroup[] = ['today', 'yesterday', 'week', 'older'];
const DEFAULT_LABELS: MailLabel[] = ['INBOX', 'STARRED', 'IMPORTANT', 'SENT'].map((id) => ({
  id,
  name: id,
  kind: 'system',
}));

const labelName = (l: MailLabel) => t.mail.page.labels[l.id] ?? l.name;

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
}: {
  threads: CachedThreadView[];
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
  const groups: GroupedListGroup[] = GROUPS.map((g) => {
    const rows = threads.filter((th) => dayGroup(th.date) === g);
    return {
      id: g,
      label: t.mail.page.groups[g],
      count: rows.length,
      children: (
        <ItemList>
          {rows.map((th) => (
            <ItemRow
              key={th.id}
              // Sender and time share the title line, subject and snippet are two lines at most: a row keeps
              // its height beside the reading pane (design check G1, G4).
              title={
                <span className={styles.rowTitle}>
                  <span className={th.unread ? styles.unreadRow : styles.rowFrom}>
                    {personName(th.from)}
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
                    {planned.has(th.id) ? (
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
                    {subjectOf(th.subject)}
                  </span>
                  {th.snippet ? <span className={styles.snippet}> – {th.snippet}</span> : null}
                </span>
              }
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
      ),
    };
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

export default function MailPage() {
  const [params, setParams] = useSearchParams();
  const [prefs] = useSettings('module.mail', settings.schema, settings.defaults);
  const live = useLiveQuery(() => listMailAccounts(), []);
  const demoCount = useLiveQuery(
    () =>
      threadRepo
        .active()
        .filter((r) => r.accountKey === DEMO_ACCOUNT)
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
  // Three columns follow the room the page really has (sidebar, rail and window all count); outside a page container the window decides.
  const pageWide = usePageWidthAtLeast(MAIL_COLUMNS_REM);
  const windowWide = useMediaQuery('(min-width: 1200px)');
  const wide = pageWide ?? windowWide;
  const summary = useMailSummary();
  const [recent, setRecent] = useState<string[]>(readSearches);
  const senders = useMemo(
    () => [...new Set(box.threads.map((th) => personName(th.from)))],
    [box.threads],
  );
  const suggestions = suggestionsFor(draft, recent, senders);
  const images = (prefs as { images?: string } | undefined)?.images === 'always';
  const cacheBodies = (prefs as { cacheBodies?: boolean } | undefined)?.cacheBodies ?? true;
  const confirmMoves = (prefs as { confirmMoves?: boolean } | undefined)?.confirmMoves ?? true;
  const localAi = (prefs as { localAi?: boolean } | undefined)?.localAi ?? false;
  const offerPersonal = (prefs as { offerPersonal?: boolean } | undefined)?.offerPersonal ?? true;
  const offerPlanAll = (prefs as { offerPlanAll?: boolean } | undefined)?.offerPlanAll ?? true;
  const shown =
    // Headers cached before the flag existed (`personal` unknown) stay in until the next fetch.
    personalOnly && offerPersonal ? box.threads.filter((th) => th.personal !== false) : box.threads;
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
  const viewKey = `${account?.key}|${labelId}|${query}|${personalOnly}`;
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
  const filteredOut = personalOnly && offerPersonal && box.threads.length > 0;

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
      onChanged={box.reload}
      onCompose={(state, title) => setCompose({ state, title, account })}
      onBack={() => {
        setStartInvoice(undefined);
        update({ thread: null });
      }}
      startInvoice={startInvoice === threadId}
    />
  ) : null;

  // Phone and narrow windows: the mail replaces the list. From 58 rem of page both stay (see below).
  if (threadId && !wide)
    return (
      <>
        {header}
        {writeUi}
        {threadView}
        <MailSettingsPanel open={panel} onClose={() => setPanel(false)} />
      </>
    );

  const canModify = hasFeature(account, 'mail-modify');
  const onPlan = canPlan
    ? (th: CachedThreadView) => void planMail(account, th, box.reload)
    : undefined;
  const menuFor =
    onPlan || canModify
      ? (th: (typeof box.threads)[number]): RowMenuItem[] => [
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

  const listPane = (
    <>
      {account.key === DEMO_ACCOUNT ? <p className={styles.notice}>{t.mail.page.demo}</p> : null}
      <form
        className={styles.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          setRecent(rememberSearch(draft));
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
              value={labelId}
              disabled={query !== ''}
              onChange={(e) => update({ label: e.target.value })}
            >
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {labelName(l)}
                  {l.unread ? ` (${l.unread})` : ''}
                </option>
              ))}
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
        <IconButton label={t.mail.page.refresh} onClick={box.reload} disabled={box.loading}>
          <Icon name="sync" />
        </IconButton>
      </form>

      {(offerPersonal || (offerPlanAll && onPlan) || canModify) && box.threads.length > 0 ? (
        <div className={styles.row} ref={selectRow}>
          {offerPersonal ? (
            <Chips>
              <Chip
                label={t.mail.plan.personal}
                selected={personalOnly}
                onClick={() => update({ personal: personalOnly ? null : '1', thread: null })}
              />
            </Chips>
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

      {box.error ? <MailError code={box.error} /> : null}
      {box.fromCache ? <p className={styles.hint}>{t.mail.page.cached}</p> : null}

      {shown.length === 0 && box.loading ? (
        <Skeleton height="10rem" />
      ) : shown.length === 0 && !box.error ? (
        <EmptyState
          title={
            query
              ? t.mail.page.emptySearch
              : filteredOut
                ? t.mail.plan.emptyPersonal
                : t.mail.page.empty
          }
          testId="mail-empty"
          motif={<SignatureMark id="stamp" size={64} />}
        >
          {filteredOut ? (
            <Button onClick={() => update({ personal: null })}>{t.mail.plan.clearPersonal}</Button>
          ) : null}
        </EmptyState>
      ) : (
        <ThreadList
          threads={shown}
          onOpen={(id) => {
            // In select mode a tap on a row ticks it (a mis-tap never leaves the list).
            if (selecting) return selection.toggle(id, false);
            setStartInvoice(undefined);
            update({ thread: id });
          }}
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
          onInvoice={(th, offer) => {
            if (offer.kind === 'create') void createInvoice(account, th, offer, box.reload);
            else if (offer.kind === 'note') void noteReminder(account, th, offer, box.reload);
            else if (offer.kind === 'check') {
              setStartInvoice(th.id);
              update({ thread: th.id });
            }
          }}
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
            {labels.map((l) => (
              <button
                key={l.id}
                type="button"
                className={styles.labelBtn}
                aria-current={l.id === labelId && !query ? 'true' : undefined}
                onClick={() => update({ label: l.id, q: null, thread: null })}
              >
                <span>{labelName(l)}</span>
                {l.unread ? <span className={styles.labelCount}>{l.unread}</span> : null}
              </button>
            ))}
          </nav>
          <div className={styles.listCol}>{listPane}</div>
          <section className={styles.reading} aria-label={t.mail.view.back}>
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
