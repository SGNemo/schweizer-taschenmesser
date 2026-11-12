import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { getMeta, setMeta } from '@/core/db/metaKv';
import { getLang } from '@/core/i18n/lang';
import { dayName, explainAssignment, explainWait } from '@/core/plan/explain';
import type { Instruction, PlanOp } from '@/core/plan/instructions';
import { useModuleStates } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
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
  SplitView,
  useSplitView,
} from '@/ui';
import { HeroFigure, HeroSlot, SignatureMark } from '@/ui/identity';
import {
  addFromField,
  applyOps,
  exclude,
  include,
  later,
  markDone,
  markDue,
  pin,
  sourceAbilities,
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
import { overloadText } from '../overload';
import { readSentence, warmLocalStage, type Said } from '../localStage';
import { instructionItems, opLines, planLines } from '../say';
import { PlannerOffError, previewUser } from '../services';
import { useBoard } from '../useBoard';
import { useUiStore } from '@/stores/ui';
import styles from './planner.module.css';

/** Days on the board: a rolling week from today (the widget and the phone strip start there too). */
const SPAN = BOARD_DAYS;

/** Device-local (`_meta`): the Monday of the week whose „Woche prüfen“ line was clicked away. */
export const WEEK_CHECK_KEY = 'planner.weekCheck.dismissed';

/** A sentence waiting for „Übernehmen“: its ops and what the engine would do with them. */
interface Pending {
  ops: PlanOp[];
  lead: string;
  data: PreviewData;
  /** Said in the field (its text goes on „Übernehmen“), not chosen in ⋯. */
  fromField: boolean;
  /** The model's reading of this sentence; `rules` = what the rules made of it (stands on „Verwerfen“). */
  local?: { sentence: string; rules: Instruction };
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
  // Master–detail (layout `split`, package 0b-4b): on a wide page the week is a list and the picked day lies in the
  // panel beside it; below that width the week is a strip of chips above the picked day.
  const wide = useSplitView();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState('');
  const hintId = useId();
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
  // The local model is reading a sentence (desktop with a model only): the field waits, one calm line says so.
  const [reading, setReading] = useState(false);
  // The running model request; aborted on Escape and when the page goes.
  const readingRef = useRef<AbortController | undefined>(undefined);
  // A model reading the user discarded or stopped: the same sentence, sent again, skips the model.
  const declinedRef = useRef<string | undefined>(undefined);
  const addRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const moduleStates = useModuleStates();
  const mailOn = !!getManifest('mail') && moduleStates?.mail === true;
  const [focus] = useFocusSettings();
  const dismissedWeek = useLiveQuery(
    async () => (await getMeta<string>(WEEK_CHECK_KEY)) ?? null,
    [],
  );

  // Which sources take a tick or „Später“ (an invoice, a cancellation: no – that stays in its module).
  const [abilities, setAbilities] = useState<Record<string, { done: boolean; assign: boolean }>>();
  useEffect(() => {
    let live = true;
    void sourceAbilities().then((a) => live && setAbilities(a));
    return () => {
      live = false;
    };
  }, []);
  // Until they are known every source counts as able (no jump for ToDo rows); `markDone` checks again.
  const canDone = (moduleId: string) => abilities?.[moduleId]?.done ?? true;
  const canAssign = (moduleId: string) => abilities?.[moduleId]?.assign ?? true;

  const titles = data?.titles ?? {};
  const board = data?.board;
  const todayDay = board?.days[0];

  // The local stage reads the shell's status once (the desktop app with AI on; nowhere else).
  useEffect(() => {
    void warmLocalStage();
    return () => readingRef.current?.abort();
  }, []);

  // `?new=1` (quick add) focuses the one field; `?day=` (the calendar's plan chip) shows that day;
  // `?week=` (the calendar's „Plan“ entry) lands on the board, which always starts today.
  useEffect(() => {
    if (params.get('new')) {
      // the entry row comes with the board (it is the last row under it)
      if (!board) return;
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

  /** Shows what `ops` would do; nothing is stored until „Übernehmen“. `local` = the model read the sentence. */
  async function showPreview(ops: PlanOp[], fromField = false, local?: Pending['local']) {
    setAsk(undefined);
    setSayLine(undefined);
    try {
      const out = await previewUser(ops);
      const titleOf = (key: string) => titles[key] ?? out.titles[key] ?? key;
      const lines = opLines(ops, titleOf, data?.today ?? today());
      setPending({
        ops,
        lead: lines[0] ?? t.planner.ops.replan,
        // A sentence the local model read says so above the lines: its reading is checked here, by the user.
        data: {
          lines,
          ...(local ? { note: t.planner.say.localRead } : {}),
          diff: out.result.diff,
        },
        fromField,
        ...(local ? { local } : {}),
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

  /**
   * What stands when the user sets the model's reading aside: the rules' line, or – when the rules saw
   * no instruction – the promise that the next „Eintragen“ makes the ToDo. The sentence is not asked again.
   */
  function fallBackToRules(sentence: string, rules: Instruction, stopped: boolean) {
    declinedRef.current = sentence;
    if (rules.kind === 'explain') setSayLine(t.planner.say.explain);
    else if (rules.kind === 'missing') setSayLine(t.planner.say.missing(rules.query));
    else setSayLine(stopped ? t.planner.say.stoppedLocal : t.planner.say.discardedLocal);
  }

  /** „Verwerfen“: the text stays; a discarded model reading is not asked again for the same sentence. */
  function discard() {
    if (pending?.fromField && pending.local)
      fallBackToRules(pending.local.sentence, pending.local.rules, false);
    setPending(undefined);
    addRef.current?.querySelector('input')?.focus({ preventScroll: true });
  }

  // Escape while the model reads, wherever the focus is (the submit button is disabled meanwhile, so
  // a mouse user's focus may be nowhere): stop waiting, the sentence stays in the field.
  useEffect(() => {
    if (!reading) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      readingRef.current?.abort();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [reading]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || reading) return;
    setPending(undefined);
    setAsk(undefined);
    setSayLine(undefined);
    // Instructions first – German only, like the quick-capture parser; elsewhere the ⋯ actions do the same.
    if (getLang() === 'de') {
      // While the board loads the sentence still reads its days; things are matched once it is there.
      // Stage 0 first; the local model only for what the rules could not read (desktop with a model, AI on).
      const skipModel = declinedRef.current === value;
      declinedRef.current = undefined;
      const abort = new AbortController();
      readingRef.current = abort;
      // Only an Escape while the model was really asked counts as a stop (never a word about a model elsewhere).
      let asked = false;
      let said: Said;
      try {
        setReading(true);
        said = await readSentence(
          value,
          {
            today: data?.today ?? today(),
            items: board ? instructionItems(board) : [],
            lines: board ? planLines(board) : [],
          },
          {
            signal: abort.signal,
            model: !skipModel,
            onModel: () => {
              asked = true;
              setSayLine(t.planner.say.reading);
            },
          },
        );
      } finally {
        setReading(false);
        setSayLine(undefined);
        if (readingRef.current === abort) readingRef.current = undefined;
      }
      // The user pressed Escape (or the page went) while the model read: nothing happens, the sentence
      // stays, the rules' line says what is next. (`said` is then the rules' reading, never ops/ask: those
      // return before any wait.)
      if (abort.signal.aborted && asked) {
        if (addRef.current) {
          fallBackToRules(value, said.stage === 1 ? said.rules : said, true);
          addRef.current.querySelector('input')?.focus({ preventScroll: true });
        }
        return;
      }
      if (said.kind === 'ops') {
        // The sentence stays in the field until „Übernehmen“: „Verwerfen“ keeps what was typed.
        await showPreview(
          said.ops,
          true,
          said.stage === 1 ? { sentence: value, rules: said.rules } : undefined,
        );
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
  // U13: the detail line names the next step – today's first thing, or the next day with free time.
  const nextFree = board?.days.slice(1).find((d) => !d.off && d.free > 0);
  const headDetail = !todayDay
    ? undefined
    : !todayDay.off && todayDay.rows[0]
      ? t.planner.head.first(todayDay.rows[0].title)
      : !todayDay.off && todayDay.usable > 0 && nextFree
        ? t.planner.head.nextFree(dayName(nextFree.date), compact(nextFree.free))
        : `${t.planner.head.context(board!.todayCount, compact(todayDay.planned))} · ${t.planner.head.week(formatDay(todayDay.date, 'II'))}`;

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
    // A deadline the source holds (invoice, cancellation) is not the planner's to lift or set.
    const sourceHard = e.due?.hard === true;
    const excluded = row.item?.excluded === true;
    const open = why === row.unitId;
    return [
      ...(canDone(e.moduleId)
        ? [{ id: 'done', label: t.planner.row.done, onSelect: () => void markDone(e, titles) }]
        : []),
      ...(canAssign(e.moduleId)
        ? [{ id: 'later', label: t.planner.row.later, onSelect: () => void later(e, titles) }]
        : []),
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
      ...(sourceHard
        ? []
        : [
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
          ]),
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
      // Back to the note it came from (a note's „In den Plan“; the notes page reads `?open=`).
      ...(e.link?.kind === 'note'
        ? [
            {
              id: 'link',
              label: t.planner.row.openNote,
              onSelect: () => void navigate(`/notes?open=${encodeURIComponent(e.link!.id)}`),
            },
          ]
        : []),
      // Back to the mail it came from („In den Plan“ from the mail list; the mail page reads `?open=`).
      // Only where the mail module is there and on (desktop): elsewhere the ToDo's note holds the web link.
      ...(e.link?.kind === 'mail' && mailOn
        ? [
            {
              id: 'mail',
              label: t.planner.row.openMail,
              onSelect: () => void navigate(`/mail?open=${encodeURIComponent(e.link!.id)}`),
            },
          ]
        : []),
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
        // The minutes lead the meta line, the deadline follows, the reason only while „Warum hier?“ is on.
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
            {row.entry?.detail ? <span>{` · ${row.entry.detail}`}</span> : null}
            {open ? <span className={styles.reason}>{reason}</span> : null}
          </span>
        }
        lead={
          row.entry && canDone(row.entry.moduleId) ? (
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
        onSwipeRight={
          row.entry && canDone(row.entry.moduleId)
            ? () => void markDone(row.entry!, titles)
            : undefined
        }
        swipeRightLabel={t.planner.row.done}
        onSwipeLeft={
          row.entry && canAssign(row.entry.moduleId)
            ? () => void later(row.entry!, titles)
            : undefined
        }
        swipeLeftLabel={t.planner.row.later}
      />
    );
  };

  /** A day's name; today says so in words (the head's „frei heute“ belongs to that row). */
  const dayTitle = (day: BoardDay) =>
    day.isToday
      ? t.planner.board.todayIs(formatDay(day.date, 'EEE d.'))
      : formatDay(day.date, 'EEE d.');

  const renderDay = (day: BoardDay) => (
    <section
      key={day.date}
      className={styles.column}
      data-panel={wide || undefined}
      data-today={day.isToday}
      data-off={day.off}
      data-testid={`day-${day.date}`}
      aria-label={formatDay(day.date, 'EEEE, d. MMMM')}
    >
      <button type="button" className={styles.dayButton} onClick={() => setSheetDate(day.date)}>
        <span className={styles.dayName}>{dayTitle(day)}</span>
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
  const overflow = data?.last?.today === data?.today ? (data?.last?.overflowMin ?? 0) : 0;
  const nothingPlanned = board !== undefined && board.days.every((d) => d.rows.length === 0);
  const shownDay = board?.days.find((d) => d.date === pickedDay) ?? board?.days[0];

  // What waits for free time lies under the week; the entry row is the page's last row (rule 4: one entry, and for
  // the planner it is the field you type or speak into).
  const waitingBlock =
    waiting.length > 0 ? (
      <div className={styles.waiting}>
        <GroupedList
          listId="planner"
          groups={[
            {
              // Folded by default (Q4 a); a new id, so an old „closed“ choice is not read as „open“.
              id: 'wait',
              defaultClosed: true,
              label: t.planner.wait.title,
              count: waiting.length,
              detail: t.planner.wait.calm,
              // The overload figure once the group is open: neutral text, no tone (CONCEPT §7).
              ...(overflow > 0
                ? {
                    action: (
                      <p className={styles.reason} data-testid="planner-overload">
                        {overloadText(overflow)}
                      </p>
                    ),
                  }
                : {}),
              children: (
                <ItemList>
                  {waiting.map((w) => {
                    const reason =
                      w.reason === 'excluded'
                        ? t.planner.row.excludedState
                        : explainWait({ reason: w.reason, bumpedBy: w.bumpedBy }, nameOf);
                    return (
                      <ItemRow
                        key={w.unitId}
                        title={
                          <span>
                            {w.title}
                            {w.of > 1 ? <Part k={w.k} of={w.of} /> : null}
                          </span>
                        }
                        titleFull
                        // The reason only behind „Warum hier?“, like on the board (U12).
                        // A row without a menu (no entry) keeps its reason in sight.
                        meta={why === w.unitId || !w.entry ? reason : undefined}
                        end={<span className={styles.minutes}>{compact(w.minutes)}</span>}
                        menu={rowMenu(w, undefined, reason)}
                        menuLabel={t.planner.row.menu(w.title)}
                      />
                    );
                  })}
                </ItemList>
              ),
            },
          ]}
        />
      </div>
    ) : null;
  const entryRow = (
    <>
      <form
        ref={addRef}
        onSubmit={add}
        className={styles.add}
        data-keep-visible
        aria-busy={reading || undefined}
      >
        <div className={styles.grow}>
          {/* S09 (UI round 6): the hint sits under the whole row, not inside the field, so „Eintragen“ and ⋯ line up
              with the input instead of with the hint's baseline. The prop replaces TextField's own description: an
              `error` here would have to be appended to `hintId`. */}
          <TextField
            label={t.planner.add.label}
            placeholder={t.planner.add.placeholder}
            aria-describedby={hintId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={reading}
          />
        </div>
        <Button type="submit" variant="primary" disabled={!text.trim() || reading}>
          {t.planner.add.submit}
        </Button>
        {/* N04: the page's ⋯ sits beside the field (a toolbar row with only ⋯ left ~100 px empty above it). */}
        <RowMenu
          label={t.planner.head.menu}
          items={pageMenu}
          open={menuOpen}
          onOpenChange={setMenuOpen}
        />
      </form>
      <p id={hintId} className={styles.addHint}>
        {t.planner.add.hint}
      </p>
      {/* What the planner understood, or asks back, lies right under the field it answers. */}
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
          onDiscard={discard}
        />
      ) : null}
    </>
  );

  return (
    <>
      <PageHeader title={t.planner.title} />
      {/* U01: the figure has no caps label, the frame's placeholder for a `kennzahl` head has one. Until the board is
          read the page holds the row itself, in the figure's own shape, so the entry row below never moves. */}
      <HeroSlot area="figure">
        {todayDay ? (
          <HeroFigure value={headValue} detail={headDetail} type="thin" testId="planner-head" />
        ) : (
          <div className={styles.headPending} aria-hidden="true" data-testid="planner-head-pending">
            <HeroFigure value={'\u00a0'} detail={'\u00a0'} type="thin" />
          </div>
        )}
      </HeroSlot>

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

      {nothingPlanned && waiting.length === 0 ? (
        <EmptyState
          title={t.planner.empty}
          testId="planner-empty"
          motif={<SignatureMark id="weekBars" size={64} />}
        />
      ) : null}

      {/* The entry row is the last row under the week, so it comes with the board: it is built once, at its place,
          and never moves or is built anew under the typing hand (U01). */}
      {board ? (
        <SplitView
          enabled={wide && shownDay !== undefined}
          asideLabel={t.planner.board.dayPanel}
          aside={shownDay ? renderDay(shownDay) : null}
        >
          {wide ? (
            // The week as a list: one row per day with what is free and how full it is; the picked day is marked.
            <div className={styles.week}>
              <ItemList label={t.planner.board.label}>
                {board.days.map((d) => (
                  <ItemRow
                    key={d.date}
                    current={d.date === shownDay?.date}
                    onOpen={() => setPickedDay(d.date)}
                    title={<span data-testid={`week-${d.date}`}>{dayTitle(d)}</span>}
                    meta={capacityLabel(d)}
                    end={
                      !d.off ? (
                        <span className={styles.weekBar} aria-hidden="true">
                          <Progress
                            value={d.planned}
                            max={Math.max(d.usable, 1)}
                            label={t.planner.board.load(compact(d.planned), compact(d.usable))}
                          />
                        </span>
                      ) : undefined
                    }
                  />
                ))}
              </ItemList>
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
          )}
          {waitingBlock}
          {entryRow}
        </SplitView>
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
