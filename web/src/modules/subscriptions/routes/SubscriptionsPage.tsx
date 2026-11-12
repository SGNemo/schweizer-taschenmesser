import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
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
  Switch,
  useAdvancedMenuItem,
  useOpenParam,
} from '@/ui';
import { SubscriptionEditor, type SubscriptionTarget } from '../components/SubscriptionEditor';
import {
  changePercent,
  monthlyEquivalent,
  subscriptionStatus,
  topExpensive,
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
import { ServiceTile } from '../components/ServiceTile';
import { HeroFigure, HeroSlot, SignatureMark } from '@/ui/identity';
import { useAdvanced } from '@/core/settings/comfort';
import { tDeadline } from '@/strings.deadline';
import styles from './subscriptions.module.css';
import { StartDataMenu } from '@/core/importer/StartDataMenu';

export default function SubscriptionsPage() {
  const day = today();
  const subs = useLiveQuery(
    async () => sortSubscriptions(await subscriptionRepo.active().toArray(), today()),
    [],
  );
  const [target, setTarget] = useState<SubscriptionTarget>(null);
  const [params, setParams] = useSearchParams();
  // A price from finance's hint (`?open=<id>&newprice=<cents>`) is offered for that subscription only.
  const [suggestion, setSuggestion] = useState<{ id: string; amountMinor: number } | undefined>();
  useOpenParam(
    (id) => subscriptionRepo.get(id),
    (record) => {
      setTarget(record);
      const amountMinor = Number(params.get('newprice'));
      setSuggestion(amountMinor > 0 ? { id: record.id, amountMinor } : undefined);
    },
  );

  // `?new=1` (Quick-Add) opens the create dialog; derived from the URL.
  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const sums = totalsByCurrency(subs ?? [], day);
  const [advanced] = useAdvanced('subscriptions');
  const top = advanced ? topExpensive(subs ?? [], day, 3) : [];

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
      <PageHeader title={t.subscriptions.title} besideContent>
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

      {/* One quiet line: the year (and the monthly sums of further currencies). The month stands in the head. */}
      {hasSubs ? (
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
      ) : null}

      {top.length > 0 ? (
        <section aria-label={t.subscriptions.ext.top.title} data-testid="top-expensive">
          <h2 className={styles.topTitle}>{t.subscriptions.ext.top.title}</h2>
          <ul className={styles.topList}>
            {top.map((s) => (
              <li key={s.id}>
                <ServiceTile name={s.name} />
                <span>
                  {s.name} ·{' '}
                  {t.subscriptions.ext.top.perYear(
                    formatMoney(Math.round(annualCost(s)), currencyOf(s)),
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
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
      {empty || !subs?.length ? null : (
        <ItemList label={t.subscriptions.title}>
          {subs.map((s) => {
            const charge = s.active ? nextCharge(s, day) : undefined;
            const cancel = s.active ? nextCancelDeadline(s, day) : undefined;
            const missed = s.active ? missedDeadline(s, day) : undefined;
            const soon = cancel ? cancelTone(cancel.deadline, day) : undefined;
            const increase = recentIncrease(s.priceHistory ?? [], day);
            const status = subscriptionStatus(s, day);
            const plainMonthly =
              s.recurrence.freq === 'monthly' && (s.recurrence.interval ?? 1) === 1;
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
              plainMonthly
                ? ''
                : t.subscriptions.ext.monthlyShort(
                    formatMoney(monthlyEquivalent(s), currencyOf(s)),
                  ),
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
                  <>
                    {/* Status badges sit in the meta line: the amount column stays put (U56). */}
                    {!s.active ? <Badge>{t.subscriptions.paused}</Badge> : null}
                    {status === 'trial' ? (
                      <Badge tone="info">{t.subscriptions.ext.trial.chip}</Badge>
                    ) : null}
                    {status === 'ended' ? <Badge>{t.subscriptions.ext.status.ended}</Badge> : null}
                    {!s.active || status === 'trial' || status === 'ended' ? ' ' : null}
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
                }
                onOpen={() => setTarget(s)}
                onSwipeLeft={remove}
                swipeLeftLabel={t.actions.delete}
                menu={[
                  {
                    id: 'active',
                    label: s.active ? t.subscriptions.pause : t.subscriptions.resume,
                    onSelect: () => toggle(!s.active),
                  },
                  { id: 'delete', label: t.actions.delete, danger: true, onSelect: remove },
                ]}
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
    </>
  );
}
