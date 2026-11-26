import { getISOWeek } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getMeta, setMeta } from '@/core/db/metaKv';
import { getLang } from '@/core/i18n/lang';
import { useModuleStates } from '@/core/modules/activation';
import { knownShoppingNames } from '@/quickCapture/targets/lookup';
import { dayName, explainAssignment, explainWait } from '@/core/plan/explain';
import {
  isRestSentence,
  restToTomorrow,
  withoutFixedMoves,
  type Instruction,
  type PlanOp,
} from '@/core/plan/instructions';
import { useNow } from '@/core/focus/useNow';
import { useFocusSettings } from '@/core/settings/focus';
import { addDaysStr, formatDay, isoWeekday } from '@/core/time/dates';
import { now as nowMs, today } from '@/core/time/now';
import { t } from '@/strings';
import {
  Button,
  SelectionBar,
  EmptyState,
  Icon,
  IconButton,
  Segmented,
  GroupedList,
  ItemList,
  PageHeader,
  Tabs,
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
import {
  addFromField,
  addKindFromField,
  allToday,
  applyOps,
  exclude,
  layHere,
  moveTo,
  later,
  markDone,
  setLocked,
  spreadDay,
  spreadOpen,
  takeOff,
  bringBack,
  setGoal,
  setStartPoint,
  START_KEY,
  type StartPoints,
} from '../actions';
import { beginPlanFocus, planFocusPath } from '../focus';
import { useLater } from '../useLater';
import { readKeepSentence } from '../keepSentence';
import type { PlannableEntry } from '@/core/modules/contributions';
import type { BoardDay, BoardRow, OpenRow } from '../board';
import { Capture } from '../components/Capture';
import { CaptureDialog } from '../components/CaptureDialog';
import { useAbilities, useRowMenu } from '../components/rowMenu';
import { type RowExpand, ThingRow, TodoHintRow, WaitRow } from '../components/ThingRow';
import { compartmentId, useOpenRow } from '../components/RowCompartment';
import { PlanPageFoot } from '@/core/modules/PlanPanelHost';
import { MeasureShown } from '../components/measureShown';
import { PileContext } from '../components/pileContext';
import { PileOffer } from '../components/PileOffer';
import { hasOpenSteps, STEPS_FRESH, stepsPath } from '../components/steps';
import { appointmentsOf, Context, nextDeadlinesOf } from '../components/Context';
import { DayPage, DayPageLoading } from '../components/DayPage';
import { LateGroup, LateRow } from '../components/LateGroup';
import { PassedTrainings } from '../components/PassedTrainings';
import { tileName, WeekBand } from '../components/WeekBand';
import { WeekGrid } from '../components/WeekGrid';
import { DragGhost } from '../components/DragGhost';
import { useDragMove, type DragRow } from '../components/dragMove';
import { firstDayWithRows, plannerHead } from '../head';
import { DaySetup } from '../components/DaySetup';
import { DaySheet } from '../components/DaySheet';
import { PasteDialog } from '../components/PasteDialog';
import { copyInput } from '../copyPlan';
import { looksLikePlan, planAsText } from '../pastePlan';
import { RowChoice, type RowChoiceState } from '../components/RowChoice';
import { SETUP_DAYS } from '../daySetup';
import { duesOf, eveningLine } from '../rest';
import { openLineText, openTabName } from '../openLine';
import { dayEndLabel, dayEndOf } from '../settings';
import { noDayOf, PlanPreview, type PreviewData } from '../components/PlanPreview';
import { WeekCheck } from '../components/WeekCheck';
import { BOARD_DAYS } from '../calendar';
import { overloadText } from '../overload';
import { readSentence, warmLocalStage, type Said } from '../localStage';
import { fieldKind } from '../fieldKind';
import { instructionItems, opLines, planLines, restIsEmpty } from '../say';
import { PlannerOffError, previewUser, proposeUser } from '../services';
import { useBoard } from '../useBoard';
import { useUiStore } from '@/stores/ui';
import { getPlatform } from '@/core/platform';
import styles from './planner.module.css';

/** A thing open this many days gets the quiet offer „Vom Tag nehmen“ (CONCEPT §3). */
const TAKE_OFF_AFTER = 14;

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
  /**
   * „Rest verteilen“ of one overbooked day (its things that are not „fest“, nothing before that day), or – `open` –
   * „Verteilen …“ of the tab „Noch offen“ (its things that are not „fest“, today first).
   */
  spread?: { date: string; loose: string[]; fixed: number; open?: true };
}

/** „4 Wochen“ (package 4): the grid's days, four weeks from a Monday. */
const GRID_DAYS = 28;
/** The board always reads four weeks from today (the move dialog's days, a later week's sheet). */
const READ_DAYS = 28;

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const mondayOf = (date: string) => addDaysStr(date, 1 - isoWeekday(date));
/** The ISO week of a date („KW 47“). */
const isoWeekOf = (date: string) => getISOWeek(new Date(`${date}T12:00:00`));

