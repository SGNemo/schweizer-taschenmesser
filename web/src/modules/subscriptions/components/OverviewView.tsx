import { useState } from 'react';
import { useHideValues } from '@/core/focus/hideValues';
import { formatMoney, formatTotals } from '@/core/money';
import { daysBetween, formatDay } from '@/core/time/dates';
import { relativeDays } from '@/core/i18n/format';
import { t } from '@/strings';
import { Card, Segmented } from '@/ui';
import { Bars, Donut } from '@/ui/charts';
import type { PlanMarkState } from '@/core/entitylinks/planMarkRead';
import type { Subscription } from '../schema';
import {
  byDay,
  costShares,
  mainCurrency,
  NO_CATEGORY,
  otherCurrencyCount,
  sumByCurrency,
  upcomingCharges,
  yearlyRanking,
  type ShareBy,
  type ShareKey,
} from '../overview';
import { DeadlinesCard, PricesCard, UnusedCard } from './ActionCards';
import styles from './OverviewView.module.css';

type Row = Subscription & { id: string };

/** Bars of the yearly ranking before the rest is one sentence (a long list of bars reads like a table). */
export const RANKING_BARS = 8;

/**
 * „Übersicht“ (round „Tiefe & Politur“): where the money goes (donut by kind or by subscription), the charges of the
 * next 30 days, the notice periods with „In den Plan“, what each subscription costs in a year, price changes and the
 * ones marked „Kaum genutzt“ (the last three only when there is something). Editing stays in the dialog. Charts are
 * drawn in the main currency only; other currencies are named in one line, never added in.
 */
export function OverviewView<R extends Row>({
  subs,
  day,
  onOpen,
  onPlan,
  marks,
}: {
  subs: readonly R[];
  day: string;
  onOpen: (s: R) => void;
  /** „In den Plan“ for a deadline; absent while the planner is off. */
  onPlan?: (s: R, deadline: string) => void;
  /** The plan marks of the subscriptions (`usePlanMarks`): a planned deadline shows its mark instead of a button. */
  marks?: ReadonlyMap<string, PlanMarkState>;
}) {
  const v = t.subscriptions.ext.overview;
  const [by, setBy] = useState<ShareBy>('category');
  const hide = useHideValues();
  const currency = mainCurrency(subs, day);
  const money = (c: number) => formatMoney(c, currency);
  const others = currency ? otherCurrencyCount(subs, day, currency) : 0;
  const shares = currency ? costShares(subs, day, by, currency) : [];
  const label = (id: string, raw: string) =>
    by === 'provider'
      ? raw
      : id === NO_CATEGORY
        ? v.noCategory
        : t.subscriptions.ext.category[id as Exclude<ShareKey, typeof NO_CATEGORY>];
  const ranking = currency ? yearlyRanking(subs, day, currency) : [];
  const shown = ranking.slice(0, RANKING_BARS);
  const rest = ranking.slice(RANKING_BARS);

  return (
    <div className={styles.grid} data-testid="subscriptions-overview">
      <Card title={v.sharesTitle} className={styles.card}>
        <Segmented
          label={v.byLabel}
          value={by}
          options={[
            { value: 'category', label: v.byCategory },
            { value: 'provider', label: v.byProvider },
          ]}
          onChange={setBy}
        />
        <Donut
          title={by === 'category' ? v.sharesByCategory : v.sharesByProvider}
          data={shares.map((s) => ({ id: s.id, label: label(s.id, s.label), value: s.value }))}
          centreLabel={v.perMonth}
          format={money}
          sensitive
          emptyText={v.nothingRunning}
          data-testid="subscriptions-donut"
        />
        {others > 0 ? <p className={styles.note}>{v.otherCurrencies(others)}</p> : null}
      </Card>

      <UpcomingCard subs={subs} day={day} onOpen={onOpen} />
      <DeadlinesCard subs={subs} day={day} onOpen={onOpen} onPlan={onPlan} marks={marks} />

      <Card title={v.yearTitle} className={styles.card}>
        <Bars
          title={v.yearTitle}
          data={shown.map((r) => ({ id: r.sub.id, label: r.sub.name, value: r.yearly }))}
          format={money}
          sensitive
          emptyText={v.nothingRunning}
          data-testid="subscriptions-year"
        />
        {rest.length > 0 ? (
          <p className={styles.note}>
            {v.moreInYear(
              rest.length,
              hide ? '••••' : money(rest.reduce((sum, r) => sum + r.yearly, 0)),
            )}
          </p>
        ) : null}
      </Card>
      <PricesCard subs={subs} day={day} onOpen={onOpen} />
      <UnusedCard subs={subs} day={day} onOpen={onOpen} />
    </div>
  );
}

/** The next 30 days as a short timeline: one group per day, the sum on top; a row opens its subscription. */
function UpcomingCard<R extends Row>({
  subs,
  day,
  onOpen,
}: {
  subs: readonly R[];
  day: string;
  onOpen: (s: R) => void;
}) {
  const v = t.subscriptions.ext.overview;
  const hide = useHideValues();
  const charges = upcomingCharges(subs, day);
  const groups = byDay(charges);
  // „Werte ausblenden“: amounts become dots (screen readers hear „ausgeblendet“), names and dates stay.
  const mask = <span aria-label={t.widgets.valueHidden}>••••</span>;
  const amount = (minor: number, currency: string) => (hide ? mask : formatMoney(minor, currency));
  const byId = new Map(subs.map((s) => [s.id, s]));
  return (
    <Card title={v.upcomingTitle} className={styles.card} data-testid="subscriptions-upcoming">
      {charges.length === 0 ? (
        <p className={styles.note}>{v.upcomingEmpty}</p>
      ) : (
        <>
          <p className={styles.sum}>
            {v.upcomingSum(charges.length)}{' '}
            <b data-testid="upcoming-sum">{hide ? mask : formatTotals(sumByCurrency(charges))}</b>
          </p>
          <ol className={styles.days}>
            {groups.map((g) => {
              const d = daysBetween(day, g.date);
              return (
                <li key={g.date} className={styles.day}>
                  <span className={styles.date}>
                    {d <= 1 ? capitalize(relativeDays(d)) : formatDay(g.date, 'EEE, d. MMM')}
                  </span>
                  <ul className={styles.charges}>
                    {g.items.map((c) => {
                      const s = byId.get(c.id);
                      return (
                        <li key={`${c.id}-${c.date}`}>
                          <button
                            type="button"
                            className={styles.charge}
                            onClick={() => s && onOpen(s)}
                          >
                            <span className={styles.name}>{c.name}</span>
                            <span className={styles.amount}>
                              {amount(c.amountMinor, c.currency)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Card>
  );
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);
