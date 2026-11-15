import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getMeta, setMeta } from '@/core/db/metaKv';
import { getLang } from '@/core/i18n/lang';
import { explainAssignment, explainWait } from '@/core/plan/explain';
import {
  isRestSentence,
  restToTomorrow,
  type Instruction,
  type PlanOp,
} from '@/core/plan/instructions';
import { useNow } from '@/core/focus/useNow';
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
  PHONE_QUERY,
  RowMenu,
  type RowMenuItem,
  SplitView,
  useMediaQuery,
  useSplitView,
} from '@/ui';
import { useHeroTargets } from '@/core/shell/heroContext';
import { usePageAction } from '@/core/shell/pageAction';
import { HeroFigure, HeroSlot, SignatureMark } from '@/ui/identity';
import { addFromField, applyOps, later, markDone } from '../actions';
import type { BoardDay, BoardRow } from '../board';
import { Capture } from '../components/Capture';
import { CaptureDialog } from '../components/CaptureDialog';
import { useAbilities, useRowMenu } from '../components/rowMenu';
import { Part, ThingRow } from '../components/ThingRow';
import { compact } from '../components/capacity';
import { appointmentsOf, Context } from '../components/Context';
import { DayPage, DayPageLoading } from '../components/DayPage';
import { tileName, WeekBand } from '../components/WeekBand';
import { firstDayWithRows, plannerHead } from '../head';
import { DaySetup } from '../components/DaySetup';
import { DaySheet } from '../components/DaySheet';
import { RowChoice, type RowChoiceState } from '../components/RowChoice';
import { SETUP_DAYS } from '../daySetup';
import { duesOf, eveningLine } from '../rest';
import { dayEndOf } from '../settings';
import { PlanPreview, type PreviewData } from '../components/PlanPreview';
import { WeekCheck } from '../components/WeekCheck';
import { BOARD_DAYS } from '../calendar';
import { overloadText } from '../overload';
import { readSentence, warmLocalStage, type Said } from '../localStage';
import { instructionItems, opLines, planLines } from '../say';
import { PlannerOffError, previewUser } from '../services';
import { useBoard } from '../useBoard';
import { useUiStore } from '@/stores/ui';
import styles from './planner.module.css';

/** Days on the board: a rolling week from today (the widget starts there too). */
const SPAN = BOARD_DAYS;

/** Device-local (`_meta`): the Monday of the week whose „Woche prüfen“ line was clicked away. */
export const WEEK_CHECK_KEY = 'planner.weekCheck.dismissed';

/** Device-local (`_meta`): the day the sheet shows, `{ date, on }` – read only on the calendar day `on` it was picked. */
export const DAY_KEY = 'planner.hub.day';
/** Device-local (`_meta`): „Danach“ open or folded, per form of the page (desktop / phone). */
export const THEN_WIDE_KEY = 'planner.hub.then.wide';
export const THEN_NARROW_KEY = 'planner.hub.then.narrow';

/** A sentence waiting for „Übernehmen“: its ops and what the engine would do with them. */
interface Pending {
  ops: PlanOp[];
  lead: string;
  data: PreviewData;
  /** Said in the field (its text goes on „Übernehmen“), not chosen in ⋯. */
  fromField: boolean;
  /** The model's reading of this sentence; `rules` = what the rules made of it (stands on „Verwerfen“). */
  local?: { sentence: string; rules: Instruction };
  /** „Rest verteilen“: one calm sentence above the moves and in the toast, never a count of what was left. */
  rest?: boolean;
}

