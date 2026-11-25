import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { currencyOf, formatMoney, formatTotals } from '@/core/money';
import { describeRecurrence } from '@/core/recurrence/describe';
import { relativeDays } from '@/core/i18n/format';
import { formatDay, today } from '@/core/time/dates';
import { changeWithUndo, deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  PageAction,
  PageHeader,
  Segmented,
  Switch,
  Tabs,
  useAdvancedMenuItem,
  useOpenParam,
} from '@/ui';
import {
  plannedKey,
  plannedNow,
  SubscriptionEditor,
  type SubscriptionTarget,
} from '../components/SubscriptionEditor';
import { usePlanMarks } from '@/core/entitylinks/PlanMark';
import {
  changePercent,
  monthlyEquivalent,
  subscriptionStatus,
  annualCost,
  nextCancelDeadline,
  missedDeadline,
  nextCharge,
  recentIncrease,
  sortSubscriptions,
  pickTotals,
  totalsByCurrency,
  cancelTone,
} from '../logic';
import { subscriptionRepo } from '../repo';
import type { Subscription } from '../schema';
import type { Stored } from '@/core/db/types';
import { nextDeadline, type Deadline } from '../cancelStep';
import { CancelStep } from '../components/CancelStep';
import { ServiceTile } from '../components/ServiceTile';
import { OverviewView } from '../components/OverviewView';
import { planDeadline } from '../planDeadline';
import { useModuleStates } from '@/core/modules/activation';
import { isSortKey, sortList, SORT_KEYS, type SortKey } from '../overview';
import { HeroFigure, HeroSlot, SignatureMark } from '@/ui/identity';
import { useAdvanced } from '@/core/settings/comfort';
import { tDeadline } from '@/strings.deadline';
import styles from './subscriptions.module.css';
import { StartDataMenu } from '@/core/importer/StartDataMenu';
import { usePageWidthAtLeast } from '@/ui/pageWidth';

