import type { PlannableEntry } from '@/core/modules/contributions';
import { dayName } from '@/core/plan/explain';
import { DAY_PARTS, type DayPart } from '@/core/plan/types';
import { t } from '@/strings';
import { Chip, Chips, Dialog } from '@/ui';
import { asBreak, BREAK_CHOICES, ESTIMATE_CHOICES, setEstimate, setPart } from '../actions';
import { compact } from './capacity';
import styles from '../routes/planner.module.css';

/** Which choice of a row is open: „Als Pause …“ (on the row's day), „Dauer …“ or „Tagesabschnitt …“. */
export type RowChoiceState =
  | { kind: 'break'; entry: PlannableEntry; date: string }
  | { kind: 'estimate'; entry: PlannableEntry; current?: number }
  | { kind: 'part'; entry: PlannableEntry; current?: DayPart };

/**
 * The small sheet behind one ⋯ entry (REVIEW-FABLE R8: one entry opens the choice instead of a menu row per
 * value): the break lengths 1 h · 2 h · 3 h, the estimates 5 · 15 · 30 · 60 Min, or the day parts
 * Vormittag · Nachmittag · Abend · Ohne (package 4b). One tap acts and closes; the toast carries the undo.
 */
export function RowChoice({
  choice,
  titles,
  onClose,
}: {
  choice: RowChoiceState | undefined;
  titles: Record<string, string>;
  onClose: () => void;
}) {
  if (!choice) return null;
  const r = t.planner.row;
  const title = choice.entry.title;
  const pickBreak = (min: number) => {
    if (choice.kind !== 'break') return;
    onClose();
    void asBreak(choice.entry, choice.date, min, titles);
  };
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
  return (
    <Dialog open onClose={onClose} title={heading}>
      {choice.kind === 'break' ? (
        <>
          <p className={styles.capacity}>{r.asBreakHint(dayName(choice.date))}</p>
          <Chips label={heading}>
            {BREAK_CHOICES.map((min) => (
              <Chip key={min} label={compact(min)} onClick={() => pickBreak(min)} />
            ))}
          </Chips>
        </>
      ) : (
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
      )}
    </Dialog>
  );
}
