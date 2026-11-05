import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { dayName, explainAssignment, explainWait } from '@/core/plan/explain';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import {
  Button,
  EmptyState,
  GroupedList,
  ItemList,
  ItemRow,
  PageHeader,
  Progress,
  RowMenu,
  TextField,
  type RowMenuItem,
} from '@/ui';
import { HeroFigure, HeroSlot, WeekBars } from '@/ui/identity';
import { usePageWidthAtLeast } from '@/ui/pageWidth';
import {
  addFromField,
  exclude,
  include,
  later,
  markDone,
  markDue,
  pin,
  unmarkDue,
  unpin,
} from '../actions';
import type { BoardDay, BoardRow, WaitingRow } from '../board';
import { capacityLabel, capacityShort, compact } from '../components/capacity';
import { DaySheet } from '../components/DaySheet';
import { WeekCheck } from '../components/WeekCheck';
import { useBoard } from '../useBoard';
import styles from './planner.module.css';

/** Days on the board: a rolling week from today (the widget and the phone strip start there too). */
const SPAN = 7;
/** From this page width (rem) the seven columns stand side by side; below, one day per screen. */
const WIDE_REM = 60;

/** „Teil 1/2“ for the eye, „Teil 1 von 2“ for the screen reader. */
function Part({ k, of }: { k: number; of: number }) {
  return (
    <>
      <span className={styles.part} aria-hidden="true">
        {` · ${t.planner.row.part(k + 1, of)}`}
      </span>
      <span className="sr-only">{` ${t.planner.row.partAria(k + 1, of)}`}</span>
    </>
  );
}

