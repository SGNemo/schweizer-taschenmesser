import { type KeyboardEvent, useState } from 'react';
import type { PlannableEntry } from '@/core/modules/contributions';
import { dayName } from '@/core/plan/explain';
import { addDaysStr, formatDay } from '@/core/time/dates';
import { DAY_PARTS, type DayPart } from '@/core/plan/types';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { Button, Chip, Chips, Dialog, Icon, IconButton } from '@/ui';
import {
  asBreak,
  BREAK_CHOICES,
  ESTIMATE_CHOICES,
  keepOnly,
  moveMany,
  moveTo,
  type RestTarget,
  setEstimate,
  setPart,
} from '../actions';
import { BOARD_DAYS } from '../calendar';
import { compact } from './capacity';
import styles from '../routes/planner.module.css';

/**
 * Which choice of a row is open: „Als Pause …“ (`date` = the row's day on the board; a waiting thing has none and
 * passes today), „Dauer …“ or „Tagesabschnitt …“.
 */
export type RowChoiceState =
  | { kind: 'break'; entry: PlannableEntry; date: string }
  | { kind: 'estimate'; entry: PlannableEntry; current?: number }
  | { kind: 'part'; entry: PlannableEntry; current?: DayPart }
  /** „Verschieben …“: `on` = the day the row lies on (none while it has no day). */
  | { kind: 'move'; entry: PlannableEntry; on?: string }
  /** „Auf einen Tag …“ of a selection (tab „Noch offen“, package 3): one day for all of them, one undo. */
  | { kind: 'moveMany'; entries: readonly PlannableEntry[]; onDone?: () => void }
  /**
   * „Nur das hier“ (use case „Tag kippt“): what stays on `date` (item keys, the first one is the starting point) and
   * the rest, which goes in one move. `later`: some source of the rest keeps things for later.
   */
  | {
      kind: 'rest';
      date: string;
      keep: readonly string[];
      rest: readonly PlannableEntry[];
      later: boolean;
      onDone?: () => void;
    };

/**
 * The small sheet behind one ⋯ entry (REVIEW-FABLE R8: one entry opens the choice instead of a menu row per
 * value): the break lengths 1 h · 2 h · 3 h, the estimates 5 · 15 · 30 · 60 Min, or the day parts
 * Vormittag · Nachmittag · Abend · Ohne (package 4b), or – „Verschieben …“ (R2) – the days of the week. One tap
 * acts and closes; the toast carries the undo.
 */
/** „Verschieben …“ shows four weeks (package 4); ‹ › page by as many. */
const PICK_DAYS = 28;

/**
 * The days of „Verschieben …“ (package 4): four weeks from today in rows of a week, ‹ › for the four weeks before or
 * after – a day in three weeks is ⋯ · „Verschieben …“ · the day: three taps. One tap on a day acts.
 */
