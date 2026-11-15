import { useId, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { dateTimeFormat } from '@/core/i18n/format';
import type { PlannableEntry } from '@/core/modules/contributions';
import { dayName } from '@/core/plan/explain';
import { parseDate } from '@/core/time/dates';
import { t } from '@/strings';
import { Card, Icon, ItemList, ItemRow } from '@/ui';
import type { BoardDay, WaitingRow } from '../board';
import { compact } from './capacity';
import { ActionLead, LinkChips, useRowLinks } from './RowLinks';
import { sourceOf } from './ThingRow';
import styles from '../routes/planner.module.css';

/** The appointments of the board's days that block time (from the calendar), in day order. */
export function appointmentsOf(days: readonly BoardDay[]) {
  return days.flatMap((d) =>
    d.blockers.filter((b) => b.calendar).map((b) => ({ ...b, date: d.date })),
  );
}

/** One row of „Nächste Fristen“: a thing of the plan and its hard deadline. */
export interface NextDeadline {
  itemKey: string;
  title: string;
  date: string;
  time?: string;
  entry: PlannableEntry;
}

/** How many deadlines the card names (CONCEPT-DESIGN §4: „Nächste Fristen“ (three)). */
export const NEXT_DEADLINES = 3;

/**
 * „Nächste Fristen“ (planner hub R2, CONCEPT-DESIGN §4): the next things of the plan with a hard deadline inside the
 * board's days that has not passed – late money stands in „Frist vorbei“, a late session says „Frist war …“ in its
 * own row. Reads only the board: the days' rows and the waiting group; one row per thing, the nearest first.
 */
export function nextDeadlinesOf(
  days: readonly BoardDay[],
  waiting: readonly WaitingRow[],
  limit = NEXT_DEADLINES,
): NextDeadline[] {
  const first = days[0]?.date;
  const last = days.at(-1)?.date;
  if (!first || !last) return [];
  const byKey = new Map<string, NextDeadline>();
  const add = (d: NextDeadline) => {
    if (d.date < first || d.date > last || byKey.has(d.itemKey)) return;
    byKey.set(d.itemKey, d);
  };
  for (const day of days)
    for (const row of day.rows)
      if (row.hardDue && !row.late && row.entry)
        add({
          itemKey: row.itemKey,
          title: row.title,
          date: row.hardDue,
          ...(row.hardDueTime ? { time: row.hardDueTime } : {}),
          entry: row.entry,
        });
  for (const row of waiting) {
    if (row.reason === 'excluded' || !row.entry) continue;
    const due = row.item?.due?.hard ? row.item.due : row.entry.due;
    if (due?.hard)
      add({
        itemKey: row.itemKey,
        title: row.title,
        date: due.date,
        ...(due.time ? { time: due.time } : {}),
        entry: row.entry,
      });
  }
  return [...byKey.values()]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time ?? '24:00').localeCompare(b.time ?? '24:00') ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

/** „Do., 19.11.“ (with its hour when the deadline has one) – in the app's date format. */
function deadlineText(d: Pick<NextDeadline, 'date' | 'time'>): string {
  const date = dateTimeFormat({ weekday: 'short', day: 'numeric', month: 'numeric' }).format(
    parseDate(d.date),
  );
  return d.time ? `${date} ${d.time}` : date;
}

/**
 * One row of „Nächste Fristen“ in the row grammar of the sheet (K1b): the source's action in the lead slot (else
 * its icon), the title opens the thing, the date and the source word, the chip line. No ⋯: the card points at
 * the thing, its day row (or its source) holds the steps.
 */
function DeadlineRow({ d }: { d: NextDeadline }) {
  const navigate = useNavigate();
  const source = sourceOf(d.entry);
  const links = useRowLinks(d.entry);
  const action = d.entry.action;
  return (
    <ItemRow
      lead={
        action ? (
          <ActionLead action={action} title={d.title} />
        ) : (
          <span className={styles.lead} aria-hidden="true">
            <Icon name={source.icon} size={20} />
          </span>
        )
      }
      title={
        <span className={styles.thingTitle} title={d.title}>
          {d.title}
        </span>
      }
      onOpen={() => void navigate(d.entry.to)}
      meta={
        <span className={styles.meta}>
          <span>{deadlineText(d)}</span>
          <span aria-hidden="true">·</span>
          <span>{source.word}</span>
        </span>
      }
      below={links.length > 0 ? <LinkChips views={links} /> : undefined}
    />
  );
}

/** The card „Nächste Fristen“: title, date and source word; a row opens the thing in its module. No rows, no card. */
function NextDeadlines({ rows }: { rows: readonly NextDeadline[] }) {
  const id = useId();
  if (rows.length === 0) return null;
  return (
    <Card className={styles.sheet} aria-labelledby={id} data-testid="planner-deadlines">
      <h2 id={id} className={styles.cardHead}>
        {t.planner.ctx.deadlines}
      </h2>
      <ItemList label={t.planner.ctx.deadlines}>
        {rows.map((d) => (
          <DeadlineRow key={d.itemKey} d={d} />
        ))}
      </ItemList>
    </Card>
  );
}

/**
 * What stands around the week (planner hub R1): the appointments of the seven days, „Nächste Fristen“ (R2) and,
 * as `children`, the group that waits for free time. Beside the sheet on a wide page, under it elsewhere. No
 * appointments: no card.
 */
export function Context({
  days,
  before,
  deadlines = [],
  children,
}: {
  days: readonly BoardDay[];
  /** The first card of the column („Frist vorbei“, R2). */
  before?: ReactNode;
  /** „Nächste Fristen“ (R2), after the appointments; none, no card. */
  deadlines?: readonly NextDeadline[];
  children?: ReactNode;
}) {
  const id = useId();
  const appointments = appointmentsOf(days);
  return (
    <div className={styles.context}>
      {before}
      {appointments.length > 0 ? (
        <Card className={styles.sheet} aria-labelledby={id} data-testid="planner-appointments">
          <h2 id={id} className={styles.cardHead}>
            {t.planner.ctx.appointments}
          </h2>
          <ItemList label={t.planner.ctx.appointments}>
            {appointments.map((a) => (
              <ItemRow
                key={`${a.date}-${a.id}`}
                lead={
                  <span className={styles.lead} aria-hidden="true">
                    <Icon name="calendar" size={20} />
                  </span>
                }
                title={a.label}
                meta={
                  <span className={styles.meta}>
                    <span>{a.from ? `${dayName(a.date)} ${a.from}` : dayName(a.date)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{compact(a.min)}</span>
                  </span>
                }
              />
            ))}
          </ItemList>
        </Card>
      ) : null}
      <NextDeadlines rows={deadlines} />
      {children}
    </div>
  );
}