export default function PlannerPage() {
  const data = useBoard(SPAN);
  // Planner hub R1 (layout `split`): field, week band and the picked day's sheet in the main column; on a wide page
  // the context column (appointments, what waits) lies beside them, below that width it follows the sheet.
  const wide = useSplitView();
  const phone = useMediaQuery(PHONE_QUERY);
  const inFrame = !!useHeroTargets();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState('');
  const [sheetDate, setSheetDate] = useState<string | undefined>();
  // `?check=1` (the lists' „Woche prüfen im Planer“ link, a tap of the user) opens the week sheet.
  const [checking, setChecking] = useState(() => params.get('check') === '1');
  // `?start=1` (the welcome card's „Tage einteilen“, a tap of the user) opens the three-step sheet.
  const [settingUp, setSettingUp] = useState(() => params.get('start') === '1');
  const [menuOpen, setMenuOpen] = useState(false);
  // Phone: the plus of the bottom bar („Ding“) opens the field as a sheet; `?new=1` (quick add, a tap of the
  // user) opens it too.
  const [capturing, setCapturing] = useState(false);
  // Adjusting state during render: `?new=1` opens the sheet on the phone, also when the page is already there
  // (the effect below then takes the parameter away).
  if (phone && params.get('new') === '1' && !capturing) setCapturing(true);
  usePageAction({ short: t.planner.add.short, onClick: () => setCapturing(true) }, phone);
  // The entry was not stored (the planner was switched off meanwhile): the field says so, the text is still there.
  const [addError, setAddError] = useState(false);
  // The day the sheet shows once the user (or `?day=`, the calendar's plan chip) picked one.
  const [pickedDay, setPickedDay] = useState<string | undefined>(
    () => params.get('day') ?? undefined,
  );
  const storedPick = useLiveQuery(
    async () => (await getMeta<{ date: string; on: string }>(DAY_KEY)) ?? null,
    [],
  );
  const thenStored = useLiveQuery(
    async () => (await getMeta<boolean>(phone ? THEN_NARROW_KEY : THEN_WIDE_KEY)) ?? null,
    [phone],
  );
  // What changed, for screen readers (the picked day and its capacity, a ticked thing).
  // `n` changes with every announcement, so the same sentence said twice is a new node and is read again.
  const [status, setStatusState] = useState({ text: '', n: 0 });
  const setStatus = (text: string) => setStatusState((cur) => ({ text, n: cur.n + 1 }));
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
  // What the planner answers under the field is brought into view.
  const answerRef = useRef<HTMLDivElement>(null);
  const [focus] = useFocusSettings();
  const dismissedWeek = useLiveQuery(
    async () => (await getMeta<string>(WEEK_CHECK_KEY)) ?? null,
    [],
  );

  // The open choice behind „Als Pause …“ / „Dauer …“ of a row.
  const [choice, setChoice] = useState<RowChoiceState>();
  const abilities = useAbilities();
  const { canDone, canAssign } = abilities;

  const answered = !!pending || !!ask || !!sayLine;
  useEffect(() => {
    if (answered) answerRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [answered]);

  const titles = data?.titles ?? {};
  const board = data?.board;
  const todayDay = board?.days[0];

  // The local stage reads the shell's status once (the desktop app with AI on; nowhere else).
  useEffect(() => {
    void warmLocalStage();
    return () => readingRef.current?.abort();
  }, []);

  // Arrival on a desktop with a keyboard: the field has the focus, so typing is the first thing that works. Never
  // on the phone or a touch screen (no keyboard sliding in), never over a sheet that opens with the page.
  useEffect(() => {
    const keyboard = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true;
    if (!keyboard || window.matchMedia(PHONE_QUERY).matches) return;
    const query = new URLSearchParams(window.location.search);
    if (query.get('check') || query.get('start')) return;
    addRef.current?.querySelector('input')?.focus({ preventScroll: true });
  }, []);

  /** „Rest verteilen“: the ops of `moveAll(today, tomorrow)` as a preview; nothing moves before „Übernehmen“. */
  function showRest() {
    if (!board) return;
    return previewRest(
      restToTomorrow({ today: data?.today ?? today(), items: instructionItems(board) }),
      false,
    );
  }

  /** The rest preview – unless only what is nailed to today (or nothing) is left: then one calm line, no preview. */
  function previewRest(ops: PlanOp[], fromField: boolean) {
    if (!ops.some((o) => o.op === 'earliest')) {
      setPending(undefined);
      setSayLine(t.planner.rest.nothing);
      return;
    }
    return showPreview(ops, fromField, undefined, true);
  }

  /** Shows what `ops` would do; nothing is stored until „Übernehmen“. `local` = the model read the sentence. */
  async function showPreview(
    ops: PlanOp[],
    fromField = false,
    local?: Pending['local'],
    rest = false,
  ) {
    setAsk(undefined);
    setSayLine(undefined);
    try {
      const out = await previewUser(ops);
      const titleOf = (key: string) => titles[key] ?? out.titles[key] ?? key;
      const lines = rest ? [t.planner.rest.line] : opLines(ops, titleOf, data?.today ?? today());
      setPending({
        ops,
        lead: rest ? t.planner.rest.done : (lines[0] ?? t.planner.ops.replan),
        ...(rest ? { rest: true } : {}),
        // A sentence the local model read says so above the lines: its reading is checked here, by the user.
        data: {
          lines,
          ...(local ? { note: t.planner.say.localRead } : {}),
          ...(rest ? { noCounts: true } : {}),
          dues: board ? duesOf(board) : {},
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

  // `?new=1` (quick add) focuses the one field; `?day=` (the calendar's plan chip) shows that day (read into
  // `pickedDay` above); `?week=` (the calendar's „Plan“ entry) lands on the page as it is.
  useEffect(() => {
    if (params.get('new')) {
      // Desktop: the field in the page. Phone: the sheet (opened above) focuses its own field when it opens.
      if (!phone) addRef.current?.querySelector('input')?.focus();
      setParams({}, { replace: true });
      return;
    }
    if (params.get('day')) {
      setParams({}, { replace: true });
    } else if (params.get('rest')) {
      // `?rest=1` (the widgets, „Tag abschließen“ over the bus): the preview of „Rest verteilen“, once the board is there.
      if (!board) return;
      setParams({}, { replace: true });
      void showRest();
    } else if (params.get('week') || params.get('check') || params.get('start'))
      setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `showRest` reads the board this effect waits for
  }, [params, setParams, board]);

  async function apply() {
    if (!pending) return;
    setBusy(true);
    try {
      await applyOps(pending.ops, pending.lead, titles, pending.rest === true);
      if (pending.fromField) setText('');
      setPending(undefined);
      // A sentence said in the phone's sheet changed the plan: the sheet gives the page back.
      if (pending.fromField) setCapturing(false);
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
    setAddError(false);
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
        // „Rest verteilen“ typed: the same preview (or calm line) as the evening link.
        if (said.stage !== 1 && isRestSentence(value)) {
          await previewRest(said.ops, true);
          return;
        }
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
    if (!ok) {
      setText((cur) => cur || value);
      setAddError(true);
    }
    // The next entry follows right away; no scroll jump while the board below re-renders.
    addRef.current?.querySelector('input')?.focus({ preventScroll: true });
  }

  // The head reports the next day that asks for something (CONCEPT-DESIGN §5): `head.ts`. With no thing on any
  // day there is no figure; the unseen placeholder keeps the head's height (U01).
  const head = board ? plannerHead(board.days, { short: phone }) : undefined;

  const pageMenu: RowMenuItem[] = [
    {
      id: 'replan',
      label: t.planner.head.replan,
      onSelect: () => void showPreview([{ op: 'replan', reshuffle: false }]),
    },
    { id: 'check', label: t.planner.check.title, onSelect: () => setChecking(true) },
    { id: 'days', label: t.planner.daySetup.open, onSelect: () => setSettingUp(true) },
  ];
  // The page's ⋯: in the head's title row on the desktop; on the phone (no action in the module head) beside the
  // sheet's day title.
  const pageMenuButton = (
    <RowMenu
      label={t.planner.head.menu}
      items={pageMenu}
      open={menuOpen}
      onOpenChange={setMenuOpen}
    />
  );

  // „Woche prüfen · 2 Schritte“: Mondays only, only with the switch on, until it is clicked away for this week.
  const monday = data ? addDaysStr(data.today, 1 - isoWeekday(data.today)) : undefined;
  const showWeekLink =
    focus.weekCheck &&
    data !== undefined &&
    isoWeekday(data.today) === 1 &&
    dismissedWeek !== undefined &&
    dismissedWeek !== monday;

  // „Bald ist Tagesende.“ under `focus.eveningWrapUp` (REVIEW-FABLE R11): from 30 min before the „Tagesende“, one
  // sentence in the head's notice slot, never in the figure (P75). „Rest verteilen“ stands at the sheet's foot at
  // any hour. Never a count. The clock is read once a minute.
  const clock = useNow(60_000, focus.eveningWrapUp);
  const evening = eveningLine(
    focus.eveningWrapUp,
    clock,
    data ? dayEndOf(data.settings) : undefined,
    todayDay,
  );
  const dayEndNotice =
    evening?.kind === 'dayEnd' ? (
      <p className={styles.notice} data-testid="day-end-line">
        {t.planner.rest.dayEnd}
      </p>
    ) : null;

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

  const rowMenu = useRowMenu({
    today: data?.today,
    titles,
    abilities,
    why,
    setWhy,
    setChoice,
  });

  /** The tick: one tap. The status line says it, the focus moves on to the next tick of the sheet. */
  async function done(row: BoardRow): Promise<boolean> {
    const ticks = [...document.querySelectorAll<HTMLElement>('[data-row-tick]')];
    const at = ticks.indexOf(document.activeElement as HTMLElement);
    const ok = await markDone(row.entry!, titles);
    if (!ok) return false;
    setStatus(t.planner.row.doneName(row.title));
    if (at >= 0) (ticks[at + 1] ?? ticks[at - 1])?.focus({ preventScroll: true });
    return true;
  }

  // „Frist So 18:00“ turns into „Frist war So 18:00“ once the hour has passed (package 5b); read once a minute.
  const dueClock = useNow(60_000);
  const renderRow = (row: BoardRow, day: BoardDay, next: boolean) => {
    const reason = explainAssignment(
      { reason: row.reason, bumpedBy: row.bumpedBy },
      {
        due: row.hardDue ?? row.entry?.due?.date,
        prevDate: row.entry?.plannedFor,
        part: row.item?.part,
        nameOf,
      },
    );
    const tick = !!row.entry && canDone(row.entry.moduleId);
    return (
      <ThingRow
        key={row.unitId}
        row={row}
        next={next}
        reason={reason}
        whyOpen={why === row.unitId}
        dueClock={dueClock}
        menu={rowMenu(row, day.date, reason, { tick })}
        onDone={tick ? () => done(row) : undefined}
        onLater={
          row.entry && canAssign(row.entry.moduleId)
            ? () => void later(row.entry!, titles)
            : undefined
        }
      />
    );
  };

  const waiting = board?.waiting ?? [];
  const overflow = data?.last?.today === data?.today ? (data?.last?.overflowMin ?? 0) : 0;
  const nothingPlanned = board !== undefined && board.days.every((d) => d.rows.length === 0);
  const boardEmpty = nothingPlanned && waiting.length === 0;

  // The day the sheet shows: `?day=` or a tile → the pick stored today on this device → the first day that holds
  // things → today. Once shown it stays (a day does not change under the hand when its last thing is ticked).
  const days = board?.days;
  const storedDate = storedPick && storedPick.on === data?.today ? storedPick.date : undefined;
  const shownDay =
    !days || storedPick === undefined || thenStored === undefined
      ? undefined
      : (days.find((d) => d.date === pickedDay) ??
        days.find((d) => d.date === storedDate) ??
        firstDayWithRows(days) ??
        days[0]);
  const shownDate = shownDay?.date;
  // Adjusting state during render: the day the page opened on becomes the pick – once the plan holds things (the
  // board of a fresh page fills a moment after its days are there; an empty board keeps following).
  if (shownDate && pickedDay === undefined && (storedDate || !nothingPlanned))
    setPickedDay(shownDate);

  /** A tile (or a swipe) picks the day: stored for today on this device, said in the status line. */
  function pick(date: string) {
    const day = days?.find((d) => d.date === date);
    if (!day || !data) return;
    setPickedDay(date);
    void setMeta(DAY_KEY, { date, on: data.today });
    setStatus(tileName(day, days?.[1]?.date === date));
  }

  // „Danach“ is folded on the phone and open on the desktop until the user says otherwise (device-local).
  const thenOpen = thenStored ?? !phone;

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

  // What the planner understood, or asks back: right under the field it answers (on the phone, where the page has
  // no field, above the week).
  const answer = (
    <div ref={answerRef}>
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
    </div>
  );

  // The one field: in the page on the desktop, in the plus's sheet on the phone.
  const capture = (inDialog: boolean) => (
    <Capture
      value={text}
      onChange={(value) => {
        setText(value);
        setAddError(false);
      }}
      onSubmit={add}
      reading={reading}
      error={addError}
      focusOnOpen={inDialog}
      labelHidden={inDialog}
      // The phone's last row is the field alone; its examples stand in the plus's sheet.
      examples={inDialog || !phone}
      formRef={addRef}
    />
  );

  // What the sheet says while its day holds nothing: the one empty state of a board without things, else a line.
  const firstFull = days ? firstDayWithRows(days) : undefined;
  const emptySheet = boardEmpty ? (
    <EmptyState
      title={t.planner.empty}
      testId="planner-empty"
      motif={<SignatureMark id="weekBars" size={64} />}
    >
      <p className={styles.emptyNext}>{phone ? t.planner.emptyNextPhone : t.planner.emptyNext}</p>
      {/* Its one action (TARGET F1): the three-step sheet. Secondary: „Eintragen“ stays the page's one filled button. */}
      <Button onClick={() => setSettingUp(true)} data-testid="planner-days-setup">
        {t.planner.daySetup.open}
      </Button>
    </EmptyState>
  ) : (
    <p className={styles.emptyDay} data-testid="planner-empty-day">
      {shownDay?.isToday && firstFull
        ? t.planner.sheet.dayOffNext(formatDay(firstFull.date, 'EEEE'))
        : t.planner.sheet.emptyDay}
    </p>
  );

  const context = days ? <Context days={days}>{waitingBlock}</Context> : null;
  const hasContext = !!days && (waiting.length > 0 || appointmentsOf(days).length > 0);

  return (
    <>
      <PageHeader title={t.planner.title}>{phone ? null : pageMenuButton}</PageHeader>
      {/* U01: the figure has no caps label, the frame's placeholder for a `kennzahl` head has one. Until the board is
          read – and while no day holds a thing – the page holds the row itself, in the figure's own shape, unseen, so
          the head keeps its height. */}
      <HeroSlot area="figure">
        {head ? (
          <HeroFigure value={head.value} detail={head.detail} type="sans" testId="planner-head" />
        ) : (
          <div className={styles.headPending} aria-hidden="true" data-testid="planner-head-pending">
            <HeroFigure value={' '} detail={' '} type="sans" />
          </div>
        )}
      </HeroSlot>
      {/* Outside the app frame (tests, a dialog) there is no notice slot: the sentence then stands in the page. */}
      {dayEndNotice ? (
        inFrame ? (
          <HeroSlot area="notice">{dayEndNotice}</HeroSlot>
        ) : (
          dayEndNotice
        )
      ) : null}

      {/* Day and plan changes for screen readers: the picked day with its capacity, a ticked thing. */}
      <p className="sr-only" role="status" data-testid="planner-status">
        <span key={status.n}>{status.text}</span>
      </p>

      <SplitView enabled={wide && hasContext} asideLabel={t.planner.ctx.label} aside={context}>
        {/* Wide and nothing beside it (no appointment, nothing waits): the main column keeps the width it has
            beside the context column, left-aligned with the head's title – rows do not stretch over the page. */}
        <div className={wide && !hasContext ? `${styles.main} ${styles.mainAlone}` : styles.main}>
          {/* Reading order = DOM order: field → band → sheet → context. The field is there from the first paint
              and never moves under the typing hand (U01). */}
          {phone ? null : capture(false)}
          {phone ? null : answer}

          {showWeekLink ? (
            <p className={styles.weekLink} data-testid="week-check-link">
              <button type="button" className={styles.textLink} onClick={() => setChecking(true)}>
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

          {days ? (
            <WeekBand days={days} picked={shownDate} onPick={pick} />
          ) : (
            <div className={styles.bandPending} aria-hidden="true" />
          )}

          {shownDay && days ? (
            <DayPage
              key={shownDay.date}
              day={shownDay}
              tomorrow={days[1]?.date === shownDay.date}
              renderRow={(row, next) => renderRow(row, shownDay, next)}
              onEditDay={() => setSheetDate(shownDay.date)}
              thenOpen={thenOpen}
              onThenToggle={(open) => void setMeta(phone ? THEN_NARROW_KEY : THEN_WIDE_KEY, open)}
              empty={emptySheet}
              onRest={shownDay.isToday ? () => void showRest() : undefined}
              // On the phone the page's ⋯ stands in the sheet's head and holds „Tage einteilen“: said once.
              onSetup={phone ? undefined : () => setSettingUp(true)}
              headEnd={phone ? pageMenuButton : undefined}
              onSwipe={
                phone
                  ? (dir) => {
                      const at = days.findIndex((d) => d.date === shownDay.date);
                      const to = days[at + dir];
                      if (to) pick(to.date);
                    }
                  : undefined
              }
            />
          ) : (
            <DayPageLoading />
          )}

          {/* Not wide: the context follows the sheet in the one column. */}
          {!wide && hasContext ? <aside aria-label={t.planner.ctx.label}>{context}</aside> : null}

          {/* Phone: the first screen is band and sheet; the plus of the bottom bar opens the field as a sheet.
              The field also stays where it was before R1, as the page's last row: without it every entry on
              the phone costs one tap and one sheet more than before (e2e/usecases, paths B and E). */}
          {phone && !capturing ? capture(false) : null}
          {phone && !capturing ? answer : null}
        </div>
      </SplitView>

      {phone ? (
        <CaptureDialog open={capturing} onClose={() => setCapturing(false)}>
          {capture(true)}
          {answer}
        </CaptureDialog>
      ) : null}
      <RowChoice choice={choice} titles={titles} onClose={() => setChoice(undefined)} />
      <DaySheet
        day={board?.days.find((d) => d.date === sheetDate)}
        titles={titles}
        onClose={() => setSheetDate(undefined)}
      />
      {settingUp && board ? (
        <DaySetup
          days={board.days.slice(0, SETUP_DAYS)}
          titles={titles}
          dayEnd={data?.settings.dayEnd}
          onClose={() => setSettingUp(false)}
        />
      ) : null}
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
