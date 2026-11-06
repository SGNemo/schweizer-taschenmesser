import { useState, type FormEvent } from 'react';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Dialog, IconButton, Icon, ItemList, ItemRow, TextField } from '@/ui';
import { validWindow, windowText } from '@/core/plan/windows';
import {
  addBlocker,
  AVAILABLE_STEP,
  clearAvailable,
  clearWindow,
  removeBlocker,
  setAvailable,
  setWindow,
} from '../actions';
import type { BoardDay } from '../board';
import { capacityLabel, compact } from './capacity';
import styles from '../routes/planner.module.css';

/**
 * The sheet of one day: available time in 30-minute steps, the optional time window (package 5:
 * the day's own or the weekday's; it only gives sessions a time, the minutes stay the truth),
 * blockers (with a time when the day has a window), „Tag frei“. Every change is one undoable run.
 */
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
  const [blockFrom, setBlockFrom] = useState('');
  const [blockTo, setBlockTo] = useState('');
  // What the user typed into the window fields, for the day it was typed on (the sheet stays mounted).
  const [win, setWin] = useState<{ date: string; from?: string; to?: string }>();
  if (!day) return null;
  const typedHere = win?.date === day.date ? win : undefined;
  const from = typedHere?.from ?? day.window?.from ?? '';
  const to = typedHere?.to ?? day.window?.to ?? '';
  const setWinFrom = (v: string) => setWin({ ...typedHere, date: day.date, from: v });
  const setWinTo = (v: string) => setWin({ ...typedHere, date: day.date, to: v });
  const typed = validWindow({ from, to });
  const submitWindow = (e: FormEvent) => {
    e.preventDefault();
    if (!typed) return;
    void setWindow(day.date, typed, titles).then((ok) => {
      if (ok) setWin(undefined);
    });
  };
  const step = (delta: number) =>
    void setAvailable(day.date, Math.max(0, day.availableMin + delta), titles);
  const submitBlocker = (e: FormEvent) => {
    e.preventDefault();
    const min = Number(minutes);
    const times = day.window ? validWindow({ from: blockFrom, to: blockTo }) : undefined;
    if (!label.trim() || (!times && (!Number.isFinite(min) || min <= 0))) return;
    // The label is cleared once the blocker is in; nothing is lost when the planner was switched off meanwhile.
    void addBlocker(day.date, label.trim(), Math.round(min), titles, times).then((ok) => {
      if (ok) {
        setLabel('');
        setBlockFrom('');
        setBlockTo('');
      }
    });
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
      <p className={styles.capacity}>{capacityLabel(day)}</p>
      <form className={styles.blockerForm} onSubmit={submitWindow} data-testid="day-window">
        <div className={styles.timeField}>
          <TextField
            label={t.planner.day.windowFrom}
            type="time"
            value={from}
            onChange={(e) => setWinFrom(e.target.value)}
          />
        </div>
        <div className={styles.timeField}>
          <TextField
            label={t.planner.day.windowTo}
            type="time"
            value={to}
            onChange={(e) => setWinTo(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={
            !typed ||
            (day.window !== undefined &&
              windowText(typed) === windowText(day.window) &&
              day.ownWindow === true)
          }
        >
          {t.planner.day.windowSet}
        </Button>
        {day.ownWindow ? (
          <Button variant="ghost" onClick={() => void clearWindow(day.date, titles)}>
            {t.planner.day.windowDefault}
          </Button>
        ) : null}
      </form>
      <p className={styles.capacity}>
        {day.window
          ? t.planner.day.windowLine(windowText(day.window), day.ownWindow === true)
          : t.planner.day.noWindow}
      </p>
      {day.blockers.length > 0 ? (
        <ItemList label={t.planner.day.blockers}>
          {day.blockers.map((b) => (
            <ItemRow
              key={b.id}
              title={b.label}
              meta={
                [
                  day.window && b.from && b.to ? `${b.from}–${b.to}` : '',
                  b.calendar ? t.planner.day.calendar : '',
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined
              }
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
        {day.window ? (
          <>
            <div className={styles.timeField}>
              <TextField
                label={t.planner.day.blockerFrom}
                type="time"
                value={blockFrom}
                onChange={(e) => setBlockFrom(e.target.value)}
              />
            </div>
            <div className={styles.timeField}>
              <TextField
                label={t.planner.day.blockerTo}
                type="time"
                value={blockTo}
                onChange={(e) => setBlockTo(e.target.value)}
              />
            </div>
          </>
        ) : null}
        {/* With both times the duration is to − from: the minutes field steps aside. */}
        {day.window && validWindow({ from: blockFrom, to: blockTo }) ? null : (
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
        )}
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