function DayPick({
  label,
  first,
  on,
  onPick,
}: {
  label: string;
  /** The first day offered: today. */
  first: string;
  /** The day the thing lies on (selected), if any. */
  on?: string;
  onPick: (date: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const onArrows = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = (
      { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 } as Record<string, number>
    )[e.key];
    if (!step) return;
    const chips = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
    const at = chips.indexOf(document.activeElement as HTMLButtonElement);
    const to = chips[at + step];
    if (at < 0 || !to) return;
    e.preventDefault();
    to.focus();
  };
  const from = addDaysStr(first, offset);
  const dates = Array.from({ length: PICK_DAYS }, (_, i) => addDaysStr(from, i));
  const weeks = Array.from({ length: PICK_DAYS / BOARD_DAYS }, (_, w) =>
    dates.slice(w * BOARD_DAYS, w * BOARD_DAYS + BOARD_DAYS),
  );
  return (
    <>
      <div className={styles.pickPaging}>
        <IconButton
          label={t.planner.board.gridPrev}
          disabled={offset === 0}
          onClick={() => setOffset((o) => Math.max(0, o - PICK_DAYS))}
        >
          <Icon name="chevronLeft" size={16} />
        </IconButton>
        <span className={styles.pickRange}>
          {t.planner.board.range(
            `${dayName(dates[0]!)} ${formatDay(dates[0]!, 'd.')}`,
            `${dayName(dates.at(-1)!)} ${formatDay(dates.at(-1)!, 'd. MMM')}`,
          )}
        </span>
        <IconButton
          label={t.planner.board.gridNext}
          onClick={() => setOffset((o) => o + PICK_DAYS)}
        >
          <Icon name="chevronRight" size={16} />
        </IconButton>
      </div>
      {/* Arrow keys pick the day (package 5, the move by keyboard): ← → a day, ↑ ↓ a week; Enter acts. */}
      <div onKeyDown={onArrows}>
        {weeks.map((week) => (
          <Chips key={week[0]} label={label}>
            {week.map((date) => (
              <Chip
                key={date}
                // „Mi 18.“ – weekday and day, as on the week band's tiles.
                label={`${dayName(date)} ${formatDay(date, 'd.')}`}
                selected={on === date}
                onClick={() => onPick(date)}
              />
            ))}
          </Chips>
        ))}
      </div>
    </>
  );
}

export function RowChoice({
  choice,
  days,
  titles,
  onClose,
}: {
  choice: RowChoiceState | undefined;
  /** The days „Verschieben …“ offers: the board's days from today ('YYYY-MM-DD'); default the week from today. */
  days?: readonly string[];
  titles: Record<string, string>;
  onClose: () => void;
}) {
  if (!choice) return null;
  const r = t.planner.row;
  if (choice.kind === 'rest') {
    const k = t.planner.keep;
    const next = addDaysStr(choice.date, 1);
    const nextLabel = `${dayName(next)} ${formatDay(next, 'd.')}`;
    const go = (to: RestTarget) => {
      onClose();
      choice.onDone?.();
      void keepOnly(choice.date, choice.keep, choice.rest, to, titles);
    };
    return (
      <Dialog open onClose={onClose} title={k.title(choice.rest.length)}>
        <p className={styles.capacity}>{k.line}</p>
        <div className={styles.restChoices} data-testid="rest-choice">
          <Button onClick={() => go('next')}>
            {choice.date === today() ? k.next(nextLabel) : k.nextDay(nextLabel)}
          </Button>
          <Button onClick={() => go('week')}>{k.week}</Button>
          {choice.later ? <Button onClick={() => go('later')}>{k.later}</Button> : null}
        </div>
      </Dialog>
    );
  }
  if (choice.kind === 'moveMany') {
    const heading = t.planner.open.moveManyTitle(choice.entries.length);
    return (
      <Dialog open onClose={onClose} title={heading}>
        <p className={styles.capacity}>{r.moveHint}</p>
        <DayPick
          label={heading}
          first={days?.[0] ?? today()}
          onPick={(date) => {
            onClose();
            choice.onDone?.();
            void moveMany(choice.entries, date, titles);
          }}
        />
      </Dialog>
    );
  }
  const title = choice.entry.title;
  const pickEstimate = (min: number) => {
    onClose();
    void setEstimate(choice.entry, min, titles);
  };
  const pickPart = (part: DayPart | undefined) => {
    onClose();
    // The part it already has: nothing to change, no run and no toast.
    if (choice.kind !== 'part' || choice.current === part) return;
    void setPart(choice.entry, part, titles);
  };
  const pickDay = (date: string) => {
    onClose();
    // It lies there already: nothing to change, no run and no toast.
    if (choice.kind !== 'move' || choice.on === date) return;
    void moveTo(choice.entry, date, titles);
  };
  if (choice.kind === 'move')
    return (
      <Dialog open onClose={onClose} title={r.moveTitle(title)}>
        <p className={styles.capacity}>{r.moveHint}</p>
        <DayPick
          label={r.moveTitle(title)}
          first={days?.[0] ?? today()}
          {...(choice.on ? { on: choice.on } : {})}
          onPick={pickDay}
        />
      </Dialog>
    );
  const heading =
    choice.kind === 'break'
      ? r.asBreakTitle(title)
      : choice.kind === 'part'
        ? r.dayPartTitle(title)
        : r.estimateTitle(title);
  if (choice.kind === 'part')
    return (
      <Dialog open onClose={onClose} title={heading}>
        <p className={styles.capacity}>{r.dayPartHint}</p>
        <Chips label={heading}>
          {DAY_PARTS.map((part) => (
            <Chip
              key={part}
              label={r.dayParts[part]}
              selected={choice.current === part}
              onClick={() => pickPart(part)}
            />
          ))}
          <Chip
            label={r.dayParts.none}
            selected={!choice.current}
            onClick={() => pickPart(undefined)}
          />
        </Chips>
      </Dialog>
    );
  if (choice.kind === 'break')
    return (
      <BreakChoice
        key={`${choice.entry.moduleId}:${choice.entry.id}:${choice.date}`}
        entry={choice.entry}
        date={choice.date}
        heading={heading}
        titles={titles}
        onClose={onClose}
      />
    );
  return (
    <Dialog open onClose={onClose} title={heading}>
      <Chips label={heading}>
        {ESTIMATE_CHOICES.map((min) => (
          <Chip
            key={min}
            label={compact(min)}
            selected={choice.current === min}
            onClick={() => pickEstimate(min)}
          />
        ))}
      </Chips>
    </Dialog>
  );
}

/**
 * „Als Pause …“: the lengths 1 h · 2 h · 3 h; one tap acts. The break is on the row's day; when that is not today,
 * „Heute“ sits beside it (W24: a thing the plan put on Monday that the person means for now), the hint names the
 * chosen day. A row of today or a waiting thing has only today – no choice to make.
 */
function BreakChoice({
  entry,
  date,
  heading,
  titles,
  onClose,
}: {
  entry: PlannableEntry;
  date: string;
  heading: string;
  titles: Record<string, string>;
  onClose: () => void;
}) {
  const r = t.planner.row;
  const now = today();
  const [day, setDay] = useState(date);
  const pick = (min: number) => {
    onClose();
    void asBreak(entry, day, min, titles);
  };
  return (
    <Dialog open onClose={onClose} title={heading}>
      {date !== now ? (
        <Chips label={r.asBreakDay}>
          <Chip label={dayName(date)} selected={day === date} onClick={() => setDay(date)} />
          <Chip label={r.asBreakToday} selected={day === now} onClick={() => setDay(now)} />
        </Chips>
      ) : null}
      <p className={styles.capacity}>{r.asBreakHint(dayName(day))}</p>
      <Chips label={heading}>
        {BREAK_CHOICES.map((min) => (
          <Chip key={min} label={compact(min)} onClick={() => pick(min)} />
        ))}
      </Chips>
    </Dialog>
  );
}
