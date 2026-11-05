import { useState } from 'react';
import { formatMinutes } from '@/core/i18n/format';
import { dayName } from '@/core/plan/explain';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Dialog, Icon, IconButton } from '@/ui';
import { AVAILABLE_STEP, confirmWeek } from '../actions';
import type { BoardDay } from '../board';
import styles from '../routes/planner.module.css';

/** „Woche prüfen“: the available minutes of every shown day, confirmed in two taps (open, „Passt so“). */
export function WeekCheck({
  days,
  titles,
  onClose,
}: {
  days: BoardDay[];
  titles: Record<string, string>;
  onClose: () => void;
}) {
  const [values, setValues] = useState(() => days.map((d) => d.availableMin));
  const compact = (min: number) =>
    min === 0 ? t.planner.board.off : formatMinutes(min, { compact: true });
  const change = (i: number, delta: number) =>
    setValues((v) => v.map((x, j) => (j === i ? Math.max(0, x + delta) : x)));
  const confirm = () => {
    void confirmWeek(
      days.map((d, i) => ({ date: d.date, availableMin: values[i]!, current: d.availableMin })),
      titles,
    );
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={t.planner.check.title}
      footer={
        <Button variant="primary" onClick={confirm} data-autofocus>
          {t.planner.check.confirm}
        </Button>
      }
    >
      <p className={styles.capacity}>{t.planner.check.intro}</p>
      {days.map((d, i) => (
        <div key={d.date} className={styles.weekRow}>
          <span>{formatDay(d.date, 'EEE, d. MMM')}</span>
          <span className={styles.stepper}>
            <IconButton
              label={t.planner.day.lessOn(dayName(d.date))}
              onClick={() => change(i, -AVAILABLE_STEP)}
              disabled={values[i] === 0}
            >
              <Icon name="minus" />
            </IconButton>
            <span className={styles.sheetValue}>{compact(values[i]!)}</span>
            <IconButton
              label={t.planner.day.moreOn(dayName(d.date))}
              onClick={() => change(i, AVAILABLE_STEP)}
            >
              <Icon name="plus" />
            </IconButton>
          </span>
        </div>
      ))}
    </Dialog>
  );
}
