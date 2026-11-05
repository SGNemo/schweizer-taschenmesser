import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { getMeta, setMeta } from '@/core/db/metaKv';
import { getLang } from '@/core/i18n/lang';
import { dayName, explainAssignment, explainWait } from '@/core/plan/explain';
import { parseInstruction, type PlanOp } from '@/core/plan/instructions';
import { useFocusSettings } from '@/core/settings/focus';
import { addDaysStr, formatDay, isoWeekday } from '@/core/time/dates';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  GroupedList,
  ItemList,
  ItemRow,
  PageHeader,
  Progress,
  RowMenu,
  TextField,
  type RowMenuItem,
} from '@/ui';
import { HeroFigure, HeroSlot, SignatureMark, WeekBars } from '@/ui/identity';
import { usePageWidthAtLeast } from '@/ui/pageWidth';
import {
  addFromField,
  applyOps,
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
import { PlanPreview, type PreviewData } from '../components/PlanPreview';
import { WeekCheck } from '../components/WeekCheck';
import { BOARD_DAYS } from '../calendar';
import { beginPlanFocus, planFocusPath } from '../focus';
import { instructionItems, opLines } from '../say';
import { PlannerOffError, previewUser } from '../services';
import { useBoard } from '../useBoard';
import { useUiStore } from '@/stores/ui';
import styles from './planner.module.css';

/** Days on the board: a rolling week from today (the widget and the phone strip start there too). */
const SPAN = BOARD_DAYS;
/** From this page width (rem) the seven columns stand side by side; below, one day per screen. */
const WIDE_REM = 60;

/** Device-local (`_meta`): the Monday of the week whose „Woche prüfen“ line was clicked away. */
export const WEEK_CHECK_KEY = 'planner.weekCheck.dismissed';

/** A sentence waiting for „Übernehmen“: its ops and what the engine would do with them. */
interface Pending {
  ops: PlanOp[];
  lead: string;
  data: PreviewData;
  /** Said in the field (its text goes on „Übernehmen“), not chosen in ⋯. */
  fromField: boolean;
}

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
  // `?check=1` (the lists' „Woche prüfen im Planer“ link, a tap of the user) opens the week sheet.
  const [checking, setChecking] = useState(() => params.get('check') === '1');
  const [menuOpen, setMenuOpen] = useState(false);
  // The day shown in the one-day layout; `?day=` (the calendar's plan chip) picks it.
  const [pickedDay, setPickedDay] = useState<string | undefined>(
    () => params.get('day') ?? undefined,
  );
  const [why, setWhy] = useState<string | undefined>();
  const [pending, setPending] = useState<Pending | undefined>();
  const [ask, setAsk] = useState<
    { options: { key: string; title: string }[]; ops: (key: string) => PlanOp[] } | undefined
  >();
  const [sayLine, setSayLine] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const addRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const [focus] = useFocusSettings();
  const dismissedWeek = useLiveQuery(
    async () => (await getMeta<string>(WEEK_CHECK_KEY)) ?? null,
    [],
  );

  const titles = data?.titles ?? {};
  const board = data?.board;
  const todayDay = board?.days[0];

  // `?new=1` (quick add) focuses the one field; `?day=` (the calendar's plan chip) shows that day;
  // `?week=` (the calendar's „Plan“ entry) lands on the board, which always starts today.
  useEffect(() => {
    if (params.get('new')) {
      addRef.current?.querySelector('input')?.focus();
      setParams({}, { replace: true });
      return;
    }
    const day = params.get('day');
    if (day && board) {
      document
        .querySelector(`[data-testid="day-${day}"]`)
        ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      setParams({}, { replace: true });
    } else if (params.get('week') || params.get('check')) setParams({}, { replace: true });
  }, [params, setParams, board]);

  /** Shows what `ops` would do; nothing is stored until „Übernehmen“. */
  async function showPreview(ops: PlanOp[], fromField = false) {
    setAsk(undefined);
    setSayLine(undefined);
    try {
      const out = await previewUser(ops);
      const titleOf = (key: string) => titles[key] ?? out.titles[key] ?? key;
      const lines = opLines(ops, titleOf, data?.today ?? today());
      setPending({
        ops,
        lead: lines[0] ?? t.planner.ops.replan,
        data: { lines, diff: out.result.diff },
        fromField,
      });
    } catch (e) {
      if (!(e instanceof PlannerOffError)) throw e;
      useUiStore.getState().toast(t.planner.toast.off);
    }
  }

  async function apply() {
    if (!pending) return;
    setBusy(true);
    try {
      await applyOps(pending.ops, pending.lead, titles);
      if (pending.fromField) setText('');
      setPending(undefined);
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setPending(undefined);
    setAsk(undefined);
    setSayLine(undefined);
    // Instructions first – German only, like the quick-capture parser; elsewhere the ⋯ actions do the same.
    if (getLang() === 'de') {
      // While the board loads the sentence still reads its days; things are matched once it is there.
      const said = parseInstruction(value, {
        today: data?.today ?? today(),
        items: board ? instructionItems(board) : [],
      });
      if (said.kind === 'ops') {
        // The sentence stays in the field until „Übernehmen“: „Verwerfen“ keeps what was typed.
        await showPreview(said.ops, true);
        return;
      }
      if (said.kind === 'ask') {
        setAsk({ options: said.options, ops: said.ops });
        return;
      }
      if (said.kind === 'explain') {
        setSayLine(t.planner.say.explain);
        return;
      }
      if (said.kind === 'missing') {
        setSayLine(t.planner.say.missing(said.query));
        return;
      }
    }
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
    {
      id: 'replan',
      label: t.planner.head.replan,
      onSelect: () => void showPreview([{ op: 'replan', reshuffle: false }]),
    },
    { id: 'check', label: t.planner.check.title, onSelect: () => setChecking(true) },
  ];

  // „Woche prüfen · 2 Schritte“: Mondays only, only with the switch on, until it is clicked away for this week.
  const monday = data ? addDaysStr(data.today, 1 - isoWeekday(data.today)) : undefined;
  const showWeekLink =
    focus.weekCheck &&
    data !== undefined &&
    isoWeekday(data.today) === 1 &&
    dismissedWeek !== undefined &&
    dismissedWeek !== monday;

  /** The three biggest things of the shown week (all their sessions together). */
  const biggest = (() => {
    if (!board) return [];
    const sum = new Map<string, { title: string; minutes: number }>();
    for (const r of [...board.days.flatMap((d) => d.rows), ...board.waiting]) {
      const cur = sum.get(r.itemKey) ?? { title: r.title, minutes: 0 };
      cur.minutes += r.minutes;
      sum.set(r.itemKey, cur);
    }
    return [...sum.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 3);
  })();

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
      ...(date
        ? [
            {
              id: 'focus',
              label: t.planner.row.focus,
              onSelect: () => {
                const title =
                  row.of > 1
                    ? `${row.title} · ${t.planner.row.part(row.k + 1, row.of)}`
                    : row.title;
                void beginPlanFocus({ unitId: row.unitId, title, minutes: row.minutes }).then(() =>
                  navigate(planFocusPath(row.unitId)),
                );
              },
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
        // The minutes lead the meta line (a column is too narrow for a trailing figure), the deadline
        // follows, the reason only while „Warum hier?“ is on.
        meta={
          <span>
            <span className={styles.minutes}>
              {row.approx ? t.planner.row.approx(compact(row.minutes)) : compact(row.minutes)}
            </span>
            {row.hardDue ? (
              <span className={row.late ? styles.dueWas : undefined}>
                {` · ${row.late ? t.planner.row.dueWas(dayName(row.hardDue)) : t.planner.row.due(dayName(row.hardDue))}`}
              </span>
            ) : null}
            {open ? <span className={styles.reason}>{reason}</span> : null}
          </span>
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
              meta={`${t.planner.row.blocker} · ${compact(b.min)}`}
            />
          ))}
          {day.rows.map((row) => renderRow(row, day))}
        </ItemList>
      ) : null}
    </section>
  );

  const waiting = board?.waiting ?? [];
  const nothingPlanned = board !== undefined && board.days.every((d) => d.rows.length === 0);
  const shownDay = board?.days.find((d) => d.date === pickedDay) ?? board?.days[0];

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

      {showWeekLink ? (
        <p className={styles.weekLink} data-testid="week-check-link">
          <button type="button" className={styles.weekLinkText} onClick={() => setChecking(true)}>
            {t.planner.weekLink.label}
          </button>
          <IconButton
            label={t.planner.weekLink.dismiss}
            onClick={() => void setMeta(WEEK_CHECK_KEY, monday)}
          >
            <Icon name="close" size={16} />
          </IconButton>
        </p>
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

      {sayLine ? (
        <p className={styles.say} role="status" data-testid="plan-say">
          {sayLine}
        </p>
      ) : null}
      {ask ? (
        <div className={styles.say} role="group" aria-label={t.planner.say.askLabel}>
          <span>{t.planner.say.ask(ask.options[0]!.title, ask.options[1]!.title)}</span>
          {ask.options.map((o) => (
            <Button key={o.key} size="sm" onClick={() => void showPreview(ask.ops(o.key), true)}>
              {o.title}
            </Button>
          ))}
        </div>
      ) : null}
      {pending ? (
        <PlanPreview
          data={pending.data}
          nameOf={nameOf}
          busy={busy}
          onApply={() => void apply()}
          onDiscard={() => setPending(undefined)}
        />
      ) : null}

      {nothingPlanned && waiting.length === 0 ? (
        <EmptyState
          title={t.planner.empty}
          testId="planner-empty"
          motif={<SignatureMark id="weekBars" size={64} />}
        />
      ) : null}

      {board ? (
        wide ? (
          <div className={styles.board} role="group" aria-label={t.planner.board.label}>
            {board.days.map(renderDay)}
          </div>
        ) : (
          <div>
            <div className={styles.strip} role="group" aria-label={t.planner.board.strip}>
              {board.days.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  className={styles.stripChip}
                  aria-pressed={d.date === shownDay?.date}
                  onClick={() => setPickedDay(d.date)}
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
        <WeekCheck
          days={board.days}
          biggest={biggest}
          titles={titles}
          onClose={() => setChecking(false)}
        />
      ) : null}
    </>
  );
}
