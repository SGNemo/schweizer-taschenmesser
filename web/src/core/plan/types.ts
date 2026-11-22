/**
 * Contract of the day/week planning engine (docs/design/plan/CONCEPT.md §3). Pure data: the engine
 * never reads a clock, `today` is an input; dates are 'YYYY-MM-DD', minutes are integers.
 */

/** Minutes an item counts when it has no estimate (shown as „~30 Min“). */
export const DEFAULT_MIN = 30;
/** From this length on a unit is a "main item" of its day (`planLimit` counts those). */
export const MAIN_THRESHOLD_MIN = 30;

export interface PlanBlocker {
  id?: string;
  label: string;
  min: number;
  /** 'HH:mm': a blocker with both times also keeps that stretch of the day's window free (`windows.ts`). */
  from?: string;
  to?: string;
}

export interface PlanDay {
  date: string;
  /** Minutes the user has for planned work on this day (0 = a day off). */
  availableMin: number;
  /**
   * Stored blockers, the timed calendar items of the day (`calendarBlockers`) and the blocks a module keeps free
   * (`PlannableSource.blocks`, planner hub S4: a habit's „Zeit im Plan freihalten“) – all reduce the day's time.
   */
  blockers: PlanBlocker[];
  /** Optional time window ('HH:mm'): the sessions of the day get a start and an end inside it (`windows.ts`); never changes the minutes. */
  window?: { from: string; to: string };
}

export type PlanPriority = 0 | 1 | 2 | 3;

/** Part of a day (package 4b): orders a day's units and, with a window, where in it they sit. Never a day. */
export type DayPart = 'morning' | 'afternoon' | 'evening';
export const DAY_PARTS: readonly DayPart[] = ['morning', 'afternoon', 'evening'];
/** Rank of a part in the day's order: none first, then Vormittag, Nachmittag, Abend. */
export const partRank = (part: DayPart | undefined): number =>
  part ? DAY_PARTS.indexOf(part) + 1 : 0;

export interface PlanItem {
  /** `<module>:<id>`; also the first part of every unit id. */
  key: string;
  /** Minutes the whole item takes; missing = `DEFAULT_MIN`. */
  durationMin?: number;
  priority: PlanPriority;
  due?: { date: string; hard: boolean };
  /** Not before this day (a user's own date is read as this, never as a pin). */
  earliest?: string;
  /** Nailed to this day (planner action „Festnageln“ only). */
  pinned?: string;
  /** May be cut into sessions of `maxSessionMin`. */
  splittable?: boolean;
  /** „Nicht planen“: left out of every run. */
  excluded?: boolean;
  /** Vormittag / Nachmittag / Abend (planner-own, never a contract field): order inside the day, never the day. */
  part?: DayPart;
  /**
   * A fixed block (planner hub S4, a training at 18:00): placed on `date` at `from`–`to` ('HH:mm'; missing `to` =
   * `from` + the minutes), first on its day, never split, never moved by any rule (pin, deadline, capacity, „Später“),
   * never late and never waiting. It takes the day's time like a pin – minus what a timed blocker of the day already
   * covers (`fixedCharges`). Outside the horizon it is neither placed nor reported.
   */
  fixed?: { date: string; from: string; to?: string };
  done?: boolean;
  /** Age for the tie-break "older first" (epoch ms). */
  createdAt: number;
}

export interface PlanSettings {
  /** Share of the raw free time that is never planned (0.2 = 20 %). */
  bufferShare: number;
  /** Longer items become sessions of at most this length. */
  maxSessionMin: number;
  /** A session is never shorter than this. */
  minSessionMin: number;
  /** Main items (≥ `MAIN_THRESHOLD_MIN`) per day; `focus.planLimit`. */
  mainPerDay: number;
  /** Days from `today` the plan covers. */
  horizonDays: number;
}

export const DEFAULT_PLAN_SETTINGS: PlanSettings = {
  bufferShare: 0.2,
  maxSessionMin: 90,
  minSessionMin: 25,
  mainPerDay: 3,
  horizonDays: 14,
};

