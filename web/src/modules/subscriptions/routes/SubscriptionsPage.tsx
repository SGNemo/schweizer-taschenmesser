import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatMoney } from '@/core/money';
import { describeRecurrence } from '@/core/recurrence/describe';
import { daysBetween, formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Badge, Button, Card, EmptyState, Icon, Switch } from '@/ui';
import { SubscriptionEditor, type SubscriptionTarget } from '../components/SubscriptionEditor';
import { nextCancelDeadline, nextCharge, sortSubscriptions, totals } from '../logic';
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
  const [params, setParams] = useSearchParams();

  // `?new=1` (Quick-Add) opens the create dialog; derived from the URL.
  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const sums = totals(subs ?? []);

  return (
    <>
      <div className={styles.header}>
        <h1>{t.subscriptions.title}</h1>
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
      <ul className={styles.list}>
        {subs?.map((s) => {
          const charge = s.active ? nextCharge(s, day) : undefined;
          const cancel = s.active ? nextCancelDeadline(s, day) : undefined;
          const urgent = cancel ? daysBetween(day, cancel.deadline) <= WARN_DAYS : false;
          return (
            <Card as="li" key={s.id} className={s.active ? '' : styles.inactive}>
              <div className={styles.row}>
                <button type="button" className={styles.main} onClick={() => setTarget(s)}>
                  <span className={styles.name}>{s.name}</span>
                  <span className={styles.muted}>{describeRecurrence(s.recurrence)}</span>
                  <span className={styles.muted}>
                    {charge
                      ? `${t.subscriptions.nextCharge}: ${formatDay(charge, 'd. MMM yyyy')}`
                      : s.active
                        ? t.subscriptions.ended
                        : t.subscriptions.paused}
                  </span>
                  {cancel ? (
                    <span className={urgent ? styles.warn : styles.muted}>
                      {t.subscriptions.cancelBy}: {formatDay(cancel.deadline, 'd. MMM yyyy')}
                    </span>
                  ) : null}
                </button>
                <span className={styles.amount}>{formatMoney(s.amountMinor)}</span>
                <Switch
                  label={`${s.name}: ${t.subscriptions.active}`}
                  checked={s.active}
                  onChange={(active) => void subscriptionRepo.update(s.id, { active })}
                />
                {!s.active ? <Badge>{t.subscriptions.paused}</Badge> : null}
              </div>
            </Card>
          );
        })}
      </ul>

      <SubscriptionEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
