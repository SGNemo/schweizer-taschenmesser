import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatMoney } from '@/core/money';
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
  Switch,
  useOpenParam,
} from '@/ui';
import { SubscriptionEditor, type SubscriptionTarget } from '../components/SubscriptionEditor';
import {
  changePercent,
  nextCancelDeadline,
  nextCharge,
  recentIncrease,
  sortSubscriptions,
  totals,
} from '../logic';
import { subscriptionRepo } from '../repo';
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
  useOpenParam((id) => subscriptionRepo.get(id), setTarget);
  const [params, setParams] = useSearchParams();

  // `?new=1` (Quick-Add) opens the create dialog; derived from the URL.
  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const sums = totals(subs ?? [], day);

  return (
    <>
      <div className={styles.header}>
        <h1>{t.subscriptions.title}</h1>
        <AdvancedToggle moduleId="subscriptions" />
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.subscriptions.add}
        </Button>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t.subscriptions.perMonth}</span>
          <span className={styles.statValue} data-testid="total-month">
            {formatMoney(sums.monthly)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t.subscriptions.perYear}</span>
          <span className={styles.statValue} data-testid="total-year">
            {formatMoney(sums.yearly)}
          </span>
        </div>
      </div>

      {subs && subs.length === 0 ? (
        <EmptyState title={t.subscriptions.empty}>
          <StartDataButton moduleId="subscriptions" />
        </EmptyState>
      ) : null}
      <ItemList label={t.subscriptions.title}>
        {subs?.map((s) => {
          const charge = s.active ? nextCharge(s, day) : undefined;
          const cancel = s.active ? nextCancelDeadline(s, day) : undefined;
          const urgent = cancel ? daysBetween(day, cancel.deadline) <= WARN_DAYS : false;
          const increase = recentIncrease(s.priceHistory ?? [], day);
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
          ].filter(Boolean);
          const toggle = (active: boolean) =>
            void changeWithUndo(() => subscriptionRepo.update(s.id, { active }));
          const remove = () => void deleteWithUndo(() => subscriptionRepo.remove(s.id));
          return (
            <ItemRow
              key={s.id}
              title={s.name}
              className={s.active ? undefined : styles.inactive}
              meta={
                <>
                  {facts.join(' · ')}
                  {cancel ? (
                    <span className={urgent ? styles.warn : undefined}>
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
                  <span className={styles.amount}>{formatMoney(s.amountMinor)}</span>
                  <Switch
                    label={`${s.name}: ${t.subscriptions.active}`}
                    checked={s.active}
                    onChange={toggle}
                  />
                  {!s.active ? <Badge>{t.subscriptions.paused}</Badge> : null}
                </>
              }
            />
          );
        })}
      </ItemList>

      <SubscriptionEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