/** One session of an item: `k` of `of`, id `<itemKey>#<k>`. */
export interface PlanUnit {
  id: string;
  itemKey: string;
  k: number;
  of: number;
  minutes: number;
  item: PlanItem;
}

/** Why a unit sits on its day („Warum hier?“). */
export type PlaceReason =
  | 'pinned'
  | 'deadline'
  | 'deadline-buffer'
  | 'new'
  | 'kept'
  | 'carried'
  | 'pulled'
  | 'bumped'
  | 'after-part'
  | 'capacity';

/** Why a unit moved or dropped out. */
export type MoveReason =
  'bumped' | 'after-part' | 'capacity' | 'carried' | 'pulled' | 'pinned' | 'done';

/** `no-day`: the thing has no placement and nobody asked for one („Noch ohne Tag“). */
export type WaitReason = 'horizon' | 'too-long' | 'after-hard-due' | 'no-day';

export interface Assignment {
  /** Unit id `<itemKey>#<k>`. */
  id: string;
  itemKey: string;
  k: number;
  of: number;
  date: string;
  minutes: number;
  /** Position inside the day, 0-based. */
  order: number;
  reason: PlaceReason;
  /** Units that outrank this one and took its room (largest first); never a session of the same item. */
  bumpedBy?: string[];
  /** Placed after its hard due. */
  late?: boolean;
  /** 'HH:mm' inside the day's window (`windows.ts`); missing without a window or when it does not fit. */
  from?: string;
  to?: string;
}

/** What a run needs of the previous plan (stored rows or the last result). */
export type PrevAssignment = Pick<Assignment, 'id' | 'date' | 'reason' | 'bumpedBy'>;

export interface Unplaced {
  id: string;
  itemKey: string;
  k: number;
  of: number;
  minutes: number;
  reason: WaitReason;
  bumpedBy?: string[];
  /** `after-hard-due` of a placed unit: where it landed and when it was due. */
  date?: string;
  due?: string;
}

export interface PlanDiff {
  added: { id: string; to: string; reason: PlaceReason }[];
  moved: { id: string; from: string; to: string; reason: MoveReason; by?: string[] }[];
  removed: { id: string; from: string; reason: MoveReason; by?: string[] }[];
  unchanged: number;
}

export interface DayLoad {
  /** available − blockers */
  raw: number;
  /** raw × (1 − buffer): what may be planned */
  usable: number;
  planned: number;
  /** usable − planned (the figure every surface calls „frei“), never below 0 */
  free: number;
  /** planned − usable when a pin or a deadline overran */
  over: number;
  mains: number;
}

export interface PlanInput {
  today: string;
  days: PlanDay[];
  items: PlanItem[];
  prev?: PrevAssignment[];
  /**
   * The plan stays put (docs/design/planner-rethink/CONCEPT.md §2): with `loose` given, the engine is a proposer.
   * Every unit that is **not** loose and has a previous day is set on that day first, whatever the room (the day
   * may be overbooked); one whose day lies outside the planned days (passed, or beyond the horizon) is left
   * alone (`kept`); one without a previous day gets none (`no-day`). Only the units of the item keys named here
   * are placed or moved by the rules – their previous day is then no claim, only the base of the diff.
   * Missing = the former behaviour (every item may move); no caller outside the tests uses that.
   */
  loose?: readonly string[];
  settings?: Partial<PlanSettings>;
}

export interface PlanResult {
  assignments: Assignment[];
  unplaced: Unplaced[];
  diff: PlanDiff;
  load: Record<string, DayLoad>;
  /** demand − Σ usable of the horizon („mehr zu tun, als Zeit frei ist“) */
  overflowMin: number;
  demandMin: number;
  usableMin: number;
  /** With `loose`: unit ids whose stored day lies outside the planned days – untouched, to be kept as they are. */
  kept?: string[];
  /**
   * With `loose`: handed-over item keys the rules found no room for, so they keep the day they had (taken back out of
   * `loose`). A proposal says so („1 bleibt, wo es liegt: kein Platz“) – in the preview and in the toast.
   */
  heldBack?: string[];
}