export default function PlannerPage() {
  const data = useBoard(SPAN);
  const wide = usePageWidthAtLeast(WIDE_REM) ?? true;
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState('');
  const [sheetDate, setSheetDate] = useState<string | undefined>();
  const [checking, setChecking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  const [why, setWhy] = useState<string | undefined>();
  const addRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();

  // `?new=1` (quick add) focuses the one field.
  useEffect(() => {
    if (params.get('new')) {
      addRef.current?.querySelector('input')?.focus();
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const titles = data?.titles ?? {};
  const board = data?.board;
  const todayDay = board?.days[0];

  async function add(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    const ok = await addFromField(value, titles);
    // Nothing happened (the planner was switched off meanwhile): the text comes back.
    if (!ok) setText((cur) => cur || value);
    // The next entry follows right away; no scroll jump while the board below re-renders.
    addRef.current?.querySelector('input')?.focus({ preventScroll: true });
  }

  const headValue = !todayDay
    ? ''
    : todayDay.off
      ? t.planner.head.dayOff
      : todayDay.free > 0
        ? t.planner.head.free(compact(todayDay.free))
        : todayDay.over > 0
          ? t.planner.head.over(compact(todayDay.over))
          : todayDay.usable === 0
            ? t.planner.head.noTime
            : t.planner.head.full;
  const headDetail = todayDay
    ? `${t.planner.head.context(board!.todayCount, compact(todayDay.planned))} · ${t.planner.head.week(formatDay(todayDay.date, 'II'))}`
    : undefined;

  const pageMenu: RowMenuItem[] = [
    { id: 'check', label: t.planner.check.title, onSelect: () => setChecking(true) },
  ];

  const titleOf = (unitId: string) => {
    const key = unitId.slice(0, unitId.lastIndexOf('#'));
    return titles[key] ?? key;
  };
  const nameOf = (unitId: string) => {
    const k = Number(unitId.slice(unitId.lastIndexOf('#') + 1));
    const row = board?.days.flatMap((d) => d.rows).find((r) => r.unitId === unitId);
    return row && row.of > 1
      ? `${titleOf(unitId)} · ${t.planner.row.part(k + 1, row.of)}`
      : titleOf(unitId);
  };

  /** The ⋯ menu of a row; `date` = the row's day (a waiting row has none: then today, named). */
  const rowMenu = (row: BoardRow | WaitingRow, date?: string, reason?: string): RowMenuItem[] => {
    const e = row.entry;
    if (!e) return [];
    const day = date ?? data!.today;
    const pinned = row.item?.pinned !== undefined;
    const hard = row.item?.due?.hard === true;
    const excluded = row.item?.excluded === true;
    const open = why === row.unitId;
    return [
      { id: 'done', label: t.planner.row.done, onSelect: () => void markDone(e, titles) },
      { id: 'later', label: t.planner.row.later, onSelect: () => void later(e, titles) },
      ...(excluded
        ? [{ id: 'include', label: t.planner.row.include, onSelect: () => void include(e, titles) }]
        : [
            pinned
              ? { id: 'unpin', label: t.planner.row.unpin, onSelect: () => void unpin(e, titles) }
              : {
                  id: 'pin',
                  label: t.planner.row.pinOn(dayName(day)),
                  onSelect: () => void pin(e, day, titles),
                },
            {
              id: 'exclude',
              label: t.planner.row.exclude,
              onSelect: () => void exclude(e, titles),
            },
          ]),
      hard
        ? {
            id: 'unmarkDue',
            label: t.planner.row.unmarkDue,
            onSelect: () => void unmarkDue(e, titles),
          }
        : {
            id: 'markDue',
            label: t.planner.row.markDueOn(dayName(e.due?.date ?? day)),
            onSelect: () => void markDue(e, e.due?.date ?? day, titles),
          },
      ...(reason
        ? [
            {
              id: 'why',
              label: t.planner.row.why,
              checked: open,
              onSelect: () => setWhy(open ? undefined : row.unitId),
            },
          ]
        : []),
      { id: 'open', label: t.planner.row.open, onSelect: () => void navigate(e.to) },
    ];
  };

  const renderRow = (row: BoardRow, day: BoardDay) => {
    const reason = explainAssignment(
      { reason: row.reason, bumpedBy: row.bumpedBy },
      { due: row.hardDue ?? row.entry?.due?.date, prevDate: row.entry?.plannedFor, nameOf },
    );
    const open = why === row.unitId;
    return (
      <ItemRow
        key={row.unitId}
        title={
          <span title={reason}>
            {row.title}
            {row.of > 1 ? <Part k={row.k} of={row.of} /> : null}
          </span>
        }
        titleFull
        meta={
          open || row.late || row.hardDue ? (
            <span>
              {row.hardDue ? (
                <span className={row.late ? styles.dueWas : undefined}>
                  {row.late
                    ? t.planner.row.dueWas(dayName(row.hardDue))
                    : t.planner.row.due(dayName(row.hardDue))}
                </span>
              ) : null}
              {open ? <span className={styles.reason}>{reason}</span> : null}
            </span>
          ) : undefined
        }
        lead={
          row.entry ? (
            <input
              type="checkbox"
              className={styles.check}
              aria-label={row.title}
              data-row-tick
              checked={false}
              onChange={() => void markDone(row.entry!, titles)}
            />
          ) : undefined
        }
        end={
          <span className={styles.minutes}>
            {row.approx ? t.planner.row.approx(compact(row.minutes)) : compact(row.minutes)}
          </span>
        }
        menu={rowMenu(row, day.date, reason)}
        menuLabel={t.planner.row.menu(row.title)}
        // Swipes only in the one-day layout: a swipeable row clips sideways, and in a narrow column the
        // ⋯ menu is wider than the row.
        onSwipeRight={!wide && row.entry ? () => void markDone(row.entry!, titles) : undefined}
        swipeRightLabel={t.planner.row.done}
        onSwipeLeft={!wide && row.entry ? () => void later(row.entry!, titles) : undefined}
        swipeLeftLabel={t.planner.row.later}
      />
    );
  };

  const renderDay = (day: BoardDay) => (
    <section
      key={day.date}
      className={styles.column}
      data-today={day.isToday}
      data-off={day.off}
      data-testid={`day-${day.date}`}
      aria-label={formatDay(day.date, 'EEEE, d. MMMM')}
    >
      <button type="button" className={styles.dayButton} onClick={() => setSheetDate(day.date)}>
        <span className={styles.dayName}>{formatDay(day.date, 'EEE d.')}</span>
        <span className={styles.capacity}>{capacityLabel(day)}</span>
        {!day.off ? (
          <span className={styles.bar}>
            <Progress
              value={day.planned}
              max={Math.max(day.usable, 1)}
              label={t.planner.board.load(compact(day.planned), compact(day.usable))}
            />
          </span>
        ) : null}
      </button>
      {day.blockers.length > 0 || day.rows.length > 0 ? (
        <ItemList label={formatDay(day.date, 'EEEE')}>
          {day.blockers.map((b) => (
            <ItemRow
              key={b.id}
              className={styles.blocker}
              title={b.label}
              meta={t.planner.row.blocker}
              end={<span className={styles.minutes}>{compact(b.min)}</span>}
            />
          ))}
          {day.rows.map((row) => renderRow(row, day))}
        </ItemList>
      ) : null}
    </section>
  );

  const waiting = board?.waiting ?? [];
  const nothingPlanned = board !== undefined && board.days.every((d) => d.rows.length === 0);
  const shownDay = board?.days[Math.min(dayIndex, SPAN - 1)];

  return (
    <>
      <PageHeader title={t.planner.title}>
        <RowMenu
          label={t.planner.head.menu}
          items={pageMenu}
          open={menuOpen}
          onOpenChange={setMenuOpen}
        />
      </PageHeader>
      {todayDay ? (
        <HeroSlot area="figure">
          <HeroFigure value={headValue} detail={headDetail} type="thin" testId="planner-head" />
        </HeroSlot>
      ) : null}
      {board ? (
        <HeroSlot area="signature">
          <WeekBars
            fill={board.days.map((d) => (d.usable > 0 ? Math.min(1, d.planned / d.usable) : 0))}
          />
        </HeroSlot>
      ) : null}

      <form ref={addRef} onSubmit={add} className={styles.add} data-keep-visible>
        <div className={styles.grow}>
          <TextField
            label={t.planner.add.label}
            placeholder={t.planner.add.placeholder}
            hint={t.planner.add.hint}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          {t.planner.add.submit}
        </Button>
      </form>

      {nothingPlanned && waiting.length === 0 ? (
        <EmptyState title={t.planner.empty} testId="planner-empty" />
      ) : null}

      {board ? (
        wide ? (
          <div className={styles.board} role="group" aria-label={t.planner.board.label}>
            {board.days.map(renderDay)}
          </div>
        ) : (
          <div>
            <div className={styles.strip} role="group" aria-label={t.planner.board.strip}>
              {board.days.map((d, i) => (
                <button
                  key={d.date}
                  type="button"
                  className={styles.stripChip}
                  aria-pressed={i === dayIndex}
                  onClick={() => setDayIndex(i)}
                >
                  <span>{dayName(d.date)}</span>
                  <span>{capacityShort(d)}</span>
                </button>
              ))}
            </div>
            {shownDay ? renderDay(shownDay) : null}
          </div>
        )
      ) : null}

      {waiting.length > 0 ? (
        <div className={styles.waiting}>
          <GroupedList
            listId="planner"
            groups={[
              {
                id: 'waiting',
                label: t.planner.wait.title,
                count: waiting.length,
                children: (
                  <ItemList>
                    {waiting.map((w) => (
                      <ItemRow
                        key={w.unitId}
                        title={
                          <span>
                            {w.title}
                            {w.of > 1 ? <Part k={w.k} of={w.of} /> : null}
                          </span>
                        }
                        titleFull
                        meta={
                          w.reason === 'excluded'
                            ? t.planner.row.excludedState
                            : explainWait({ reason: w.reason, bumpedBy: w.bumpedBy }, nameOf)
                        }
                        end={<span className={styles.minutes}>{compact(w.minutes)}</span>}
                        menu={rowMenu(w)}
                        menuLabel={t.planner.row.menu(w.title)}
                      />
                    ))}
                  </ItemList>
                ),
              },
            ]}
          />
        </div>
      ) : null}

      <DaySheet
        day={board?.days.find((d) => d.date === sheetDate)}
        titles={titles}
        onClose={() => setSheetDate(undefined)}
      />
      {checking && board ? (
        <WeekCheck days={board.days} titles={titles} onClose={() => setChecking(false)} />
      ) : null}
    </>
  );
}
