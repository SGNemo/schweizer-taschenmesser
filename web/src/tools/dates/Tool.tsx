import { useState } from 'react';
import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Segmented, TextField } from '@/ui';
import { num } from '../shared';
import styles from '../tools.module.css';
import { addDays, difference, weekInfo } from './logic';

const s = t.tools.dates;

export default function DatesTool() {
  const [mode, setMode] = useState<'diff' | 'add'>('diff');
  // The initial value is read once on mount, not on every render.
  const [initial] = useState(today);
  return (
    <div className={styles.stack}>
      <Segmented
        label={s.name}
        value={mode}
        options={[
          { value: 'diff' as const, label: s.diff },
          { value: 'add' as const, label: s.add },
        ]}
        onChange={setMode}
      />
      {mode === 'diff' ? <Diff initial={initial} /> : <Add initial={initial} />}
    </div>
  );
}

function Diff({ initial }: { initial: string }) {
  const [a, setA] = useState(initial);
  const [b, setB] = useState(initial);
  const d = difference(a, b);
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
  const [days, setDays] = useState('30');
  const n = num(days);
  const end = n !== undefined ? addDays(start, n) : undefined;
  const info = end ? weekInfo(end) : undefined;
  return (
    <>
      <div className={styles.row}>
        <div className={styles.grow}>
          <TextField
            label={s.start}
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className={styles.grow}>
          <TextField
            label={s.days}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
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
