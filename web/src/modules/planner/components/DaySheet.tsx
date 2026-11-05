import { useState, type FormEvent } from 'react';
import { formatMinutes } from '@/core/i18n/format';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Dialog, IconButton, Icon, ItemList, ItemRow, TextField } from '@/ui';
import {
  addBlocker,
  AVAILABLE_STEP,
  clearAvailable,
  removeBlocker,
  setAvailable,
} from '../actions';
import type { BoardDay } from '../board';
import styles from '../routes/planner.module.css';

/** The sheet of one day: available time in 30-minute steps, blockers, „Tag frei“. Every change is one undoable run. */
export function DaySheet({
  day,
  titles,
  onClose,
}: {
  day: BoardDay | undefined;
  titles: Record<string, string>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState('');
  const [minutes, setMinutes] = useState('60');
  if (!day) return null;
  const compact = (min: number) => formatMinutes(min, { compact: true });
  const step = (delta: number) =>
    void setAvailable(day.date, Math.max(0, day.availableMin + delta), titles);
  const submitBlocker = (e: FormEvent) => {
    e.preventDefault();
    const min = Number(minutes);
    if (!label.trim() || !Number.isFinite(min) || min <= 0) return;
    void addBlocker(day.date, label.trim(), Math.round(min), titles);
    setLabel('');
  };
  return (
    <Dialog open onClose={onClose} title={formatDay(day.date, 'EEEE, d. MMMM')}>
      <div className={styles.sheetRow}>
        <span>{t.planner.day.available}</span>
        <span className={styles.stepper}>
          <IconButton
            label={t.planner.day.less}
            onClick={() => step(-AVAILABLE_STEP)}
            disabled={day.availableMin === 0}
          >
            <Icon name="minus" />
          </IconButton>
          <span className={styles.sheetValue} data-testid="day-available">
            {day.availableMin === 0 ? t.planner.board.off : compact(day.availableMin)}
          </span>
          <IconButton label={t.planner.day.more} onClick={() => step(AVAILABLE_STEP)}>
            <Icon name="plus" />
          </IconButton>
        </span>
      </div>
      <p className={styles.capacity}>
        {day.off
          ? t.planner.board.off
          : t.planner.board.freeOf(compact(day.free), compact(day.usable))}
      </p>
      {day.blockers.length > 0 ? (
        <ItemList label={t.planner.day.blockers}>
          {day.blockers.map((b) => (
            <ItemRow
              key={b.id}
              title={b.label}
              meta={b.calendar ? t.planner.day.calendar : undefined}
              end={<span className={styles.minutes}>{compact(b.min)}</span>}
              actions={
                b.calendar ? undefined : (
                  <IconButton
                    label={t.planner.day.removeBlocker(b.label)}
                    onClick={() => void removeBlocker(day.date, b.id, titles)}
                  >
                    <Icon name="trash" />
                  </IconButton>
                )
              }
            />
          ))}
        </ItemList>
      ) : null}
      <form className={styles.blockerForm} onSubmit={submitBlocker}>
        <div className={styles.grow}>
          <TextField
            label={t.planner.day.blockerLabel}
            placeholder={t.planner.day.blockerPlaceholder}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className={styles.blockerMin}>
          <TextField
            label={t.planner.day.blockerMinutes}
            type="number"
            min={5}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          {t.planner.day.addBlocker}
        </Button>
      </form>
      <div className={styles.sheetRow}>
        {day.off ? (
          <Button onClick={() => void clearAvailable(day.date, titles)}>
            {t.planner.day.dayOn}
          </Button>
        ) : (
          <Button onClick={() => void setAvailable(day.date, 0, titles)} data-testid="day-off">
            {t.planner.day.dayOff}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
