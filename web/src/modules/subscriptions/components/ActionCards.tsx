import type { ReactNode } from 'react';
import { useHideValues } from '@/core/focus/hideValues';
import { relativeDays } from '@/core/i18n/format';
import { currencyOf, formatMoney, formatTotals } from '@/core/money';
import { addDaysStr, formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Card, Icon } from '@/ui';
import { cancelTone, changePercent } from '../logic';
import { recentPriceChanges, unusedRows, upcomingDeadlines, UPCOMING_DAYS } from '../overview';
import type { Subscription } from '../schema';
import styles from './OverviewView.module.css';

type Row = Subscription & { id: string };

/** „Werte ausblenden“: amounts become dots (screen readers hear „ausgeblendet“), names and dates stay. */
function useAmount() {
  const hide = useHideValues();
  const mask = <span aria-label={t.widgets.valueHidden}>••••</span>;
  return {
    money: (minor: number, currency: string): ReactNode =>
      hide ? mask : formatMoney(minor, currency),
    totals: (sums: Map<string, number>): ReactNode => (hide ? mask : formatTotals(sums)),
  };
}

/** One row of a card: the name opens the subscription, `children` is the second line, `end` sits right. */
function CardRow({
  name,
  onOpen,
  children,
  end,
}: {
  name: string;
  onOpen: () => void;
  children: ReactNode;
  end?: ReactNode;
}) {
  return (
    <li className={styles.cardRow}>
      <button type="button" className={styles.rowMain} onClick={onOpen}>
        <span className={styles.name}>{name}</span>
        <span className={styles.rowMeta}>{children}</span>
      </button>
      {end ? <span className={styles.rowEnd}>{end}</span> : null}
    </li>
  );
}

/**
 * „Kündigungsfristen“: the next deadline of each subscription within 90 days, earliest first. A near one is
 * marked like in the list (warning colour, clock, „in n Tagen“; never red). „In den Plan“ only while the planner
 * is on (`onPlan`); a planned one says „Im Plan“. Hidden when no subscription has a notice period.
 */
export function DeadlinesCard<R extends Row>({
  subs,
  day,
  onOpen,
  onPlan,
}: {
  subs: readonly R[];
  day: string;
  onOpen: (s: R) => void;
  onPlan?: (s: R, deadline: string) => void;
}) {
  const w = t.subscriptions.ext.deadlines;
  const { money } = useAmount();
  if (!subs.some((s) => s.active && s.cancelNoticeDays !== undefined && !s.recurrence.until))
    return null;
  const rows = upcomingDeadlines(subs, day);
  // The next 30 days in view; later ones (up to 90) wait folded behind one line (one thing at a time).
  const soonLast = addDaysStr(day, UPCOMING_DAYS - 1);
  const near = rows.filter((r) => r.deadline <= soonLast);
  const later = rows.filter((r) => r.deadline > soonLast);
  const list = (part: typeof rows) => (
    <ul className={styles.rows}>
      {part.map((r) => {
        const tone = cancelTone(r.deadline, day);
        const soon = tone.tone === 'soon';
        return (
          <CardRow
            key={r.sub.id}
            name={r.sub.name}
            onOpen={() => onOpen(r.sub)}
            end={
              r.planned ? (
                <span className={styles.planned}>
                  <Icon name="check" size={16} />
                  {w.planned}
                </span>
              ) : onPlan ? (
                <Button
                  variant="ghost"
                  aria-label={w.planFor(r.sub.name)}
                  onClick={() => onPlan(r.sub, r.deadline)}
                >
                  {w.plan}
                </Button>
              ) : null
            }
          >
            <span className={soon ? styles.warn : undefined} data-tone={tone.tone}>
              {soon ? <Icon name="clock" size={14} /> : null}
              {w.by(formatDay(r.deadline, 'd. MMM'))}
              {soon ? ` · ${relativeDays(tone.days)}` : null}
            </span>
            {' · '}
            <OtherwiseLine
              amount={money(r.sub.amountMinor, currencyOf(r.sub))}
              date={formatDay(r.charge, 'd. MMM')}
            />
          </CardRow>
        );
      })}
    </ul>
  );
  return (
    <Card title={w.title} className={styles.card} data-testid="subscriptions-deadlines">
      {rows.length === 0 ? <p className={styles.note}>{w.none}</p> : null}
      {near.length > 0 ? list(near) : null}
      {later.length > 0 ? (
        <details className={styles.more}>
          <summary>{w.later(later.length)}</summary>
          {list(later)}
        </details>
      ) : null}
    </Card>
  );
}

