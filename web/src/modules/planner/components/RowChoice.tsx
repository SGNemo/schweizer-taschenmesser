import { useState } from 'react';
import type { PlannableEntry } from '@/core/modules/contributions';
import { dayName } from '@/core/plan/explain';
import { addDaysStr, formatDay } from '@/core/time/dates';
import { DAY_PARTS, type DayPart } from '@/core/plan/types';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { Chip, Chips, Dialog } from '@/ui';
import { asBreak, BREAK_CHOICES, ESTIMATE_CHOICES, pin, setEstimate, setPart } from '../actions';
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
  /** „Verschieben …“: `on` = the day the row is on (none while it waits), `pinned` = the day it is nailed to. */
  | { kind: 'move'; entry: PlannableEntry; on?: string; pinned?: string };

/**
 * The small sheet behind one ⋯ entry (REVIEW-FABLE R8: one entry opens the choice instead of a menu row per
 * value): the break lengths 1 h · 2 h · 3 h, the estimates 5 · 15 · 30 · 60 Min, or the day parts
 * Vormittag · Nachmittag · Abend · Ohne (package 4b), or – „Verschieben …“ (R2) – the days of the week. One tap
 * acts and closes; the toast carries the undo.
 */
/** Without the board's days: the seven days from today, the board's horizon. */
const weekFromToday = (): string[] =>
  Array.from({ length: BOARD_DAYS }, (_, i) => addDaysStr(today(), i));

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
    // Nailed there already: nothing to change, no run and no toast.
    if (choice.kind !== 'move' || choice.pinned === date) return;
    void pin(choice.entry, date, titles);
  };
  if (choice.kind === 'move')
    return (
      <Dialog open onClose={onClose} title={r.moveTitle(title)}>
        <p className={styles.capacity}>{r.moveHint}</p>
        <Chips label={r.moveTitle(title)}>
          {(days ?? weekFromToday()).map((date) => (
            <Chip
              key={date}
              // „Mi 18.“ – weekday and day, as on the week band's tiles.
              label={`${dayName(date)} ${formatDay(date, 'd.')}`}
              selected={choice.pinned === date}
              onClick={() => pickDay(date)}
            />
          ))}
        </Chips>
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
