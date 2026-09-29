import { t } from '@/strings';
import { SelectField, TextField } from '@/ui';
import { weekdayShort } from './describe';
import type { Recurrence } from './types';
import styles from './RecurrenceEditor.module.css';

type Freq = Recurrence['freq'];
const UNIT: Record<Freq, string> = {
  daily: t.recurrence.daysUnit,
  weekly: t.recurrence.weeksUnit,
  monthly: t.recurrence.monthsUnit,
  yearly: t.recurrence.yearsUnit,
};

interface Props {
  value: Recurrence | undefined;
  onChange: (value: Recurrence | undefined) => void;
  /** Start date; used to pre-select sensible weekday / month day defaults. */
  startDate: string;
}

function ends(r: Recurrence): 'never' | 'until' | 'count' {
  return r.until ? 'until' : r.count ? 'count' : 'never';
}

/** Form control for a recurrence rule (shared by reminders, calendar, subscriptions …). */
export function RecurrenceEditor({ value, onChange, startDate }: Props) {
  const set = (patch: Partial<Recurrence>) => value && onChange({ ...value, ...patch });

  function changeFreq(freq: string) {
    if (freq === 'none') return onChange(undefined);
    const f = freq as Freq;
    const day = Number(startDate.slice(8, 10)) || 1;
    onChange({
      freq: f,
      interval: 1,
      ...(f === 'monthly' ? { byMonthDay: day } : {}),
    });
  }

  function toggleWeekday(wd: number) {
    if (!value) return;
    const cur = value.byWeekday ?? [];
    const next = cur.includes(wd)
      ? cur.filter((d) => d !== wd)
      : [...cur, wd].sort((a, b) => a - b);
    set({ byWeekday: next.length ? next : undefined });
  }

  return (
    <div className={styles.wrap}>
      <SelectField
        label={t.recurrence.label}
        value={value?.freq ?? 'none'}
        onChange={(e) => changeFreq(e.target.value)}
      >
        <option value="none">{t.recurrence.none}</option>
        <option value="daily">{t.recurrence.daily}</option>
        <option value="weekly">{t.recurrence.weekly}</option>
        <option value="monthly">{t.recurrence.monthly}</option>
        <option value="yearly">{t.recurrence.yearly}</option>
      </SelectField>

      {value ? (
        <>
          <div className={styles.row}>
            <div className={styles.grow}>
              <TextField
                label={`${t.recurrence.every} (${UNIT[value.freq]})`}
                type="number"
                min={1}
                max={999}
                value={value.interval ?? 1}
                onChange={(e) =>
                  set({ interval: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })
                }
              />
            </div>
            {value.freq === 'monthly' ? (
              <div className={styles.grow}>
                <SelectField
                  label={t.recurrence.monthDay}
                  value={String(value.byMonthDay ?? '')}
                  onChange={(e) =>
                    set({ byMonthDay: e.target.value ? Number(e.target.value) : undefined })
                  }
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}.
                    </option>
                  ))}
                  <option value="-1">{t.recurrence.lastDay}</option>
                </SelectField>
              </div>
            ) : null}
          </div>

          {value.freq === 'weekly' ? (
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{t.recurrence.weekdays}</legend>
              <div className={styles.chips}>
                {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
                  <button
                    key={wd}
                    type="button"
                    className={styles.chip}
                    aria-pressed={value.byWeekday?.includes(wd) ?? false}
                    onClick={() => toggleWeekday(wd)}
                  >
                    {weekdayShort(wd)}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className={styles.row}>
            <div className={styles.grow}>
              <SelectField
                label={t.recurrence.ends}
                value={ends(value)}
                onChange={(e) => {
                  const v = e.target.value;
                  set({
                    until: v === 'until' ? startDate : undefined,
                    count: v === 'count' ? 10 : undefined,
                  });
                }}
              >
                <option value="never">{t.recurrence.endsNever}</option>
                <option value="until">{t.recurrence.endsOn}</option>
                <option value="count">{t.recurrence.endsAfter}</option>
              </SelectField>
            </div>
            {value.until ? (
              <div className={styles.grow}>
                <TextField
                  label={t.recurrence.endDate}
                  type="date"
                  min={startDate}
                  value={value.until}
                  onChange={(e) => e.target.value && set({ until: e.target.value })}
                />
              </div>
            ) : null}
            {value.count ? (
              <div className={styles.grow}>
                <TextField
                  label={t.recurrence.count}
                  type="number"
                  min={1}
                  value={value.count}
                  onChange={(e) => set({ count: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
