import { useState } from 'react';
import { t } from '@/strings';
import { Button, TextArea, TextField } from '@/ui';
import { num } from '../shared';
import styles from '../tools.module.css';
import { flipCoin, pickLine, randomBetween, rollDice } from './logic';

const s = t.tools.dice;

export default function DiceTool() {
  return (
    <div className={styles.stack}>
      <Dice />
      <Coin />
      <RandomNumber />
      <Pick />
    </div>
  );
}

function Dice() {
  const [count, setCount] = useState('1');
  const [sides, setSides] = useState('6');
  const [rolled, setRolled] = useState<ReturnType<typeof rollDice>>();
  const [failed, setFailed] = useState(false);
  function roll() {
    const r = rollDice(num(count) ?? NaN, num(sides) ?? NaN);
    setRolled(r);
    setFailed(!r);
  }
  return (
    <section className={styles.stack} aria-label={s.dice}>
      <h3>{s.dice}</h3>
      <div className={styles.row}>
        <div className={styles.grow}>
          <TextField
            label={s.count}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <div className={styles.grow}>
          <TextField
            label={s.sides}
            value={sides}
            onChange={(e) => setSides(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <Button onClick={roll}>{s.roll}</Button>
      </div>
      <div role="status" aria-label={s.dice}>
        {failed ? <p className={styles.error}>{s.invalid}</p> : null}
        {rolled ? (
          <>
            <p className={styles.big}>{rolled.rolls.join(' · ')}</p>
            {rolled.rolls.length > 1 ? (
              <p className={styles.muted}>{s.total(rolled.total)}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function Coin() {
  const [side, setSide] = useState<'heads' | 'tails'>();
  return (
    <section className={styles.stack} aria-label={s.coin}>
      <h3>{s.coin}</h3>
      <div className={styles.row}>
        <Button onClick={() => setSide(flipCoin())}>{s.coin}</Button>
      </div>
      <p className={styles.big} role="status" aria-label={s.coin}>
        {side ? (side === 'heads' ? s.heads : s.tails) : ''}
      </p>
    </section>
  );
}

function RandomNumber() {
  const [min, setMin] = useState('1');
  const [max, setMax] = useState('100');
  const [value, setValue] = useState<number>();
  const [failed, setFailed] = useState(false);
  function draw() {
    const n = randomBetween(num(min) ?? NaN, num(max) ?? NaN);
    setValue(n);
    setFailed(n === undefined);
  }
  return (
    <section className={styles.stack} aria-label={s.number}>
      <h3>{s.number}</h3>
      <div className={styles.row}>
        <div className={styles.grow}>
          <TextField
            label={s.min}
            value={min}
            onChange={(e) => setMin(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <div className={styles.grow}>
          <TextField
            label={s.max}
            value={max}
            onChange={(e) => setMax(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <Button onClick={draw}>{s.draw}</Button>
      </div>
      <div role="status" aria-label={s.number}>
        {failed ? <p className={styles.error}>{s.invalid}</p> : null}
        {value !== undefined ? <p className={styles.big}>{value}</p> : null}
      </div>
    </section>
  );
}

function Pick() {
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState<string>();
  return (
    <section className={styles.stack} aria-label={s.pick}>
      <h3>{s.pick}</h3>
      <TextArea label={s.options} value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      <div className={styles.row}>
        <Button onClick={() => setChosen(pickLine(text))}>{s.draw}</Button>
      </div>
      <p className={styles.result} role="status" aria-label={s.pick}>
        {chosen ? `${s.chosen} ${chosen}` : ''}
      </p>
    </section>
  );
}
