import { useState } from 'react';
import { t } from '@/strings';
import { SelectField, TextField } from '@/ui';
import { fmt2, num } from '../shared';
import styles from '../tools.module.css';
import { annuityLoan, compoundInterest, discount } from './finance';

const s = t.tools.calc.pro.finance;

function Money({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      autoComplete="off"
    />
  );
}

function Result({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className={styles.stack} role="status">
      {rows.map(([k, v]) => (
        <div key={k} className={styles.item}>
          <dt className={styles.label}>{k}</dt>
          <dd className={styles.result} style={{ margin: 0 }}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function DiscountPanel() {
  const [price, setPrice] = useState('');
  const [percent, setPercent] = useState('');
  const p = num(price);
  const r = num(percent);
  const d = p !== undefined && r !== undefined ? discount(p, r) : undefined;
  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <div className={styles.grow}>
          <Money label={s.discount.price} value={price} onChange={setPrice} />
        </div>
        <div className={styles.grow}>
          <Money label={s.discount.percent} value={percent} onChange={setPercent} />
        </div>
      </div>
      {d ? (
        <Result
          rows={[
            [s.discount.saving, fmt2(d.saving)],
            [s.discount.final, fmt2(d.final)],
          ]}
        />
      ) : null}
    </div>
  );
}

export function InterestPanel() {
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [years, setYears] = useState('');
  const [deposit, setDeposit] = useState('');
  const [perYear, setPerYear] = useState('1');
  const a = num(principal);
  const b = num(rate);
  const c = num(years);
  const m = deposit.trim() === '' ? 0 : num(deposit);
  const r =
    a !== undefined && b !== undefined && c !== undefined && m !== undefined
      ? compoundInterest(a, b, c, Number(perYear) as 1 | 2 | 4 | 12, m)
      : undefined;
  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <div className={styles.grow}>
          <Money label={s.interest.principal} value={principal} onChange={setPrincipal} />
        </div>
        <div className={styles.grow}>
          <Money label={s.interest.rate} value={rate} onChange={setRate} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.grow}>
          <Money label={s.interest.years} value={years} onChange={setYears} />
        </div>
        <div className={styles.grow}>
          <Money label={s.interest.deposit} value={deposit} onChange={setDeposit} />
        </div>
      </div>
      <SelectField
        label={s.interest.perYear}
        value={perYear}
        onChange={(e) => setPerYear(e.target.value)}
      >
        {Object.entries(s.interest.perYearOptions).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </SelectField>
      {r ? (
        <Result
          rows={[
            [s.interest.final, fmt2(r.final)],
            [s.interest.deposited, fmt2(r.deposited)],
            [s.interest.interest, fmt2(r.interest)],
          ]}
        />
      ) : null}
    </div>
  );
}

export function LoanPanel() {
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [years, setYears] = useState('');
  const a = num(amount);
  const b = num(rate);
  const c = num(years);
  const l =
    a !== undefined && b !== undefined && c !== undefined ? annuityLoan(a, b, c) : undefined;
  return (
    <div className={styles.stack}>
      <Money label={s.loan.amount} value={amount} onChange={setAmount} />
      <div className={styles.row}>
        <div className={styles.grow}>
          <Money label={s.loan.rate} value={rate} onChange={setRate} />
        </div>
        <div className={styles.grow}>
          <Money label={s.loan.years} value={years} onChange={setYears} />
        </div>
      </div>
      {l ? (
        <Result
          rows={[
            [s.loan.monthly, fmt2(l.monthly)],
            [s.loan.total, fmt2(l.total)],
            [s.loan.interest, fmt2(l.interest)],
          ]}
        />
      ) : null}
      <p className={styles.muted}>{s.loan.note}</p>
    </div>
  );
}
