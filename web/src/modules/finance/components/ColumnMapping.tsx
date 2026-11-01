/**
 * "Which column is the date / amount / payee / purpose?" for a bank CSV nobody knows. The best guess
 * is preselected (from the column names, then from what the first rows look like), the first rows are
 * shown, and the answer is remembered for the next export with the same header.
 */
import { useMemo, useState } from 'react';
import { parseDateInput } from '@/core/io/dates';
import { parseLooseAmount } from '@/core/io/amount';
import type { BankCsvInspection } from '@/core/io/bank';
import { t } from '@/strings';
import { Button, SelectField } from '@/ui';
import type { StoredMapping } from '../bankMemory';
import styles from './columnMapping.module.css';

const NONE = '';

/** First column whose name contains one of the words, else the first whose rows pass `looks`. */
function guess(
  inspection: BankCsvInspection,
  words: readonly string[],
  looks: ((cell: string) => boolean) | undefined,
  taken: ReadonlySet<string>,
): string {
  const free = inspection.keys.map((k, i) => ({ k, i })).filter((c) => c.k && !taken.has(c.k));
  const byName = free.find((c) => words.some((w) => c.k.includes(w)));
  if (byName) return byName.k;
  if (looks) {
    const byContent = free.find((c) =>
      inspection.sample.every((row) => looks((row[c.i] ?? '').trim())),
    );
    if (byContent) return byContent.k;
  }
  return NONE;
}

export function guessMapping(inspection: BankCsvInspection): StoredMapping {
  const taken = new Set<string>();
  const take = (key: string): string => {
    if (key) taken.add(key);
    return key;
  };
  const date = take(
    guess(inspection, ['datum', 'date', 'buchung', 'valuta'], (c) => !!parseDateInput(c), taken),
  );
  const amount = take(
    guess(
      inspection,
      ['betrag', 'amount', 'umsatz', 'summe'],
      (c) => c !== '' && parseLooseAmount(c) !== undefined,
      taken,
    ),
  );
  const payee = take(
    guess(
      inspection,
      ['empfanger', 'beguenstigt', 'begunstigt', 'auftraggeber', 'name', 'partner', 'payee'],
      undefined,
      taken,
    ),
  );
  const purpose = take(
    guess(
      inspection,
      ['zweck', 'verwendung', 'text', 'reference', 'referenz', 'memo'],
      undefined,
      taken,
    ),
  );
  return {
    date,
    amount,
    ...(payee ? { payee } : {}),
    ...(purpose ? { purpose } : {}),
    delimiter: inspection.delimiter,
  };
}

export function ColumnMapping({
  inspection,
  busy,
  onSubmit,
}: {
  inspection: BankCsvInspection;
  busy: boolean;
  onSubmit: (mapping: StoredMapping) => void;
}) {
  const s = t.finance.bankMap;
  const initial = useMemo(() => guessMapping(inspection), [inspection]);
  const [date, setDate] = useState(initial.date);
  const [amount, setAmount] = useState(initial.amount);
  const [payee, setPayee] = useState(initial.payee ?? NONE);
  const [purpose, setPurpose] = useState(initial.purpose ?? NONE);
  const picked = new Set([date, amount, payee, purpose].filter(Boolean));

  const options = (optional: boolean) => (
    <>
      <option value={NONE}>{optional ? s.none : s.choose}</option>
      {inspection.header.map((name, i) => {
        const key = inspection.keys[i]!;
        return key ? (
          <option key={`${key}-${i}`} value={key}>
            {name}
          </option>
        ) : null;
      })}
    </>
  );

  return (
    <section className={styles.box} aria-label={s.title}>
      <h4 className={styles.title}>{s.title}</h4>
      <p className={styles.hint}>{s.hint}</p>
      <div className={styles.fields}>
        <SelectField label={s.date} value={date} onChange={(e) => setDate(e.target.value)}>
          {options(false)}
        </SelectField>
        <SelectField label={s.amount} value={amount} onChange={(e) => setAmount(e.target.value)}>
          {options(false)}
        </SelectField>
        <SelectField label={s.payee} value={payee} onChange={(e) => setPayee(e.target.value)}>
          {options(true)}
        </SelectField>
        <SelectField label={s.purpose} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
          {options(true)}
        </SelectField>
      </div>
      <div className={styles.sample}>
        <table className={styles.table} aria-label={s.sample}>
          <thead>
            <tr>
              {inspection.header.map((name, i) => (
                <th key={i} className={picked.has(inspection.keys[i]!) ? styles.picked : undefined}>
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inspection.sample.map((row, r) => (
              <tr key={r}>
                {inspection.header.map((_, i) => (
                  <td
                    key={i}
                    className={picked.has(inspection.keys[i]!) ? styles.picked : undefined}
                  >
                    {row[i] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.bar}>
        <Button
          variant="primary"
          disabled={busy || !date || !amount || date === amount}
          onClick={() =>
            onSubmit({
              date,
              amount,
              ...(payee ? { payee } : {}),
              ...(purpose ? { purpose } : {}),
              delimiter: inspection.delimiter,
            })
          }
        >
          {s.apply}
        </Button>
      </div>
    </section>
  );
}