export default function PlannerPage() {
  const [searchParams] = useSearchParams();
  const now = today();
  // The band's week (direction A): Monday to Sunday – this week (its passed days say „offen“), or a later one paged
  // to (`?week=` from the calendar's „Plan“, the week of `?day=`, a calendar chip of a later week).
  // On the weekend the band starts with today (the eve of the coming week: five or six passed days would leave one
  // or two ahead) – Saturday or Sunday to the coming Friday or Saturday.
  const thisWeek = isoWeekday(now) >= 6 ? now : mondayOf(now);
  /** The band's week that holds `date`: weeks counted from this week's first day. */
  const weekOf = (date: string) =>
    addDaysStr(thisWeek, Math.floor(daysBetween(thisWeek, date) / SPAN) * SPAN);
  const [weekStart, setWeekStart] = useState<string>(() => {
    const iso = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v > now ? v : null);
    const asked = iso(searchParams.get('week')) ?? iso(searchParams.get('day'));
    return asked ? weekOf(asked) : thisWeek;
  });
  const [grid, setGrid] = useState(false);
  // A new week (the page stayed open over Sunday night) never leaves the band on a passed week.
  const start = weekStart < thisWeek ? thisWeek : weekStart;
  const viewFrom = grid ? mondayOf(start) : start;
  const viewSpan = grid ? GRID_DAYS : SPAN;
  const viewEnd = addDaysStr(viewFrom, viewSpan - 1);
  const data = useBoard(
    Math.max(READ_DAYS, daysBetween(now, viewEnd) + 1),
    viewFrom === now && !grid ? undefined : { from: viewFrom, span: viewSpan },
    { offer: true },
  );
  // Collective rows (package 2): what a pile row draws, from the same reading as the board.
  const pileData = useMemo(
    () =>
      data
        ? {
            piles: data.piles,
            entries: data.entries,
            today: data.today,
            lateKeys: new Set(data.board.lateFolded.map((r) => r.itemKey)),
          }
        : undefined,
    [data],
  );
  // Planner hub R1 (layout `split`): field, week band and the picked day's sheet in the main column; on a wide page
  // the context column (appointments, what waits) lies beside them, below that width it follows the sheet.
  const wide = useSplitView();
  const phone = useMediaQuery(PHONE_QUERY);
  const inFrame = !!useHeroTargets();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState('');
  // Kinds in the field (package 3): the sure reading of the line, derived – never stored. Off with K5, in English, and
  // for the entry K3 made a plain ToDo.
  const states = useModuleStates();

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
  const lookFor = useRef(params.get('item') ?? undefined);
  const lookSince = useRef<number | undefined>(undefined);
  const holdFocus = useRef<{ key: string; until: number } | undefined>(undefined);
  // `?item=` of a row in the folded „Danach“ of the shown day (the phone folds it): open for this visit, his own
  // toggle ends it (package 10b).
  const [revealThen, setRevealThen] = useState(() => params.get('item') ?? undefined);
  const storedPick = useLiveQuery(
    async () => (await getMeta<{ date: string; on: string }>(DAY_KEY)) ?? null,
    [],
  );
  // „Nur das hier“ (use case „Tag kippt“): the day's starting point, and the things kept for „Nächste Wochen“.
  const startPoints = useLiveQuery(async () => (await getMeta<StartPoints>(START_KEY)) ?? null, []);
  const laterList = useLater();
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
  // „Plan einfügen“ (use case „Tag kippt“): the text the preview starts with ('' from ⋯), undefined while closed.
  const [pasting, setPasting] = useState<string>();
  // „Auswählen“ in the tab „Noch offen“ (package 3): the chosen rows, one day for all of them.
  const [selecting, setSelecting] = useState(false);
  // „Auswählen“ on the day sheet (package 5, the page's ⋯): its chosen rows, one day for all of them.
  const [dayPicking, setDayPicking] = useState<string | undefined>();
  const [dayChosen, setDayChosen] = useState<Set<string>>(() => new Set());
  // „Nur das hier …“: the same selection on the day sheet, but the ticked rows are what stays.
  const [keeping, setKeeping] = useState(false);
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const abilities = useAbilities();
  const { canDone, canAssign, canLater } = abilities;

  const answered = !!pending || !!ask || !!sayLine;
  useEffect(() => {
    if (answered) answerRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [answered]);

  const titles = data?.titles ?? {};
  const board = data?.board;
  const [plainFor, setPlainFor] = useState<string | undefined>();
  const kindsOn = data?.settings.kindsInField !== false && getLang() === 'de';
  // Read only while a line can show: the switch on and German lines.
  const knownNames = useLiveQuery(
    () => (kindsOn ? knownShoppingNames() : Promise.resolve(new Set<string>())),
    [kindsOn],
  );
  const kindItems = useMemo(() => (board ? instructionItems(board) : undefined), [board]);
  const kindReading = useMemo(() => {
    const day = data?.today ?? today();
    if (!kindsOn || !states || text === plainFor) return undefined;
    return fieldKind(text, {
      now: new Date(nowMs()),
      today: day,
      until: addDaysStr(day, Number(data?.settings.horizonDays ?? 14) - 1),
      on: (id) => !!states[id],
      ...(knownNames ? { known: knownNames } : {}),
      ...(kindItems ? { items: kindItems } : {}),
    });
  }, [
    text,
    plainFor,
    kindsOn,
    states,
    knownNames,
    kindItems,
    data?.today,
    data?.settings.horizonDays,
  ]);
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

  /**
   * „Rest verteilen“ on the line „2 h 10 mehr als planbar“ of a day: the day's things that are not „fest“ (and not a
   * fixed block or a source's dated turn) go to the proposer, that day first, nothing before it – as a preview. The
   * fixed ones stay and are named („1 bleibt: fest“).
   */
  async function showSpread(day: BoardDay) {
    return previewSpread(day.rows, day.date, false);
  }

  /** „Verteilen …“ of the tab „Noch offen“: its things that are not „fest“, today first – as a preview. */
  function showSpreadOpen() {
    return previewSpread(data?.board.open ?? [], data?.today ?? today(), true);
  }

  async function previewSpread(rows: readonly BoardRow[], from: string, open: boolean) {
    const free = rows.filter(movable);
    const loose = [...new Set(free.map((r) => r.itemKey))];
    const fixed = new Set(rows.filter((r) => r.pinned).map((r) => r.itemKey)).size;
    setAsk(undefined);
    if (loose.length === 0) {
      setPending(undefined);
      setSayLine(t.planner.spread.fixed(fixed));
      return;
    }
    setSayLine(undefined);
    try {
      const out = await previewUser([], [], { loose, notBefore: from });
      setPending({
        ops: [],
        lead: t.planner.spread.done,
        spread: { date: from, loose, fixed, ...(open ? { open: true as const } : {}) },
        data: {
          lines: [
            open ? t.planner.open.spreadLine : t.planner.spread.line,
            ...(fixed > 0 ? [t.planner.spread.fixed(fixed)] : []),
          ],
          noCounts: true,
          dues: board ? duesOf(board) : {},
          diff: out.result.diff,
          ...(out.result.heldBack?.length
            ? { note: t.planner.toast.heldBack(out.result.heldBack.length) }
            : {}),
        },
        fromField: false,
      });
    } catch (e) {
      if (!(e instanceof PlannerOffError)) throw e;
      useUiStore.getState().toast(t.planner.toast.off);
    }
  }

  /** The rest preview – unless only what is nailed to today (or nothing) is left: then one calm line, no preview. */
  function previewRest(ops: PlanOp[], fromField: boolean) {
    if (restIsEmpty(ops)) {
      setPending(undefined);
      setSayLine(t.planner.rest.nothing);
      return;
    }
    return showPreview(ops, fromField, undefined, true);
  }

  /** Shows what `ops` would do; nothing is stored until „Übernehmen“. `local` = the model read the sentence. */
  async function showPreview(
    said: PlanOp[],
    fromField = false,
    local?: Pending['local'],
    rest = false,
  ) {
    setAsk(undefined);
    setSayLine(undefined);
    // A fixed block (S4) is never moved – whether a picked question or the local model asked for it.
    const { ops, held } = board
      ? withoutFixedMoves(said, instructionItems(board))
      : { ops: said, held: undefined };
    if (held !== undefined && ops.length === 0) {
      setPending(undefined);
      setSayLine(t.planner.say.fixed(held));
      return;
    }
    try {
      const out = await previewUser(ops);
      const titleOf = (key: string) => titles[key] ?? out.titles[key] ?? key;
      // „Woche vorschlagen“ (package 6): a proposal for the things without a day – its head says nothing moved yet.
      const proposal =
        ops.length > 0 && ops.every((o) => (o.op === 'replan' && !o.reshuffle) || o.op === 'split');
      const lines = rest
        ? [t.planner.rest.line]
        : proposal
          ? [
              t.planner.preview.head,
              ...opLines(
                ops.filter((o) => o.op === 'split'),
                titleOf,
                data?.today ?? today(),
              ),
            ]
          : opLines(ops, titleOf, data?.today ?? today());
      // What the proposal finds no day for; a thing too long for any day in one piece offers „In Teile aufteilen …“.
      const noDay = proposal ? noDayOf(out.result, titleOf) : [];
      setPending({
        ops,
        // The head of a proposal is for the preview only: after „Übernehmen“ the toast and the undo say what was done.
        lead: rest
          ? t.planner.rest.done
          : proposal
            ? t.planner.ops.replan
            : (lines[0] ?? t.planner.ops.replan),
        ...(rest ? { rest: true } : {}),
        // A sentence the local model read says so above the lines: its reading is checked here, by the user.
        data: {
          lines,
          ...(local ? { note: t.planner.say.localRead } : {}),
          ...(rest ? { noCounts: true } : {}),
          dues: board ? duesOf(board) : {},
          diff: out.result.diff,
          ...(noDay.length ? { noDay } : {}),
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
    else if (params.get('item')) {
      // `?tab=open&item=…` (a ToDo's „im Plan: war Mo“): the tab stays, the row was read once above.
      const next = new URLSearchParams(params);
      next.delete('item');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `showRest` reads the board this effect waits for
  }, [params, setParams, board]);

  async function apply() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.spread?.open)
        await spreadOpen(pending.spread.loose, pending.spread.fixed, titles);
      else if (pending.spread)
        await spreadDay(pending.spread.date, pending.spread.loose, pending.spread.fixed, titles);
      else await applyOps(pending.ops, pending.lead, titles, pending.rest === true);
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

  async function add(e: FormEvent | undefined, opts: { plain?: boolean } = {}) {
    e?.preventDefault();
    const value = text.trim();
    if (!value || reading) return;
    setAddError(false);
    setPending(undefined);
    setAsk(undefined);
    setSayLine(undefined);
    // „heute nur A, B und C“ (P4): opens „Nur das hier …“ on the shown day with those things ticked – nothing moves
    // before he picks where the rest goes. A name that fits no or several things: the field reads it as before.
    if (getLang() === 'de' && tab === 'plan' && shownDay) {
      const keep = readKeepSentence(value, shownDay.rows.filter(canMove));
      // „heute nur …“ belongs to today: on another day's sheet the field reads it as before.
      if (keep && (!keep.today || shownDay.date === (data?.today ?? today()))) {
        setDayChosen(new Set(keep.unitIds));
        setKeeping(true);
        setDayPicking(shownDay.date);
        setText('');
        setSayLine(t.planner.keep.fromSentence);
        return;
      }
    }
    // A sure kind (package 3): the line under the field says what Enter stores. The planner's own readings were
    // checked by `fieldKind` already; the local model never runs for a line with a kind.
    if (kindReading && !opts.plain) {
      setText('');
      setPlainFor(undefined);
      const ok = await addKindFromField(
        kindReading,
        titles,
        tab === 'open' ? undefined : shownDate,
      );
      if (!ok) {
        setText((cur) => cur || value);
        setAddError(true);
      }
      addRef.current?.querySelector('input')?.focus({ preventScroll: true });
      return;
    }
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
      if (said.kind === 'fixed') {
        setSayLine(t.planner.say.fixed(said.title));
        return;
      }
    }
    setText('');
    // On „Noch offen“ no day is on the sheet: the new thing lies on today (the toast names the day).
    const ok = await addFromField(value, titles, tab === 'open' ? undefined : shownDate);
    // K3 held for this entry only: the next one is read afresh.
    if (ok) setPlainFor(undefined);
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
  const head = board
    ? plannerHead(board.days.slice(0, SPAN), {
        short: phone,
        late: [...board.late, ...board.lateFolded],
      })
    : undefined;

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
    const shownWeek = (data?.view ?? board.days)
      .filter((d) => d.date >= (data?.today ?? now))
      .slice(0, SPAN);
    for (const r of [...shownWeek.flatMap((d) => d.rows), ...board.waiting]) {
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

  /**
   * The phone's stimulus budget (`e2e/usecases/kopf-leer.spec.ts` path D): the lock stands on a row that is „fest“ (it
   * replaces the word and „Nicht mehr fest“); an open row is locked from ⋯ there. Wider pages show it on every row.
   */
  const lockHidden = (row: BoardRow) => phone && !row.pinned;
  /**
   * What a day's „Rest verteilen“ may hand over: not „fest“, no fixed block, no dated turn of its source, and no part of
   * a thing in parts (its other parts lie on days the action does not name).
   */
  const movable = (r: BoardRow) => !r.pinned && !r.fixed && !r.derived && !!r.entry && r.of === 1;
  /** The lock on a row: one tap, one undo; a dated turn without a row gets its row on the day it shows on. */
  // A thing in parts (from the engine's time) is locked on all its days: no one-day toggle on its rows. A source's
  // dated turn needs none: no proposal moves it.
  const lockOf = (row: BoardRow, date: string) =>
    row.entry && !row.fixed && !row.derived && (row.of === 1 || row.pinned)
      ? {
          locked: row.pinned,
          onToggle: () =>
            void setLocked(row.entry!, !row.pinned, titles, row.derived ? date : undefined),
        }
      : undefined;

  // „Frist So 18:00“ turns into „Frist war So 18:00“ once the hour has passed (package 5b); read once a minute.
  const dueClock = useNow(60_000);
  // Package 5: the rows that can be dragged onto a day (or moved with `M`), filled while they render; the page's
  // column listens once. A drop is the same move as „Verschieben …“: that thing on that day, nothing else.
  const movers = new Map<string, DragRow>();
  /** All minutes of a thing on the board's days (a thing in parts moves whole). */
  const wholeMinutes = (itemKey: string) =>
    (board?.days ?? [])
      .flatMap((d) => d.rows)
      .filter((r) => r.itemKey === itemKey)
      .reduce((n, r) => n + r.minutes, 0);
  const mover = (
    row: {
      unitId: string;
      itemKey: string;
      title: string;
      minutes: number;
      entry?: PlannableEntry;
    },
    menu: readonly RowMenuItem[] | undefined,
    from?: string,
    drag = true,
  ) => {
    const e = row.entry;
    // As the menu: a row that offers „Verschieben …“ (or the open tab's move button) can be dragged.
    if (!e || (menu && !menu.some((m) => m.id === 'move'))) return false;
    movers.set(row.unitId, {
      unitId: row.unitId,
      title: row.title,
      // A thing in parts moves whole: the target shows all of it.
      minutes: wholeMinutes(row.itemKey) || row.minutes,
      ...(from ? { from } : {}),
      drag,
      onDrop: (date) => void moveTo(e, date, titles),
      onMoveKey: () => setChoice({ kind: 'move', entry: e, ...(from ? { on: from } : {}) }),
    });
    return true;
  };
  const dragHost = useDragMove((unitId) => movers.get(unitId));

  // „Zeilen aufklappen“ (planner hub 2, package 4a): one row open at a time, page state only (a reload closes it).
  const openRow = useOpenRow();
  const expandOn = data?.settings.expandRows !== false;
  // The open row is no longer drawn open (it left the board, a selection began, the switch went off): it is closed,
  // so it does not spring open again later.
  useEffect(() => {
    if (openRow.open && !document.getElementById(compartmentId(openRow.open))) openRow.close();
  });
  const expandOf = (unitId: string, entry: PlannableEntry | undefined): RowExpand | undefined =>
    expandOn && entry
      ? {
          open: openRow.open === unitId,
          onToggle: () => openRow.toggle(unitId),
          onClose: openRow.close,
          onTakeOut: () => void exclude(entry, titles),
        }
      : undefined;

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
    const menu = rowMenu(row, day.date, reason, {
      tick,
      // The same rule as the toggle: no one-day lock on a part of a thing.
      lockInMenu: lockHidden(row) && row.of === 1 && !row.derived,
    });
    return (
      <ThingRow
        key={row.unitId}
        row={row}
        next={next}
        draggable={!row.fixed && mover(row, menu, day.date)}
        expand={expandOf(row.unitId, row.entry)}
        select={
          dayPicking === day.date && canMove(row)
            ? {
                selected: dayChosen.has(row.unitId),
                onChange: (on) =>
                  setDayChosen((cur) => {
                    const next = new Set(cur);
                    if (on) next.add(row.unitId);
                    else next.delete(row.unitId);
                    return next;
                  }),
              }
            : undefined
        }
        reason={reason}
        whyOpen={why === row.unitId}
        dueClock={dueClock}
        menu={menu}
        lock={lockHidden(row) ? undefined : lockOf(row, day.date)}
        onDone={tick ? () => done(row) : undefined}
        onLater={
          row.entry && canAssign(row.entry.moduleId)
            ? () => void later(row.entry!, titles)
            : undefined
        }
      />
    );
  };

  // „Noch offen“ (planner rethink): the rows of days that have passed. Nothing moved them; from here the person
  // puts them on a day again („Verschieben …“ first in the row's ⋯). Things that are „fest“ come first.
  const tab = params.get('tab') === 'open' ? 'open' : 'plan';
  const openRows = data?.board.open ?? [];
  // The selection belongs to the tab and its rows: leaving the tab, or the tab emptying (a sync, an undo), ends it
  // (adjusting state during render).
  if ((tab !== 'open' || (data && openRows.length === 0)) && (selecting || selected.size > 0)) {
    setSelecting(false);
    setSelected(new Set());
  }
  const renderOpen = (row: OpenRow) => {
    const tick = !!row.entry && canDone(row.entry.moduleId);
    return (
      <ThingRow
        key={row.unitId}
        row={row}
        reason=""
        whyOpen={false}
        dueClock={dueClock}
        // Under its day's head the row need not repeat the day; among the fixed things (several days) it says it.
        was={row.pinned ? row.date : undefined}
        // Package 3: tick, title, „war Mo“, lock and a move button – no ⋯; two taps to a day, also on the phone.
        menu={[]}
        // No day is in sight on this tab: `M` and the move button, no drag.
        draggable={mover(row, undefined, row.date, false)}
        expand={expandOf(row.unitId, row.entry)}
        lock={lockOf(row, row.date)}
        onMove={
          row.entry ? () => setChoice({ kind: 'move', entry: row.entry!, on: row.date }) : undefined
        }
        // Open for more than 14 days: the quiet offer to let it go back to „Noch ohne Tag“.
        onTakeOff={
          row.entry && data && row.date < addDaysStr(data.today, -TAKE_OFF_AFTER)
            ? () => void takeOff(row.entry!, titles)
            : undefined
        }
        select={
          selecting
            ? {
                selected: selected.has(row.unitId),
                onChange: (on) =>
                  setSelected((cur) => {
                    const next = new Set(cur);
                    if (on) next.add(row.unitId);
                    else next.delete(row.unitId);
                    return next;
                  }),
              }
            : undefined
        }
        onDone={tick ? () => done(row) : undefined}
        onLater={
          row.entry && canAssign(row.entry.moduleId)
            ? () => void later(row.entry!, titles)
            : undefined
        }
      />
    );
  };
  const openDates = [...new Set(openRows.filter((r) => !r.pinned).map((r) => r.date))].sort();
  const openFixed = openRows.filter((r) => r.pinned);
  // A row that was moved leaves this list: the focus goes to the next row's menu (or stays on the tabs), so
  // putting several things back one after another keeps its place.
  const openRef = useRef<HTMLDivElement>(null);
  const openSeen = useRef(openRows.length);
  useEffect(() => {
    if (tab === 'open' && openRows.length < openSeen.current) {
      // The next row's move button; when the list is empty now, the tab itself (the focus never falls to the page).
      const next =
        openRef.current?.querySelector<HTMLElement>('[data-row-move]') ??
        openRef.current?.parentElement?.querySelector<HTMLElement>('nav [aria-current="page"]');
      if (next && !openRef.current?.contains(document.activeElement)) next.focus();
    }
    openSeen.current = openRows.length;
  }, [tab, openRows.length]);
  /** The rows a group's „Alle“ selects (in the selection only). */
  const selectAll = (rows: readonly OpenRow[]) =>
    setSelected((cur) => new Set([...cur, ...rows.map((r) => r.unitId)]));
  const groupAction = (rows: readonly OpenRow[], label: string) =>
    selecting ? (
      <button
        type="button"
        className={styles.textLink}
        aria-label={t.planner.open.selectGroup(label)}
        onClick={() => selectAll(rows)}
      >
        {t.planner.open.selectGroupShort}
      </button>
    ) : undefined;
  // One entry per thing (a thing in parts has several rows; it moves whole).
  const openEntries = (rows: readonly OpenRow[]) => [
    ...new Map(rows.flatMap((r) => (r.entry ? [[r.itemKey, r.entry] as const] : []))).values(),
  ];
  // Only rows still in the tab count (a row that left by a sync or an undo is no part of the choice).
  const chosen = openRows.filter((r) => selected.has(r.unitId));
  const endSelection = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const openBlock = (
    <div data-testid="planner-open" ref={openRef}>
      {openRows.length === 0 ? (
        <p className={styles.reason}>{t.planner.open.empty}</p>
      ) : selecting ? (
        <SelectionBar count={new Set(chosen.map((r) => r.itemKey)).size} onCancel={endSelection}>
          <Button
            onClick={() => {
              const rows = chosen;
              setChoice({ kind: 'moveMany', entries: openEntries(rows), onDone: endSelection });
            }}
          >
            {t.planner.open.moveSelected}
          </Button>
        </SelectionBar>
      ) : (
        <div className={styles.openActions} data-testid="open-actions">
          <Button onClick={() => void allToday(openEntries(openRows), titles)}>
            {t.planner.open.allToday}
          </Button>
          <Button variant="ghost" onClick={() => void showSpreadOpen()}>
            {t.planner.open.spread}
          </Button>
          <Button variant="ghost" onClick={() => setSelecting(true)}>
            {t.planner.open.select}
          </Button>
        </div>
      )}
      {/* The selection's count lives in its bar; while nothing is chosen yet the bar is not there – the cancel is. */}
      {selecting && chosen.length === 0 ? (
        <p className={styles.openActions}>
          <Button variant="ghost" onClick={endSelection}>
            {t.actions.cancel}
          </Button>
        </p>
      ) : null}
      {openRows.length === 0 ? null : (
        <GroupedList
          listId="planner-open"
          groups={[
            ...(openFixed.length
              ? [
                  {
                    id: 'fixed',
                    label: t.planner.open.fixedGroup,
                    count: openFixed.length,
                    countHidden: true,
                    ...(selecting
                      ? { action: groupAction(openFixed, t.planner.open.fixedGroup) }
                      : {}),
                    children: <ItemList>{openFixed.map(renderOpen)}</ItemList>,
                  },
                ]
              : []),
            ...openDates.map((date) => {
              const rows = openRows.filter((r) => !r.pinned && r.date === date);
              const label = `${dayName(date)} ${formatDay(date, 'd.')}`;
              return {
                id: date,
                label,
                count: rows.length,
                countHidden: true,
                ...(selecting ? { action: groupAction(rows, label) } : {}),
                children: <ItemList>{rows.map(renderOpen)}</ItemList>,
              };
            }),
          ]}
        />
      )}
    </div>
  );
  // The tab says that something is there by naming the days, never with a count.
  const tabs = (
    <Tabs
      label={t.planner.tabs.label}
      value={tab}
      options={[
        { value: 'plan', label: t.planner.tabs.plan },
        {
          value: 'open',
          // That something is there: a quiet dot, never a count; the name says it in words („… Dinge von Mo, Di“).
          label: t.planner.tabs.open,
          ...(openRows.length ? { mark: true, name: openTabName(openRows) } : {}),
        },
      ]}
      onChange={(next) =>
        setParams(
          (p) => {
            const q = new URLSearchParams(p);
            if (next === 'open') q.set('tab', 'open');
            else q.delete('tab');
            return q;
          },
          { replace: true },
        )
      }
    />
  );

  // A row of „Frist vorbei“: the one row form, neutral; it sits on no day, so no tick, no „Später“, no duration.
  const renderLate = (row: BoardRow) => {
    const menu = rowMenu(row, undefined, undefined, { late: true });
    return (
      <ThingRow
        key={row.unitId}
        row={row}
        reason=""
        whyOpen={false}
        dueClock={dueClock}
        menu={menu}
        noDuration
        draggable={mover(row, menu)}
        expand={expandOf(row.unitId, row.entry)}
      />
    );
  };

  const waiting = board?.waiting ?? [];
  const late = board?.late ?? [];
  const overflow = data?.last?.today === data?.today ? (data?.last?.overflowMin ?? 0) : 0;
  // The week from today decides what the page says about itself (four weeks are read for the views, package 4).
  const nothingPlanned =
    board !== undefined && board.days.slice(0, SPAN).every((d) => d.rows.length === 0);
  // Things on passed days („Noch offen“) or in a later week are no empty plan: the first-start state would say
  // he has nothing.
  const openCount = board?.open.length ?? 0;
  const boardEmpty =
    nothingPlanned &&
    !!board?.days.every((d) => d.rows.length === 0) &&
    waiting.length === 0 &&
    late.length === 0 &&
    openCount === 0;

  // The day the sheet shows: `?day=` or a tile → the pick stored today on this device → the first day that holds
  // things → today. Once shown it stays (a day does not change under the hand when its last thing is ticked).
  const days = board?.days;
  /** The days from today the page speaks of (head, empty texts): one week. */
  const week = days?.slice(0, SPAN);
  /** The days in view: the band's week, or the grid's four weeks (passed days included). */
  const bandDays = data?.view ?? week;
  /** The week in view from today on („Zeiten dieser Woche“, the context column). */
  const viewWeek = bandDays?.filter((d) => d.date >= (data?.today ?? now)).slice(0, SPAN);
  const storedDate = storedPick && storedPick.on === data?.today ? storedPick.date : undefined;
  const shownDay =
    !days || storedPick === undefined || thenStored === undefined
      ? undefined
      : (days.find((d) => d.date === pickedDay) ??
        days.find((d) => d.date === storedDate) ??
        firstDayWithRows(week ?? []) ??
        days[0]);

  // `?item=<rowKey>` (the mark „Im Plan · Mi“ of any module, `core/entitylinks/PlanMark.tsx`): that row is brought into
  // view and gets the focus once the board shows it – on the day of `?day=`, in „Noch offen“ with `?tab=open`, or under
  // „Noch ohne Tag“, which unfolds for it. Read once, the other parameters are cleared as before.
  useEffect(() => {
    // For a moment after the jump the board may still draw its rows anew (a slow device): while nothing else holds
    // the focus, it goes back to the row – never taken from anything the person focused (UI timing only).
    const held = holdFocus.current;
    if (held && performance.now() < held.until) {
      const lost = !document.activeElement || document.activeElement === document.body;
      if (lost)
        document
          .querySelector<HTMLElement>(`[data-row-key="${CSS.escape(held.key)}"] [data-row]`)
          ?.focus({ preventScroll: true });
    }
    // Once what holds the row is drawn: the day sheet on „Plan“, the board's open rows on „Noch offen“.
    if (!lookFor.current || !(tab === 'open' ? data : shownDay)) return;
    const rows = [
      ...document.querySelectorAll<HTMLElement>(`[data-row-key="${CSS.escape(lookFor.current)}"]`),
    ];
    // A copy in sight first (a row can be drawn twice, the band beside the sheet); else the one in a folded group.
    const row = rows.find((r) => !r.closest('[hidden]')) ?? rows[0];
    // The rows arrive with the board's reads: a short wait for the row before it counts as gone (UI timing only).
    lookSince.current ??= performance.now();
    if (!row && performance.now() - lookSince.current < 3000) return;
    // Asked once: the board is drawn, so a row that is not there (taken off meanwhile) is not waited for longer.
    const key = lookFor.current;
    lookFor.current = undefined;
    if (!row) return;
    holdFocus.current = { key, until: performance.now() + 2000 };
    const bring = () => {
      row.scrollIntoView?.({ block: 'center' });
      row.querySelector<HTMLElement>('[data-row]')?.focus({ preventScroll: true });
    };
    // A row in a folded group („Noch ohne Tag“, the foot of the sheet): the group opens as by his tap, and the row is
    // brought into view once it is shown (planner hub 2, package 10b – the mark's M3).
    const fold = row.closest<HTMLElement>('[hidden]');
    if (fold) {
      fold
        .closest('section')
        ?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')
        ?.click();
      requestAnimationFrame(bring);
    } else bring();
  });

  // A row a drag or „Auswählen“ can move: a thing of a source that is not a fixed block or left out.
  const canMove = (r: BoardRow) => !!r.entry && !r.fixed && r.item?.excluded !== true;
  // The day selection belongs to the shown day of the tab „Plan“: another day or the other tab ends it (adjusting
  // state during render).
  if (dayPicking && (tab !== 'plan' || (shownDay && shownDay.date !== dayPicking))) {
    setDayPicking(undefined);
    setDayChosen(new Set());
    setKeeping(false);
    if (sayLine === t.planner.keep.fromSentence) setSayLine(undefined);
  }
  const endDayPick = () => {
    setDayPicking(undefined);
    setDayChosen(new Set());
    setKeeping(false);
    // The sentence's hint („Mit „Nur das hier“ wählst du …“) goes with the selection it pointed to.
    if (sayLine === t.planner.keep.fromSentence) setSayLine(undefined);
  };
  /** „Auswählen“ on the day sheet: the bar (count, „Auf einen Tag …“, cancel) or, while nothing is chosen, „Alle“. */
  const daySelection = (day: BoardDay) => {
    const rows = day.rows.filter((r) => canMove(r) && dayChosen.has(r.unitId));
    const label = `${dayName(day.date)} ${formatDay(day.date, 'd.')}`;
    const entries = [
      ...new Map(rows.flatMap((r) => (r.entry ? [[r.itemKey, r.entry] as const] : []))).values(),
    ];
    if (keeping) {
      // What stays is ticked; the rest is every other thing of the day that can move (in the sheet's order).
      const keep = [...new Set(rows.map((r) => r.itemKey))];
      const rest = [
        ...new Map(
          day.rows
            .filter((r) => canMove(r) && !keep.includes(r.itemKey))
            .flatMap((r) => (r.entry ? [[r.itemKey, r.entry] as const] : [])),
        ).values(),
      ];
      return (
        <p className={styles.openActions} data-testid="day-keep">
          {rows.length === 0 ? <span>{t.planner.keep.hint}</span> : null}
          {rows.length > 0 && rest.length === 0 ? <span>{t.planner.keep.all}</span> : null}
          {rows.length > 0 && rest.length > 0 ? (
            <Button
              variant="primary"
              onClick={() =>
                setChoice({
                  kind: 'rest',
                  date: day.date,
                  keep,
                  rest,
                  later: rest.some((e) => canLater(e.moduleId)),
                  onDone: endDayPick,
                })
              }
            >
              {t.planner.keep.apply}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={endDayPick}>
            {t.actions.cancel}
          </Button>
        </p>
      );
    }
    return rows.length > 0 ? (
      <SelectionBar count={entries.length} onCancel={endDayPick}>
        <Button onClick={() => setChoice({ kind: 'moveMany', entries, onDone: endDayPick })}>
          {t.planner.open.moveSelected}
        </Button>
      </SelectionBar>
    ) : (
      <p className={styles.openActions} data-testid="day-select">
        <Button
          variant="ghost"
          aria-label={t.planner.open.selectGroup(label)}
          onClick={() => setDayChosen(new Set(day.rows.filter(canMove).map((r) => r.unitId)))}
        >
          {t.planner.open.selectGroupShort}
        </Button>
        <Button variant="ghost" onClick={endDayPick}>
          {t.actions.cancel}
        </Button>
      </p>
    );
  };
  /**
   * „Plan als Text kopieren“ (use case „Tag kippt“, P3): the days he looks at, from today, as text „Plan einfügen“ reads
   * back (`copyInput` decides what goes in). Nothing is sent anywhere: the text goes to the clipboard on his tap.
   */
  async function copyPlan() {
    const c = t.planner.copy;
    const toast = useUiStore.getState().toast;
    const from = data?.today ?? today();
    // The days he looks at: the week band, or the grid's four weeks – from today on.
    const to = bandDays?.at(-1)?.date ?? board?.days.at(-1)?.date ?? from;
    const input = copyInput(board?.days ?? [], board?.waiting ?? [], laterList ?? [], { from, to });
    const text = planAsText(input, {
      goal: t.planner.goal.line,
      day: (date) => `${dayName(date)} ${formatDay(date, 'd.M.')}`,
      fixed: c.fixed,
      week: c.week,
      later: c.later,
      minutes: c.minutes,
    });
    if (!text.trim()) {
      toast(c.empty);
      return;
    }
    try {
      await getPlatform().clipboard.writeText(text);
      // The toast says what is in the text: titles, days, minutes – and fixed times and the goal when they went too.
      const what = c.list([
        c.whatTitles,
        c.whatDays,
        c.whatMinutes,
        ...(input.days.some((d) => d.fixed.length) ? [c.whatFixed] : []),
        // The goal line is the text's first line when it went in.
        ...(input.goal &&
        (text === t.planner.goal.line(input.goal) ||
          text.startsWith(`${t.planner.goal.line(input.goal)}\n`))
          ? [c.whatGoal]
          : []),
      ]);
      toast(c.done(`${dayName(to)} ${formatDay(to, 'd.M.')}`, what));
    } catch {
      toast(c.failed);
    }
  }

  /**
   * The goal of the day (P2): „Ziel: Wohnung frei bekommen“ – one quiet line, no figure, no bar. ✕ removes it from every
   * day in view that carries the same goal (the weekend it was set for); „Tag einstellen“ edits it per day.
   */
  const goalLine = (day: BoardDay) => {
    const goal = day.row?.note;
    if (!goal) return null;
    const same = (board?.days ?? []).filter((d) => d.row?.note === goal).map((d) => d.date);
    return (
      <p className={styles.goalLine} data-testid="day-goal">
        <span>{t.planner.goal.line(goal)}</span>
        <IconButton
          label={t.planner.goal.removeName(goal)}
          onClick={() => void setGoal(same.length ? same : [day.date], undefined, titles)}
        >
          <Icon name="close" size={16} />
        </IconButton>
      </p>
    );
  };
  /**
   * The day's starting point after „Nur das hier“ (TARGET §2): „Anfangen mit: Wäsche waschen · Fokus starten“ while
   * that thing is still open on that day; one ✕ hides it. Nothing else on the sheet changes.
   */
  const startLine = (day: BoardDay) => {
    const key = startPoints?.[day.date];
    if (!key) return null;
    const row = day.rows.find((r) => r.itemKey === key);
    if (!row) return null;
    return (
      <p className={styles.startPoint} data-testid="start-point">
        <span>
          {t.planner.keep.start}: <strong>{row.title}</strong>
        </span>
        <Button
          size="sm"
          onClick={() =>
            // A thing with steps starts in step mode (package 5a): no round, the steps are the round.
            hasOpenSteps(row.entry)
              ? void navigate(stepsPath(row.unitId), STEPS_FRESH)
              : void beginPlanFocus({
                  unitId: row.unitId,
                  title: row.title,
                  minutes: row.minutes,
                }).then(() => navigate(planFocusPath(row.unitId)))
          }
        >
          {t.planner.keep.startFocus}
        </Button>
        <IconButton
          label={t.planner.keep.startHide}
          onClick={() => void setStartPoint(day.date, undefined)}
        >
          <Icon name="close" size={16} />
        </IconButton>
      </p>
    );
  };
  const pageMenu: RowMenuItem[] = [
    // The phone in this week's week view (no band row): „4 Wochen zeigen“ lives here.
    ...(phone && !grid && start === thisWeek
      ? [{ id: 'grid', label: t.planner.board.gridViewMenu, onSelect: toggleGrid }]
      : []),
    {
      id: 'replan',
      label: t.planner.head.replan,
      onSelect: () => void showPreview([{ op: 'replan', reshuffle: false }]),
    },
    // „Auswählen“ (package 5): several things of the shown day onto one day – where something can move.
    ...(tab === 'plan' && shownDay && shownDay.rows.some(canMove)
      ? [
          {
            id: 'select',
            label: t.planner.open.select,
            onSelect: () => {
              setDayChosen(new Set());
              setKeeping(false);
              setDayPicking(shownDay.date);
              if (sayLine === t.planner.keep.fromSentence) setSayLine(undefined);
            },
          },
          // „Nur das hier …“ (use case „Tag kippt“): tick what stays, the rest goes in one move.
          {
            id: 'keep',
            label: t.planner.keep.menu,
            onSelect: () => {
              setDayChosen(new Set());
              setKeeping(true);
              setDayPicking(shownDay.date);
              if (sayLine === t.planner.keep.fromSentence) setSayLine(undefined);
            },
          },
        ]
      : []),
    { id: 'paste', label: t.planner.paste.menu, onSelect: () => setPasting('') },
    // „Plan als Text kopieren“ (P3): only on his tap, only to the clipboard, only titles, days, minutes and the goal.
    { id: 'copy', label: t.planner.copy.menu, onSelect: () => void copyPlan() },
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
  const shownDate = shownDay?.date;
  // Adjusting state during render: the day the page opened on becomes the pick – once the plan holds things (the
  // board of a fresh page fills a moment after its days are there; an empty board keeps following).
  if (shownDate && pickedDay === undefined && (storedDate || !nothingPlanned))
    setPickedDay(shownDate);

  /** A tile (or a swipe) picks the day: stored for today on this device, said in the status line. */
  function pick(date: string) {
    if (!data) return;
    // A passed day (the grid shows this week's Monday on): what is open there is in the tab „Noch offen“.
    if (date < data.today) {
      setParams({ tab: 'open' }, { replace: true });
      return;
    }
    const day = days?.find((d) => d.date === date);
    if (!day) return;
    setPickedDay(date);
    // The band follows the picked day past its end (a swipe): the week it lies in, lined up from the band's start.
    // The grid stays put – a day does not move under the hand; the band lines up when the week view returns.
    if (!grid && (date < start || date > addDaysStr(start, SPAN - 1))) setWeekStart(weekOf(date));
    void setMeta(DAY_KEY, { date, on: data.today });
    setStatus(tileName(day, days?.[1]?.date === date));
  }

  /** „4 Wochen“ on and off; back in the week view the band shows the week of the day picked in the grid. */
  function toggleGrid() {
    if (
      grid &&
      pickedDay &&
      pickedDay >= now &&
      (pickedDay < start || pickedDay > addDaysStr(start, SPAN - 1))
    )
      setWeekStart(weekOf(pickedDay));
    setGrid((g) => !g);
  }

  /** ‹ › of the band (a week) or of the grid (four weeks); never before today's week. */
  function page(dir: 1 | -1) {
    const step = grid ? GRID_DAYS : SPAN;
    const next = addDaysStr(start, dir * step);
    setWeekStart(next < thisWeek ? thisWeek : next);
  }
  const bandRange = bandDays?.length
    ? t.planner.board.range(
        `${dayName(bandDays[0]!.date)} ${formatDay(bandDays[0]!.date, 'd.')}`,
        `${dayName(bandDays.at(-1)!.date)} ${formatDay(bandDays.at(-1)!.date, 'd. MMM')}`,
      )
    : '';
  // The band's row (direction A): „KW 47“ (the grid: its four weeks, with ‹ ›), „Heute“ once paged away, and the
  // switch „Woche | 4 Wochen“ on the right – on the phone too. In the week view ‹ › stand at the band's ends.
  const canPrev = start > thisWeek;
  // The phone in this week's week view has no row (its page keeps the field whole on arrival, planner-hub M-3): the
  // sheet's swipe pages, ⋯ holds „4 Wochen zeigen“; paged away or in the grid the row is there.
  const bandRow =
    phone && !grid && !canPrev ? null : (
      <div className={styles.bandRow} data-testid="band-row">
        {/* The grid, and the phone's week (its tiles need the band's whole width): ‹ › beside the label. */}
        {(grid || phone) && canPrev ? (
          <IconButton
            className={styles.bandControl}
            label={grid ? t.planner.board.gridPrev : t.planner.board.prev}
            onClick={() => page(-1)}
          >
            <Icon name="chevronLeft" size={16} />
          </IconButton>
        ) : null}
        <span className={styles.bandLabel}>
          {grid ? bandRange : t.planner.board.weekNo(isoWeekOf(addDaysStr(start, SPAN - 1)))}
        </span>
        {grid || phone ? (
          <IconButton
            className={styles.bandControl}
            label={grid ? t.planner.board.gridNext : t.planner.board.next}
            onClick={() => page(1)}
          >
            <Icon name="chevronRight" size={16} />
          </IconButton>
        ) : null}
        {canPrev ? (
          <button
            type="button"
            className={`${styles.textLink} ${styles.bandControl}`}
            onClick={() => setWeekStart(thisWeek)}
          >
            {t.planner.board.today}
          </button>
        ) : null}
        <span className={styles.bandSwitch} data-testid="grid-switch">
          <Segmented
            label={t.planner.board.viewSwitch}
            value={grid ? 'grid' : 'week'}
            options={[
              { value: 'week', label: t.planner.board.weekView },
              { value: 'grid', label: t.planner.board.gridView },
            ]}
            onChange={(v) => {
              if ((v === 'grid') !== grid) toggleGrid();
            }}
          />
        </span>
      </div>
    );

  // „Danach“ is folded on the phone and open on the desktop until the user says otherwise (device-local).
  const thenOpen = thenStored ?? !phone;

  // Things laid on a day the board does not show yet have a day – they get their own small group, not „Noch ohne Tag“.
  const noDay = waiting.filter((w) => w.reason !== 'later');
  const laidLater = waiting.filter((w) => w.reason === 'later');
  // „Vorschlag: Do · Frist Fr“ (CONCEPT §2): things without a day that carry a deadline get a day proposed by one dry
  // run over all of them – computed here, never stored; two chips never claim the same room.
  // A ToDo date still ahead gets its own chip („In ToDos“): such a thing takes no room in the proposal either.
  const todoAhead = (w: (typeof waiting)[number]) =>
    !!w.todoDate && data !== undefined && w.todoDate >= data.today;
  const chipKeys = waiting
    .filter(
      (w) =>
        w.reason !== 'later' && w.reason !== 'excluded' && w.hardDue && w.entry && !todoAhead(w),
    )
    .map((w) => w.itemKey)
    .sort();
  // „Neues automatisch vorschlagen“ (package 6): things without a deadline and without a ToDo date get a chip too,
  // proposed after every deadline thing (a deadline chip's day never changes by the switch).
  const laterKeys = data?.settings.suggestNew
    ? waiting
        .filter(
          (w) =>
            w.reason !== 'later' &&
            w.reason !== 'excluded' &&
            !w.hardDue &&
            !w.todoDate &&
            w.entry &&
            w.of === 1,
        )
        .map((w) => w.itemKey)
        .sort()
    : [];
  const chipSig = data
    ? JSON.stringify([
        data.today,
        chipKeys,
        laterKeys,
        waiting.map((w) => [
          w.itemKey,
          w.hardDue,
          w.minutes,
          w.item?.priority ?? w.entry?.priority,
          w.entry?.earliest,
          w.item?.part,
        ]),
        data.settings,
        board?.days.map((d) => [d.date, d.usable, d.rows.map((r) => [r.unitId, r.minutes])]),
      ])
    : '';
  const [proposals, setProposals] = useState<{ sig: string; days: Record<string, string> }>();
  useEffect(() => {
    if (!chipSig || chipKeys.length + laterKeys.length === 0) return;
    let live = true;
    void proposeUser(chipKeys, laterKeys)
      .catch(() => ({}))
      .then((days) => {
        if (live) setProposals({ sig: chipSig, days });
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `chipSig` holds the keys and the days they depend on
  }, [chipSig]);
  const chipOf = (w: (typeof waiting)[number]) => {
    const e = w.entry;
    if (!e) return undefined;
    // Only a proposal for the plan as it is now (a stale one could lay the thing on a day that filled up since).
    // A date the person set in ToDos comes first: its chip, never a proposal over it.
    const proposed =
      (w.hardDue ? !todoAhead(w) : laterKeys.includes(w.itemKey)) && proposals?.sig === chipSig
        ? proposals.days[w.itemKey]
        : undefined;
    if (proposed)
      return (
        <span className={styles.hintRow} data-testid="proposal-chip">
          <span>
            {w.hardDue
              ? t.planner.chips.proposalDue(dayName(proposed), dayName(w.hardDue))
              : t.planner.chips.proposal(dayName(proposed))}
          </span>
          <button
            type="button"
            className={styles.textLink}
            aria-label={t.planner.chips.takeName(w.title, dayName(proposed))}
            onClick={() => void layHere(e, proposed, titles)}
          >
            {t.planner.chips.take}
          </button>
        </span>
      );
    if (w.todoDate) {
      const when = `${dayName(w.todoDate)} ${formatDay(w.todoDate, 'd.')}`;
      const ahead = data !== undefined && w.todoDate >= data.today;
      return (
        <span className={styles.hintRow} data-testid="todo-chip">
          <span>{t.planner.chips.inTodos(when)}</span>
          {ahead ? (
            <button
              type="button"
              className={styles.textLink}
              aria-label={t.planner.chips.placeName(w.title, when)}
              onClick={() => void layHere(e, w.todoDate!, titles)}
            >
              {t.planner.chips.place}
            </button>
          ) : null}
        </span>
      );
    }
    return undefined;
  };
  /** A thing „Woche vorschlagen“ can give a day: listed by a source, not left out, not laid on a later day. */
  const proposable = (w: (typeof waiting)[number]) =>
    !!w.entry && w.reason !== 'excluded' && w.reason !== 'later';
  const waitRows = (list: typeof waiting) => (
    <ItemList>
      {list.map((w) => {
        const reason =
          w.reason === 'excluded'
            ? t.planner.row.excludedState
            : w.reason === 'later'
              ? t.planner.wait.later(`${dayName(w.date!)} ${formatDay(w.date!, 'd.M.')}`)
              : explainWait({ reason: w.reason, bumpedBy: w.bumpedBy }, nameOf);
        const menu = rowMenu(w, undefined, reason);
        return (
          <WaitRow
            key={w.unitId}
            row={w}
            reason={reason}
            why={why === w.unitId}
            menu={menu}
            chip={chipOf(w)}
            draggable={mover(w, menu)}
            expand={expandOf(w.unitId, w.entry)}
          />
        );
      })}
    </ItemList>
  );
  // „Von Mo, Di ist noch etwas offen.“ – one calm line on top of today's sheet (inside its card, direction A), never a
  // count (CONCEPT §3).
  const openLineNode =
    shownDay?.isToday && openRows.length > 0 && focus.openLine ? (
      <p className={styles.openLine} data-testid="open-line">
        <span>{openLineText(openRows)}</span>
        <button
          type="button"
          className={styles.textLink}
          onClick={() =>
            setParams(
              (p) => {
                const q = new URLSearchParams(p);
                q.set('tab', 'open');
                return q;
              },
              { replace: true },
            )
          }
        >
          {t.planner.open.show}
        </button>
      </p>
    ) : null;
  const suggestWeek = (
    <button
      type="button"
      className={styles.textLink}
      data-testid="suggest-week"
      aria-label={t.planner.wait.suggestName}
      onClick={() => void showPreview([{ op: 'replan', reshuffle: false }])}
    >
      {t.planner.head.replan}
    </button>
  );
  const laterRows = laterList ?? [];
  const waitingBlock =
    waiting.length > 0 || laterRows.length > 0 ? (
      <div className={styles.waiting}>
        {/* „Woche vorschlagen“ (package 6): reachable with the group folded – a dumped pile is two taps from its days
            (the link, then „Übernehmen“ in the preview); nothing moves before that. On the phone the link stands
            inside the open group (the page keeps its height: planner-hub M-3, the field whole on arrival). */}
        {!phone && noDay.some(proposable) ? (
          <p className={styles.waitSuggest}>{suggestWeek}</p>
        ) : null}
        <GroupedList
          listId="planner"
          groups={[
            ...(noDay.length
              ? [
                  {
                    // Folded by default (Q4 a); a new id, so an old „closed“ choice is not read as „open“.
                    id: 'wait',
                    defaultClosed: true,
                    label: t.planner.wait.title,
                    count: noDay.length,
                    detail: t.planner.wait.calm,
                    // The overload figure once the group is open: neutral text, no tone (CONCEPT §7); on the phone
                    // „Woche vorschlagen“ beside it (the phone's page keeps its height: its field stays whole).
                    ...(overflow > 0 || (phone && noDay.some(proposable))
                      ? {
                          action: (
                            <span className={styles.waitActions}>
                              {overflow > 0 ? (
                                <p className={styles.reason} data-testid="planner-overload">
                                  {overloadText(overflow)}
                                </p>
                              ) : null}
                              {phone && noDay.some(proposable) ? suggestWeek : null}
                            </span>
                          ),
                        }
                      : {}),
                    children: (
                      <>
                        {/* P5 (package 2): one quiet offer under the group's head, money before mail. */}
                        {data?.pileOffer ? (
                          <PileOffer
                            key={data.pileOffer.area}
                            area={data.pileOffer.area}
                            n={data.pileOffer.n}
                          />
                        ) : null}
                        {waitRows(noDay)}
                      </>
                    ),
                  },
                ]
              : []),
            ...(laidLater.length
              ? [
                  {
                    id: 'later',
                    defaultClosed: true,
                    label: t.planner.wait.laterTitle,
                    count: laidLater.length,
                    children: waitRows(laidLater),
                  },
                ]
              : []),
            // „Nächste Wochen“ (use case „Tag kippt“): kept for later, not crossed out; back only by his tap.
            ...(laterRows.length
              ? [
                  {
                    id: 'nextWeeks',
                    defaultClosed: true,
                    label: t.planner.keep.laterGroup,
                    count: laterRows.length,
                    detail: t.planner.keep.laterHint,
                    children: (
                      <ul className={styles.laterList} data-testid="planner-later">
                        {laterRows.map((e) => (
                          <li key={`${e.moduleId}:${e.id}`}>
                            <span>{e.title}</span>
                            <button
                              type="button"
                              className={styles.textLink}
                              aria-label={t.planner.keep.backName(e.title)}
                              onClick={() => void bringBack(e, titles)}
                            >
                              {t.planner.keep.back}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                ]
              : []),
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
          onSplit={(key) =>
            void showPreview(
              [...pending.ops, { op: 'split', key }],
              pending.fromField,
              pending.local,
            )
          }
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
      onSubmit={(e) => void add(e)}
      reading={reading}
      preview={kindReading}
      onAsTask={() => {
        // K3: this entry is a plain ToDo; the line is gone for it.
        setPlainFor(text);
        // A plain ToDo: the local model never reads it as an instruction either.
        declinedRef.current = text.trim();
        void add(undefined, { plain: true });
      }}
      previewAbove={phone && !inDialog}
      error={addError}
      focusOnOpen={inDialog}
      // The phone's last row is the field alone, its label for screen readers (placeholder and „Eintragen“ say
      // it; M-3: the row fits above the bottom bar on arrival); its examples stand in the plus's sheet.
      labelHidden={inDialog || phone}
      // The examples help the first entries; once the week holds things they step back (package 4: the band's row
      // keeps the page's stimulus budget). The phone's plus sheet always has them.
      examples={inDialog || (!phone && nothingPlanned)}
      formRef={addRef}
      onPastePlan={(pasted) => {
        if (!looksLikePlan(pasted)) return false;
        if (inDialog) setCapturing(false);
        setPasting(pasted);
        return true;
      }}
    />
  );

  // What the sheet says while its day holds nothing: the one empty state of a board without things, else a line.
  const firstFull = week ? firstDayWithRows(week) : undefined;
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
        : nothingPlanned && openCount > 0 && !(shownDay?.isToday && focus.openLine)
          ? // Everything he had lies on passed days: say where it is (the tab), not that nothing is there – unless
            // the line over today's sheet says it already.
            t.planner.sheet.onlyOpen
          : nothingPlanned && waiting.some((w) => w.reason === 'no-day')
            ? // Nothing lies on a day yet, things wait without one: name the one next step (also beside late
              // money – „only the invoices are open“ would be untrue).
              t.planner.sheet.noDayNext
            : nothingPlanned && late.length > 0
              ? late.every((r) => r.entry?.kind === 'invoice')
                ? t.planner.sheet.onlyLate
                : t.planner.sheet.onlyLateThings
              : t.planner.sheet.emptyDay}
    </p>
  );

  // „Frist vorbei“ is the first card of the context column where there is one (wide); elsewhere it is one row
  // above the day's sheet.
  // „Nächste Fristen“ (R2): a card of the column beside the sheet only – the phone's context is the waiting group
  // (CONCEPT-DESIGN §4).
  const deadlines = wide && viewWeek ? nextDeadlinesOf(viewWeek, waiting) : [];
  const context = viewWeek ? (
    <Context
      days={viewWeek}
      before={wide ? <LateGroup rows={late} renderRow={renderLate} /> : undefined}
      deadlines={deadlines}
    />
  ) : null;
  // Direction A: „Noch ohne Tag“ lies in the day's sheet; beside it stand appointments and deadlines.
  const hasBeside = !!viewWeek && (appointmentsOf(viewWeek).length > 0 || deadlines.length > 0);
  const hasContext = hasBeside || (wide && late.length > 0);

  return (
    <PileContext.Provider value={pileData}>
      <MeasureShown.Provider value={data?.settings.measurePropose !== false}>
        <PageHeader title={t.planner.title}>{phone ? null : pageMenuButton}</PageHeader>
        {/* U01: the figure has no caps label, the frame's placeholder for a `kennzahl` head has one. Until the board is
          read – and while no day holds a thing – the page holds the row itself, in the figure's own shape, unseen, so
          the head keeps its height. */}
        <HeroSlot area="figure">
          {head ? (
            <HeroFigure value={head.value} detail={head.detail} type="sans" testId="planner-head" />
          ) : (
            <div
              className={styles.headPending}
              aria-hidden="true"
              data-testid="planner-head-pending"
            >
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
        <DragGhost />
        <p className="sr-only" role="status" data-testid="planner-status">
          <span key={status.n}>{status.text}</span>
        </p>

        {/* Package 5: rows of the sheet, the tab and „Noch ohne Tag“ (beside, when wide) drag onto the band's days. */}
        <div ref={dragHost} className={styles.dragHost}>
          <SplitView enabled={wide && hasContext} asideLabel={t.planner.ctx.label} aside={context}>
            {/* Wide and nothing beside it (no appointment, nothing waits): the main column keeps the width it has
            beside the context column, left-aligned with the head's title – rows do not stretch over the page. */}
            <div
              className={wide && !hasContext ? `${styles.main} ${styles.mainAlone}` : styles.main}
            >
              {/* Reading order = DOM order: field → band → sheet → context. The field is there from the first paint
              and never moves under the typing hand (U01). */}
              {phone ? null : capture(false)}
              {phone ? null : answer}

              {/* The tabs are there while something is open from earlier (or that tab is shown): an empty „Noch
              offen“ is no control worth a row – on the phone it would push the field under the bottom bar. */}
              {openRows.length > 0 || tab === 'open' ? tabs : null}

              {showWeekLink && tab !== 'open' ? (
                <p className={styles.weekLink} data-testid="week-check-link">
                  <button
                    type="button"
                    className={styles.textLink}
                    onClick={() => setChecking(true)}
                  >
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

              {tab === 'open' ? (
                openBlock
              ) : (
                <>
                  {bandDays && data ? (
                    <>
                      {bandRow}
                      {grid ? (
                        <WeekGrid
                          days={bandDays}
                          picked={shownDate}
                          today={data.today}
                          onPick={pick}
                          drop
                        />
                      ) : (
                        <WeekBand
                          days={bandDays}
                          picked={shownDate}
                          onPick={pick}
                          today={data.today}
                          drop
                          {...(phone
                            ? {}
                            : {
                                onNext: () => page(1),
                                ...(canPrev ? { onPrev: () => page(-1) } : {}),
                              })}
                        />
                      )}
                    </>
                  ) : (
                    <div className={styles.bandPending} aria-hidden="true" />
                  )}

                  {!wide ? <LateRow rows={late} renderRow={renderLate} /> : null}

                  {shownDay && dayPicking === shownDay.date ? daySelection(shownDay) : null}
                  {shownDay && days ? (
                    <DayPage
                      key={shownDay.date}
                      top={
                        <>
                          {goalLine(shownDay)}
                          {startLine(shownDay)}
                          {openLineNode}
                        </>
                      }
                      foot={waitingBlock}
                      day={shownDay}
                      tomorrow={days[1]?.date === shownDay.date}
                      renderRow={(row, next) => renderRow(row, shownDay, next)}
                      onEditDay={() => setSheetDate(shownDay.date)}
                      // While choosing („Auswählen“, „Nur das hier …“) every row of the day is in reach.
                      thenOpen={
                        thenOpen ||
                        dayPicking === shownDay.date ||
                        (!!revealThen && shownDay.rows.some((r) => r.itemKey === revealThen))
                      }
                      choosing={dayPicking === shownDay.date}
                      onThenToggle={(open) => {
                        setRevealThen(undefined);
                        void setMeta(phone ? THEN_NARROW_KEY : THEN_WIDE_KEY, open);
                      }}
                      empty={emptySheet}
                      // „Rest verteilen“ only where something can go (a day of dated turns and locks alone has nothing).
                      onRest={
                        shownDay.isToday && shownDay.rows.some(movable)
                          ? () => void showRest()
                          : undefined
                      }
                      // Only where something can go: a day over its time by fixed blocks, turns or locks alone has no link.
                      onSpread={
                        shownDay.rows.some(movable) ? () => void showSpread(shownDay) : undefined
                      }
                      hints={
                        shownDay.hints?.length ? (
                          <ItemList label={t.planner.chips.todoList}>
                            {shownDay.hints.map((h) => (
                              <TodoHintRow
                                key={h.itemKey}
                                title={h.title}
                                date={h.date}
                                onPlace={() => void layHere(h.entry, h.date, titles)}
                              />
                            ))}
                          </ItemList>
                        ) : undefined
                      }
                      // On the phone the page's ⋯ stands in the sheet's head and holds „Tage einteilen“: said once.
                      onSetup={phone ? undefined : () => setSettingUp(true)}
                      headEnd={phone ? pageMenuButton : undefined}
                      dayEnd={
                        data && dayEndOf(data.settings)
                          ? dayEndLabel(dayEndOf(data.settings)!)
                          : undefined
                      }
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

                  {/* A training whose day passed unlogged: asked once, quietly, under today's sheet only. */}
                  {shownDay?.isToday && data ? (
                    <PassedTrainings today={data.today} titles={titles} />
                  ) : null}
                </>
              )}

              {/* Not wide: the context follows the sheet in the one column. */}
              {!wide && hasContext && tab !== 'open' ? (
                <aside aria-label={t.planner.ctx.label}>{context}</aside>
              ) : null}

              {/* Phone: the first screen is band and sheet; the plus of the bottom bar opens the field as a sheet.
              The field also stays where it was before R1, as the page's last row: without it every entry on
              the phone costs one tap and one sheet more than before (e2e/usecases, paths B and E). */}
              {phone && !capturing ? capture(false) : null}
              {phone && !capturing ? answer : null}
            </div>
          </SplitView>
        </div>

        {phone ? (
          <CaptureDialog open={capturing} onClose={() => setCapturing(false)}>
            {capture(true)}
            {answer}
          </CaptureDialog>
        ) : null}
        {pasting !== undefined ? (
          <PasteDialog
            initial={pasting}
            goals={Object.fromEntries(
              (board?.days ?? []).flatMap((d) => (d.row?.note ? [[d.date, d.row.note]] : [])),
            )}
            titles={titles}
            onClose={() => setPasting(undefined)}
          />
        ) : null}
        <RowChoice
          choice={choice}
          days={days?.map((d) => d.date) ?? []}
          titles={titles}
          onClose={() => setChoice(undefined)}
        />
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
            days={viewWeek ?? board.days.slice(0, SPAN)}
            biggest={biggest}
            titles={titles}
            onClose={() => setChecking(false)}
          />
        ) : null}
        {/* A module's quiet strip at the page's foot (`contributions.planPageFoot`, first user: mail in package 4c). */}
        <PlanPageFoot />
      </MeasureShown.Provider>
    </PileContext.Provider>
  );
}
