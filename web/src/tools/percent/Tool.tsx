import { useState } from 'react';
import { t } from '@/strings';
import { SelectField, TextField } from '@/ui';
import { fmt, fmt2, num } from '../shared';
import styles from '../tools.module.css';
import { percentOf, shareOf, vat } from './logic';

const s = t.tools.percent;

export default function PercentTool() {
  const [p, setP] = useState('');
  const [whole, setWhole] = useState('');
  const [part, setPart] = useState('');
  const [whole2, setWhole2] = useState('');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('19');
  const [custom, setCustom] = useState('');
  const [fromNet, setFromNet] = useState('net');

  const pv = num(p);
  const wv = num(whole);
  const partValue = pv !== undefined && wv !== undefined ? percentOf(pv, wv) : undefined;
  const a = num(part);
  const b = num(whole2);
  const shareValue = a !== undefined && b !== undefined ? shareOf(a, b) : undefined;
  const rateValue = rate === 'custom' ? num(custom) : Number(rate);
  const av = num(amount);
  const tax =
    av !== undefined && rateValue !== undefined ? vat(av, rateValue, fromNet === 'net') : undefined;

  return (
    <div className={styles.stack}>
      <section className={styles.stack} aria-label={s.part}>
        <h3>{s.part}</h3>
        <p className={styles.muted}>{s.partIntro}</p>
        <div className={styles.row}>
          <div className={styles.grow}>
            <TextField
              label={s.percent}
              value={p}
              onChange={(e) => setP(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
          </div>
          <div className={styles.grow}>
            <TextField
              label={`${s.of} ${s.whole}`}
              value={whole}
              onChange={(e) => setWhole(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
          </div>
        </div>
        <p className={styles.result} role="status" aria-label={s.result}>
          {partValue !== undefined ? fmt(partValue) : '–'}
        </p>
      </section>

      <section className={styles.stack} aria-label={s.share}>
        <h3>{s.share}</h3>
        <p className={styles.muted}>{s.shareIntro}</p>
        <div className={styles.row}>
          <div className={styles.grow}>
            <TextField
              label={s.partValue}
              value={part}
              onChange={(e) => setPart(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
          </div>
          <div className={styles.grow}>
            <TextField
              label={s.wholeValue}
              value={whole2}
              onChange={(e) => setWhole2(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
          </div>
        </div>
        <p className={styles.result} role="status" aria-label={`${s.share}: ${s.result}`}>
          {shareValue !== undefined ? `${fmt(shareValue)} %` : '–'}
        </p>
      </section>

      <section className={styles.stack} aria-label={s.vat}>
        <h3>{s.vat}</h3>
        <div className={styles.row}>
          <div className={styles.grow}>
            <TextField
              label={s.amount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
          </div>
          <div className={styles.grow}>
            <SelectField label={s.rate} value={rate} onChange={(e) => setRate(e.target.value)}>
              {Object.entries(s.rates).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
        {rate === 'custom' ? (
          <TextField
            label={s.customRate}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
          />
        ) : null}
        <SelectField
          label={s.amount + '?'}
          value={fromNet}
          onChange={(e) => setFromNet(e.target.value)}
        >
          <option value="net">{s.fromNet}</option>
          <option value="gross">{s.fromGross}</option>
        </SelectField>
        {tax ? (
          <dl className={styles.list} aria-label={s.result}>
            <div className={styles.item}>
              <dt>{s.net}</dt>
              <dd>{fmt2(tax.net)}</dd>
            </div>
            <div className={styles.item}>
              <dt>{s.tax}</dt>
              <dd>{fmt2(tax.tax)}</dd>
            </div>
            <div className={styles.item}>
              <dt>{s.gross}</dt>
              <dd>{fmt2(tax.gross)}</dd>
            </div>
          </dl>
        ) : (
          <p className={styles.muted}>{s.invalid}</p>
        )}
      </section>
    </div>
  );
}