/** „sonst 12,99 € am 3. Okt.“ with the amount maskable: the sentence is split around it. */
function OtherwiseLine({ amount, date }: { amount: ReactNode; date: string }) {
  const marker = '\u0000';
  const [before, after] = t.subscriptions.ext.deadlines.otherwise(marker, date).split(marker);
  return (
    <>
      {before}
      {amount}
      {after}
    </>
  );
}

/** „Preisänderungen“: the newest change of each subscription in the last year, before → after and per year. */
export function PricesCard<R extends Row>({
  subs,
  day,
  onOpen,
}: {
  subs: readonly R[];
  day: string;
  onOpen: (s: R) => void;
}) {
  const w = t.subscriptions.ext.prices;
  const hide = useHideValues();
  const rows = recentPriceChanges(subs, day);
  if (rows.length === 0) return null;
  return (
    <Card title={w.title} className={styles.card} data-testid="subscriptions-prices">
      <ul className={styles.rows}>
        {rows.map((r) => {
          const c = currencyOf(r.sub);
          const up = r.perYear > 0;
          return (
            <CardRow
              key={r.sub.id}
              name={r.sub.name}
              onOpen={() => onOpen(r.sub)}
              end={
                hide ? null : (
                  <span className={styles.amount}>
                    {w.perYear(formatMoney(Math.abs(r.perYear), c), up)}
                  </span>
                )
              }
            >
              {hide
                ? `${changePercent(r.change) > 0 ? '+' : ''}${changePercent(r.change)} %`
                : w.change(
                    formatMoney(r.change.fromMinor, c),
                    formatMoney(r.change.toMinor, c),
                    changePercent(r.change),
                  )}
              {' · '}
              {w.since(formatDay(r.change.date, 'd. MMM yyyy'))}
            </CardRow>
          );
        })}
      </ul>
    </Card>
  );
}

/** „Kaum genutzt“: the subscriptions marked so, with what they cost in a year. Information only, no nudge. */
export function UnusedCard<R extends Row>({
  subs,
  day,
  onOpen,
}: {
  subs: readonly R[];
  day: string;
  onOpen: (s: R) => void;
}) {
  const w = t.subscriptions.ext.unused;
  const { money, totals } = useAmount();
  const { rows, sums } = unusedRows(subs, day);
  if (rows.length === 0) return null;
  return (
    <Card title={w.title} className={styles.card} data-testid="subscriptions-unused">
      {/* One row says its amount itself; a sum line only adds something from two on. */}
      {rows.length > 1 ? (
        <p className={styles.sum}>
          <SumLine n={rows.length} amount={<b>{totals(sums)}</b>} />
        </p>
      ) : null}
      <ul className={styles.rows}>
        {rows.map((r) => (
          <CardRow
            key={r.sub.id}
            name={r.sub.name}
            onOpen={() => onOpen(r.sub)}
            end={<span className={styles.amount}>{money(r.yearly, currencyOf(r.sub))}</span>}
          >
            {t.subscriptions.ext.prices.since(formatDay(r.sub.unusedSince!, 'd. MMM yyyy'))}
          </CardRow>
        ))}
      </ul>
    </Card>
  );
}

function SumLine({ n, amount }: { n: number; amount: ReactNode }) {
  const marker = '\u0000';
  const [before, after] = t.subscriptions.ext.unused.sum(n, marker).split(marker);
  return (
    <>
      {before}
      {amount}
      {after}
    </>
  );
}
