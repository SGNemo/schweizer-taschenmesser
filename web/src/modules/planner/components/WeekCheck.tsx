import { useState } from 'react';
import { formatMinutes } from '@/core/i18n/format';
import { dayName } from '@/core/plan/explain';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Dialog, Icon, IconButton, Segmented } from '@/ui';
import { AVAILABLE_STEP, confirmWeek, WEEK_TEMPLATES, type WeekTemplate } from '../actions';
import type { BoardDay } from '../board';
import styles from '../routes/planner.module.css';

/**
 * „Woche prüfen“: the available minutes of every shown day (Mo–So when opened on a Monday), confirmed
 * in two taps (open, „Passt so“), and the three biggest things of the week. Opened only by the user
 * (⋯ or the Monday line), never by itself. Package 5: one choice of a template fills the days –
 * „Arbeitswoche“ (the weekday times of the settings), „Urlaub“ (every shown day free), „Krank“ (today
 * free; more days with −) – nothing is stored before „Passt so“, which writes only these days, one undo.
 */
export function WeekCheck({
  days,
  biggest = [],
  titles,
  onClose,
}: {
  days: BoardDay[];
  /** The three biggest things of the week (all sessions together), largest first. */
  biggest?: { title: string; minutes: number }[];
  titles: Record<string, string>;
  onClose: () => void;
}) {
  const [values, setValues] = useState(() => days.map((d) => d.availableMin));
  const [template, setTemplate] = useState<WeekTemplate | ''>('');
  const pick = (next: WeekTemplate | '') => {
    setTemplate(next);
    if (next === 'work') setValues(days.map((d) => d.defaultMin));
    else if (next === 'vacation') setValues(days.map(() => 0));
    else if (next === 'sick') setValues(days.map((d, i) => (i === 0 ? 0 : d.availableMin)));
  };
  const compact = (min: number) =>
    min === 0 ? t.planner.board.off : formatMinutes(min, { compact: true });
  const change = (i: number, delta: number) =>
    setValues((v) => v.map((x, j) => (j === i ? Math.max(0, x + delta) : x)));
  const confirm = () => {
    void confirmWeek(
      days.map((d, i) => ({
        date: d.date,
        availableMin: values[i]!,
        current: d.availableMin,
        defaultMin: d.defaultMin,
      })),
      titles,
      template || undefined,
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
      <Segmented
        label={t.planner.check.template}
        value={template}
        options={WEEK_TEMPLATES.map((id) => ({ value: id, label: t.planner.check.templates[id] }))}
        onChange={pick}
      />
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
      {biggest.length > 0 ? (
        <section className={styles.biggest} aria-label={t.planner.check.biggest}>
          <h3 className={styles.dayName}>{t.planner.check.biggest}</h3>
          <ol>
            {biggest.map((b) => (
              <li key={b.title}>
                {b.title} ·{' '}
                <span className={styles.minutes}>
                  {formatMinutes(b.minutes, { compact: true })}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </Dialog>
  );
}