export default function SubscriptionsPage() {
  const day = today();
  // Phone (design check G4): one short meta line per row; the rest is in the entry's dialog.
  const narrow = usePageWidthAtLeast(48) === false;
  const subs = useLiveQuery(
    async () => sortSubscriptions(await subscriptionRepo.active().toArray(), today()),
    [],
  );
  const [target, setTarget] = useState<SubscriptionTarget>(null);
  const [params, setParams] = useSearchParams();
  // A price from finance's hint (`?open=<id>&newprice=<cents>`) is offered for that subscription only.
  const [suggestion, setSuggestion] = useState<{ id: string; amountMinor: number } | undefined>();
  // `?do=cancel` (the plan row's „Kündigen …“): the module's own cancel step for the next deadline, not the editor.
  // Opening it writes nothing; only its „Vermerken“ / „Läuft weiter“ do (package 4b).
  const [cancelling, setCancelling] = useState<
    { sub: Stored<Subscription>; deadline: Deadline } | undefined
  >();
  const wantsCancel = params.get('do') === 'cancel';
  useOpenParam(
    (id) => subscriptionRepo.get(id),
    (record) => {
      // Only a running subscription has a deadline to decide; a paused or ended one opens its entry.
      const deadline =
        wantsCancel && record.active && !record.recurrence.until
          ? nextDeadline(record, today())
          : undefined;
      if (deadline) {
        setCancelling({ sub: record, deadline });
        return;
      }
      setTarget(record);
      const amountMinor = Number(params.get('newprice'));
      setSuggestion(amountMinor > 0 ? { id: record.id, amountMinor } : undefined);
    },
  );
  // `?do=cancel` (the plan row's „Kündigen …“, CONCEPT-LINKS §2 L7) is untrusted input: the id is checked by
  // `useOpenParam`, `do=cancel` only OPENS the cancel step of a subscription with a deadline ahead (else the entry),
  // nothing is written until its own tap, and once `open` is read `do` (any value) leaves the URL.
  const strayDo = params.has('do') && !params.get('open');
  useEffect(() => {
    if (!strayDo) return;
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete('do');
        if (!next.get('open')) next.delete('open');
        return next;
      },
      { replace: true },
    );
  }, [strayDo, setParams]);

  // `?new=1` (Quick-Add) opens the create dialog; derived from the URL.
  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const setParam = (key: string, value: string | undefined) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const closeEditor = () => {
    setTarget(null);
    // Only the dialog's own parameter leaves the URL: the view and the order stay.
    if (params.get('new')) setParam('new', undefined);
  };

  const sums = totalsByCurrency(subs ?? [], day);
  const [advanced] = useAdvanced('subscriptions');
  const compact = narrow && !advanced;
  // View and order live in the URL: a reload or the way back keeps them (focus checklist 5).
  const view = params.get('view') === 'overview' ? 'overview' : 'list';
  // `?view=notice` (the jump from the planner's pile): the list, sorted by the next deadline as it is by default; the
  // word leaves the URL once read. Any other value but `overview` is ignored the same way.
  const strayView = params.has('view') && view !== 'overview';
  useEffect(() => {
    if (strayView) setParam('view', undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strayView]);
  const rawSort = params.get('sort');
  const sort: SortKey = isSortKey(rawSort) ? rawSort : 'next';
  const rows = sortList(subs ?? [], day, sort);
  // The plan marks for the overview's deadline card (hand-off 10), read at once; `plannedDeadline` is the fallback (M3).
  // (`usePlanMarks` keys its query by the ids and fallbacks, so a new array per render starts nothing new.)
  const marks = usePlanMarks(
    'subscriptions',
    (subs ?? []).map((s) => {
      const key = plannedKey(s);
      return { id: s.id, fallback: plannedNow(s, day), ...(key ? { fallbackKey: key } : {}) };
    }),
  );
  const plannerOn = useModuleStates()?.planner === true;

  const advancedItem = useAdvancedMenuItem('subscriptions');
  // The head's one figure: the monthly sum of the main currency. Its context line leads with what needs a decision
  // (cancellation deadlines that end soon) and then counts the active subscriptions.
  const active = (subs ?? []).filter((s) => s.active);
  const monthly = [...pickTotals(sums, 'monthly')];
  const [main, ...otherMonthly] = monthly;
  const soonCount = active.filter((s) => {
    const cancel = nextCancelDeadline(s, day);
    return cancel ? cancelTone(cancel.deadline, day)?.tone === 'soon' : false;
  }).length;
  const empty = !!subs && subs.length === 0;
  const hasSubs = !!subs && subs.length > 0;

  return (
    <>
      <PageHeader
        title={t.subscriptions.title}
        besideContent
        views={
          hasSubs ? (
            <Tabs
              label={t.subscriptions.ext.overview.tabsLabel}
              value={view}
              options={[
                { value: 'list', label: t.subscriptions.ext.overview.listTab },
                { value: 'overview', label: t.subscriptions.ext.overview.tab },
              ]}
              onChange={(v) => setParam('view', v === 'overview' ? v : undefined)}
            />
          ) : undefined
        }
      >
        {/* While there is no subscription the empty state holds the one filled step (U26). */}
        <PageAction
          short={t.subscriptions.meta.quickAdd}
          variant={empty ? 'secondary' : 'primary'}
          onClick={() => setTarget({ draft: true })}
        >
          <Icon name="plus" size={18} />
          {t.subscriptions.add}
        </PageAction>
        <StartDataMenu moduleId="subscriptions" items={[advancedItem]} />
      </PageHeader>

      {hasSubs ? (
        <HeroSlot area="figure">
          <HeroFigure
            value={
              main ? formatMoney(main[1], main[0]) : formatMoney(0, subs[0] && currencyOf(subs[0]))
            }
            unit={t.subscriptions.ext.head.unit}
            detail={
              active.length === 0
                ? t.subscriptions.ext.head.paused(subs.length)
                : t.subscriptions.ext.head.context(active.length, soonCount)
            }
            sensitive
            testId="total-month"
          />
        </HeroSlot>
      ) : null}

      {/* One quiet line: the year (and the monthly sums of further currencies); the month stands in the head. In the
          list the order of the rows sits at its end. */}
      {hasSubs ? (
        <div className={styles.listBar}>
          <p className={styles.totals}>
            {t.subscriptions.perYear}{' '}
            <b data-testid="total-year">{formatTotals(pickTotals(sums, 'yearly'))}</b>
            {otherMonthly.length > 0 ? (
              <>
                {' · '}
                {t.subscriptions.ext.head.alsoMonthly}{' '}
                <b data-testid="total-month-other">{formatTotals(new Map(otherMonthly))}</b>
              </>
            ) : null}
          </p>
          {view === 'list' ? (
            <Segmented
              label={t.subscriptions.ext.sort.label}
              value={sort}
              options={SORT_KEYS.map((k) => ({ value: k, label: t.subscriptions.ext.sort[k] }))}
              onChange={(k) => setParam('sort', k === 'next' ? undefined : k)}
            />
          ) : null}
        </div>
      ) : null}
      {hasSubs && view === 'overview' ? (
        <OverviewView
          subs={subs}
          day={day}
          marks={marks}
          onOpen={(s) => setTarget(s)}
          onPlan={plannerOn ? (s, deadline) => void planDeadline(s, deadline) : undefined}
        />
      ) : null}

      {empty ? (
        <EmptyState
          title={t.subscriptions.empty}
          testId="subscriptions-empty"
          motif={<SignatureMark id="cycle" size={64} />}
        >
          <Button variant="primary" onClick={() => setTarget({ draft: true })}>
            {t.subscriptions.emptyAction}
          </Button>
        </EmptyState>
      ) : null}
      {/* No list surface without rows: an empty one drew a bare strip below the empty state (design check G6). */}
      {empty || !subs?.length || view === 'overview' ? null : (
        <ItemList label={t.subscriptions.title}>
          {rows.map((s) => {
            const charge = s.active ? nextCharge(s, day) : undefined;
            const cancel = s.active ? nextCancelDeadline(s, day) : undefined;
            const missed = s.active ? missedDeadline(s, day) : undefined;
            const soon = cancel ? cancelTone(cancel.deadline, day) : undefined;
            const increase = recentIncrease(s.priceHistory ?? [], day);
            const status = subscriptionStatus(s, day);
            // „Kaum genutzt“ counts only while the subscription still costs something.
            const unused = !!s.unusedSince && s.active && !!charge;
            const plainMonthly =
              s.recurrence.freq === 'monthly' && (s.recurrence.interval ?? 1) === 1;
            // Sorted by cost a running row says what it costs in a year: the key of the order is visible.
            const yearly =
              sort === 'cost' && s.active && charge
                ? t.subscriptions.ext.perYearShort(
                    formatMoney(Math.round(annualCost(s)), currencyOf(s)),
                  )
                : '';
            const facts = [
              describeRecurrence(s.recurrence),
              charge
                ? `${t.subscriptions.nextCharge}: ${formatDay(charge, 'd. MMM yyyy')}`
                : s.active
                  ? t.subscriptions.ended
                  : t.subscriptions.paused,
              s.recurrence.until
                ? t.subscriptions.cancelledBadge(formatDay(s.recurrence.until, 'd. MMM yyyy'))
                : '',
              increase ? t.subscriptions.priceUp(changePercent(increase)) : '',
              yearly ||
                (plainMonthly
                  ? ''
                  : t.subscriptions.ext.monthlyShort(
                      formatMoney(monthlyEquivalent(s), currencyOf(s)),
                    )),
              // Category and payment method are power details: they show in Erweitert.
              advanced && s.category ? t.subscriptions.ext.category[s.category] : '',
              advanced ? (s.paymentMethod ?? '') : '',
            ].filter(Boolean);
            const toggle = (active: boolean) =>
              void changeWithUndo(() => subscriptionRepo.update(s.id, { active }));
            const remove = () => void deleteWithUndo(() => subscriptionRepo.remove(s.id));
            return (
              <ItemRow
                key={s.id}
                title={s.name}
                lead={
                  <span className={styles.rowTile}>
                    <ServiceTile name={s.name} />
                  </span>
                }
                className={s.active ? undefined : styles.inactive}
                meta={
                  compact ? (
                    // Phone (G4): the status, the rule only when it is not plain monthly (the amount is per that
                    // rule), the next charge as a date, a cancellation and a price rise, and a cancellation deadline
                    // only while it is near. A passed deadline and the monthly equivalent are in the dialog;
                    // "Erweitert" keeps the full line.
                    <>
                      {!s.active ? <Badge>{t.subscriptions.paused}</Badge> : null}
                      {unused ? <Badge>{t.subscriptions.ext.unused.mark}</Badge> : null}
                      {status === 'trial' ? (
                        <Badge tone="info">{t.subscriptions.ext.trial.chip}</Badge>
                      ) : null}
                      {status === 'ended' ? (
                        <Badge>{t.subscriptions.ext.status.ended}</Badge>
                      ) : null}
                      {(unused || !s.active || status === 'trial' || status === 'ended') &&
                      (charge || !plainMonthly) &&
                      s.active
                        ? ' '
                        : null}
                      {s.active && !plainMonthly ? describeRecurrence(s.recurrence) : null}
                      {s.active && !plainMonthly && charge ? ' · ' : null}
                      {charge ? (
                        <>
                          <span className="sr-only">{t.subscriptions.nextCharge}: </span>
                          {formatDay(charge, 'd. MMM')}
                        </>
                      ) : null}
                      {s.recurrence.until
                        ? ` · ${t.subscriptions.cancelledBadge(formatDay(s.recurrence.until, 'd. MMM'))}`
                        : null}
                      {increase ? ` · ${t.subscriptions.priceUp(changePercent(increase))}` : null}
                      {yearly ? ` · ${yearly}` : null}
                      {cancel && soon?.tone === 'soon' ? (
                        <span
                          className={`${styles.cancelLine} ${styles.warn}`}
                          data-tone={soon.tone}
                        >
                          {' · '}
                          <Icon name="clock" size={14} />
                          {t.subscriptions.cancelBy} {formatDay(cancel.deadline, 'd. MMM')}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {/* Status badges sit in the meta line: the amount column stays put (U56). */}
                      {!s.active ? <Badge>{t.subscriptions.paused}</Badge> : null}
                      {unused ? <Badge>{t.subscriptions.ext.unused.mark}</Badge> : null}
                      {status === 'trial' ? (
                        <Badge tone="info">{t.subscriptions.ext.trial.chip}</Badge>
                      ) : null}
                      {status === 'ended' ? (
                        <Badge>{t.subscriptions.ext.status.ended}</Badge>
                      ) : null}
                      {unused || !s.active || status === 'trial' || status === 'ended' ? ' ' : null}
                      {facts.join(' · ')}
                      {missed ? (
                        <span className={styles.missed} title={tDeadline.get().missedNote}>
                          {' · '}
                          {tDeadline.get().missedOn(formatDay(missed.deadline, 'd. MMM yyyy'))}
                        </span>
                      ) : null}
                      {cancel ? (
                        <span
                          className={`${styles.cancelLine} ${soon?.tone === 'soon' ? styles.warn : ''}`}
                          data-tone={soon?.tone}
                        >
                          {' · '}
                          {soon?.tone === 'soon' ? <Icon name="clock" size={14} /> : null}
                          {t.subscriptions.cancelBy}: {formatDay(cancel.deadline, 'd. MMM yyyy')}
                          {soon?.tone === 'soon' ? ` · ${relativeDays(soon.days)}` : null}
                        </span>
                      ) : null}
                    </>
                  )
                }
                // No plan mark on the row: it broke the page's stimulus budget, so „Im Plan · Mi“ is in the detail
                // and on the overview's deadline card only (package 10b, hand-off 10 „Stimulus“).
                onOpen={() => setTarget(s)}
                onSwipeLeft={remove}
                swipeLeftLabel={t.actions.delete}
                // Phone (G4): no "⋯" per row. With one meta line more rows share the first screen, and a menu button
                // on each would raise the actions there; its entries are shortcuts: "Aktiv" is in the dialog, deleting
                // is the swipe and the dialog's "Löschen".
                menu={
                  compact
                    ? undefined
                    : [
                        {
                          id: 'active',
                          label: s.active ? t.subscriptions.pause : t.subscriptions.resume,
                          onSelect: () => toggle(!s.active),
                        },
                        {
                          id: 'unused',
                          label: s.unusedSince
                            ? t.subscriptions.ext.unused.menuUnmark
                            : t.subscriptions.ext.unused.menuMark,
                          onSelect: () =>
                            void changeWithUndo(() =>
                              subscriptionRepo.update(s.id, {
                                unusedSince: s.unusedSince ? undefined : day,
                              }),
                            ),
                        },
                        { id: 'delete', label: t.actions.delete, danger: true, onSelect: remove },
                      ]
                }
                end={
                  <>
                    <span className={styles.amount}>
                      {formatMoney(s.amountMinor, currencyOf(s))}
                    </span>
                    {/* Desktop only: on the phone "Pausieren" is in the row's menu (one control less per row). */}
                    <span className={styles.rowSwitch}>
                      <Switch
                        label={`${s.name}: ${t.subscriptions.active}`}
                        labelHidden
                        tone="neutral"
                        checked={s.active}
                        onChange={toggle}
                      />
                    </span>
                  </>
                }
              />
            );
          })}
        </ItemList>
      )}

      <SubscriptionEditor
        target={openTarget}
        onClose={closeEditor}
        suggestedAmountMinor={
          openTarget && 'id' in openTarget && suggestion?.id === openTarget.id
            ? suggestion.amountMinor
            : undefined
        }
      />
      {cancelling ? (
        <CancelStep
          key={cancelling.sub.id}
          sub={cancelling.sub}
          deadline={cancelling.deadline}
          layout="dialog"
          onClose={() => setCancelling(undefined)}
        />
      ) : null}
    </>
  );
}
