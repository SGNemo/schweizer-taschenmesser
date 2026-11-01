import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, SelectField, TextField } from '@/ui';
import { fmt2, num, readStored, writeStored } from '../shared';
import styles from '../tools.module.css';
import { convert, currencies, parseRates, type Rates } from './logic';

const s = t.tools.currency;
const URL = 'https://api.frankfurter.dev/v1/latest?base=EUR';
const CACHE = 'tm-currency-rates';

function cached(): Rates | undefined {
  try {
    return parseRates(JSON.parse(readStored(CACHE) ?? 'null'));
  } catch {
    return undefined;
  }
}

/** Fresh rates if the network answers, otherwise the last stored ones. */
export async function loadRates(): Promise<{ rates: Rates; live: boolean } | undefined> {
  try {
    const res = await getPlatform().fetch(URL);
    if (res.ok) {
      const json: unknown = await res.json();
      const rates = parseRates(json);
      if (rates) {
        writeStored(CACHE, JSON.stringify({ date: rates.date, rates: rates.rates }));
        return { rates, live: true };
      }
    }
  } catch {
    // Offline: fall through to the cache.
  }
  const old = cached();
  return old ? { rates: old, live: false } : undefined;
}

const names = new Intl.DisplayNames('de', { type: 'currency' });
const label = (code: string) => {
  try {
    return `${code} – ${names.of(code) ?? code}`;
  } catch {
    return code;
  }
};

export default function CurrencyTool() {
  const [data, setData] = useState<{ rates: Rates; live: boolean } | null | undefined>();
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState('EUR');
  const [to, setTo] = useState('USD');

  useEffect(() => {
    let alive = true;
    void loadRates().then((r) => alive && setData(r ?? null));
    return () => {
      alive = false;
    };
  }, []);

  if (data === undefined) return <p role="status">{s.loading}</p>;
  if (data === null)
    return (
      <p className={styles.error} role="alert">
        {s.failed}
      </p>
    );

  const list = currencies(data.rates);
  const a = num(amount);
  const result = a !== undefined ? convert(a, from, to, data.rates) : undefined;
  const one = convert(1, from, to, data.rates);
  const date = formatDay(data.rates.date, 'd. MMMM yyyy');

  return (
    <div className={styles.stack}>
      <TextField
        label={s.amount}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        autoComplete="off"
        data-autofocus
      />
      <div className={styles.row}>
        <div className={styles.grow}>
          <SelectField label={s.from} value={from} onChange={(e) => setFrom(e.target.value)}>
            {list.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </SelectField>
        </div>
        <Button
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          {s.swap}
        </Button>
        <div className={styles.grow}>
          <SelectField label={s.to} value={to} onChange={(e) => setTo(e.target.value)}>
            {list.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      <p className={styles.big} role="status" aria-label={s.result} data-testid="currency-result">
        {result !== undefined ? `${fmt2(result)} ${to}` : s.invalid}
      </p>
      {one !== undefined ? <p className={styles.muted}>{s.rate(from, to, fmt2(one))}</p> : null}
      <p className={styles.muted}>{data.live ? s.asOf(date) : s.cached(date)}</p>
    </div>
  );
}
