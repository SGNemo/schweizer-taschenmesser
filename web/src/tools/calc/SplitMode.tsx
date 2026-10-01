import { useState } from 'react';
import { t } from '@/strings';
import { Checkbox, TextField } from '@/ui';
import { fmt2, num } from '../shared';
import styles from '../tools.module.css';
import { splitBill } from './split';

const s = t.tools.calc.split;

export default function SplitMode() {
  const [total, setTotal] = useState('');
  const [people, setPeople] = useState('2');
  const [tip, setTip] = useState('0');
  const [round, setRound] = useState(false);
  const totalValue = num(total);
  const peopleValue = num(people);
  const tipValue = num(tip);
  const result =
    totalValue !== undefined && peopleValue !== undefined && tipValue !== undefined
      ? splitBill(totalValue, peopleValue, tipValue, round)
      : undefined;

  return (
    <div className={styles.stack}>
      <TextField
        label={s.total}
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        inputMode="decimal"
        autoComplete="off"
      />
      <div className={styles.row}>
        <div className={styles.grow}>
          <TextField
            label={s.people}
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <div className={styles.grow}>
          <TextField
            label={s.tip}
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
          />
        </div>
      </div>
      <Checkbox label={s.round} checked={round} onChange={(e) => setRound(e.target.checked)} />
      {result && total.trim() ? (
        <dl className={styles.list} aria-label={s.perPerson}>
          <div className={styles.item}>
            <dt>{s.tipAmount}</dt>
            <dd>{fmt2(result.tip)}</dd>
          </div>
          <div className={styles.item}>
            <dt>{s.sum}</dt>
            <dd>{fmt2(result.sum)}</dd>
          </div>
          <div className={styles.item}>
            <dt>
              <strong>{s.perPerson}</strong>
            </dt>
            <dd role="status">
              <strong>{fmt2(result.perPerson)}</strong>
            </dd>
          </div>
        </dl>
      ) : (
        <p className={styles.muted}>{s.invalid}</p>
      )}
    </div>
  );
}
