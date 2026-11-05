import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { currencyOf, formatMoney, formatTotals } from '@/core/money';
import { describeRecurrence } from '@/core/recurrence/describe';
import { daysBetween, formatDay, today } from '@/core/time/dates';
import { changeWithUndo, deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  AdvancedToggle,
  Badge,
  Button,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  PageHeader,
  Switch,
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
} from '../logic';
import { subscriptionRepo } from '../repo';
import { NextChargesHead } from '../components/NextChargesHead';
import { ServiceTile } from '../components/ServiceTile';
import { HeroSlot, Ring } from '@/ui/identity';
import { useAdvanced } from '@/core/settings/comfort';
import { tDeadline } from '@/strings.deadline';
import styles from './subscriptions.module.css';
import { StartDataButton } from '@/core/importer/StartDataButton';

/** Highlight a cancellation deadline that is closer than this many days. */
const WARN_DAYS = 14;

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

  // Month cycle: the share of each active subscription (first currency) in the monthly sum, the biggest four.
  const activeSubs = (subs ?? []).filter((s) => s.active);
  const firstCurrency = activeSubs[0] ? currencyOf(activeSubs[0]) : undefined;
  const monthly = activeSubs
    .filter((s) => currencyOf(s) === firstCurrency)
    .map((s) => ({ id: s.id, label: s.name, share: monthlyEquivalent(s) }))
    .sort((a, b) => b.share - a.share);
  const cycle = monthly.slice(0, 4);

  return (
    <>
      <PageHeader title={t.subscriptions.title}>
        <AdvancedToggle moduleId="subscriptions" />
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.subscriptions.add}
        </Button>
      </PageHeader>

      {cycle.length > 0 ? (
        <HeroSlot area="signature">
          <div className={styles.cycle} data-testid="cycle-ring">
            <Ring
              parts={cycle}
              centre={<strong>{monthly.length}</strong>}
              label={`${t.subscriptions.perMonth}: ${cycle.map((p) => p.label).join(', ')}`}
              size={7.5}
            />
            <ul className={styles.cycleLegend}>
              {cycle.map((p) => (
                <li key={p.id}>{p.label}</li>
              ))}
            </ul>
          </div>
        </HeroSlot>
      ) : null}

      {subs ? <NextChargesHead subs={subs} /> : null}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t.subscriptions.perMonth}</span>
          <span className={styles.statValue} data-testid="total-month">
            {formatTotals(pickTotals(sums, 'monthly'))}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t.subscriptions.perYear}</span>
          <span className={styles.statValue} data-testid="total-year">
            {formatTotals(pickTotals(sums, 'yearly'))}
          </span>
        </div>
      </div>

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
      {subs && subs.length === 0 ? (
        <EmptyState title={t.subscriptions.empty}>
          <StartDataButton moduleId="subscriptions" />
        </EmptyState>
      ) : null}
      <ItemList label={t.subscriptions.title}>
        {subs?.map((s) => {
          const charge = s.active ? nextCharge(s, day) : undefined;
          const cancel = s.active ? nextCancelDeadline(s, day) : undefined;
          const missed = s.active ? missedDeadline(s, day) : undefined;
          const urgent = cancel ? daysBetween(day, cancel.deadline) <= WARN_DAYS : false;
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
              : t.subscriptions.ext.monthlyShort(formatMoney(monthlyEquivalent(s), currencyOf(s))),
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
                  {facts.join(' · ')}
                  {missed ? (
                    <span className={styles.missed} title={tDeadline.get().missedNote}>
                      {' · '}
                      {tDeadline.get().missedOn(formatDay(missed.deadline, 'd. MMM yyyy'))}
                    </span>
                  ) : null}
                  {cancel ? (
                    <span className={`${styles.cancelLine} ${urgent ? styles.warn : ''}`}>
                      {' · '}
                      {t.subscriptions.cancelBy}: {formatDay(cancel.deadline, 'd. MMM yyyy')}
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
                  <span className={styles.amount}>{formatMoney(s.amountMinor, currencyOf(s))}</span>
                  <Switch
                    label={`${s.name}: ${t.subscriptions.active}`}
                    labelHidden
                    checked={s.active}
                    onChange={toggle}
                  />
                  {!s.active ? <Badge>{t.subscriptions.paused}</Badge> : null}
                  {status === 'trial' ? (
                    <Badge tone="info">{t.subscriptions.ext.trial.chip}</Badge>
                  ) : null}
                  {status === 'ended' ? <Badge>{t.subscriptions.ext.status.ended}</Badge> : null}
                </>
              }
            />
          );
        })}
      </ItemList>

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
