import { useState } from 'react';
import {
  addDays,
  addMonths,
  addWorkdays,
  difference,
  weekInfo,
  workdaysBetween,
} from '@/core/calc/dates';
import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Segmented, SelectField, TextField } from '@/ui';
import { num } from '../shared';
import styles from '../tools.module.css';

const s = t.tools.dates;
const p = t.tools.calc.pro.date;
const UNITS = ['days', 'weeks', 'months', 'years', 'workdays'] as const;
type Unit = (typeof UNITS)[number];

export default function DateMode() {
  const [mode, setMode] = useState<'diff' | 'add'>('diff');
  // Read once on mount, not on every render.
  const [initial] = useState(today);
  return (
    <div className={styles.stack}>
      <Segmented
        label={t.tools.calc.modes.date!}
        value={mode}
        options={[
          { value: 'diff' as const, label: p.diff },
          { value: 'add' as const, label: p.add },
        ]}
        onChange={setMode}
      />
      {mode === 'diff' ? <Diff initial={initial} /> : <Add initial={initial} />}
      <p className={styles.muted}>{p.workdaysNote}</p>
    </div>
  );
}

function Diff({ initial }: { initial: string }) {
  const [a, setA] = useState(initial);
  const [b, setB] = useState(initial);
  const d = difference(a, b);
  const work = workdaysBetween(a, b);
  return (
    <>
      <div className={styles.row}>
        <div className={styles.grow}>
          <TextField label={s.from} type="date" value={a} onChange={(e) => setA(e.target.value)} />
        </div>
        <div className={styles.grow}>
          <TextField label={s.to} type="date" value={b} onChange={(e) => setB(e.target.value)} />
        </div>
      </div>
      <div role="status" aria-label={s.result}>
        {d ? (
          <>
            <p className={styles.result}>{s.between(d.days)}</p>
            {d.weeks > 0 ? <p className={styles.muted}>{s.weeks(d.weeks, d.rest)}</p> : null}
            {work !== undefined ? (
              <p className={styles.muted}>
                {p.workdays}: {Math.abs(work)}
              </p>
            ) : null}
          </>
        ) : (
          <p className={styles.muted}>{s.invalid}</p>
        )}
      </div>
    </>
  );
}

function Add({ initial }: { initial: string }) {
  const [start, setStart] = useState(initial);
  const [amount, setAmount] = useState('30');
  const [unit, setUnit] = useState<Unit>('days');
  const n = num(amount);
  const end =
    n === undefined
      ? undefined
      : unit === 'days'
        ? addDays(start, n)
        : unit === 'weeks'
          ? addDays(start, n * 7)
          : unit === 'months'
            ? addMonths(start, n)
            : unit === 'years'
              ? addMonths(start, n * 12)
              : addWorkdays(start, n);
  const info = end ? weekInfo(end) : undefined;
  return (
    <>
      <TextField
        label={s.start}
        type="date"
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />
      <div className={styles.row}>
        <div className={styles.grow}>
          <TextField
            label={p.amount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <div className={styles.grow}>
          <SelectField
            label={p.unit}
            value={unit}
            onChange={(e) => setUnit(e.target.value as Unit)}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {p.units[u]}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      <div role="status" aria-label={s.result}>
        {end && info ? (
          <>
            <p className={styles.result}>{formatDay(end, 'EEEE, d. MMMM yyyy')}</p>
            <p className={styles.muted}>
              {s.week}: {info.week}
            </p>
          </>
        ) : (
          <p className={styles.muted}>{s.invalid}</p>
        )}
      </div>
    </>
  );
}
