import { formatMoney, formatMoneyInput, parseMoney } from '@/core/money';
import { t } from '@/strings';
import { Button, Icon, patternStyles, SelectField, TextField } from '@/ui';
import styles from '../routes/finance.module.css';

/** One row of the editor: the amount stays a string while it is typed. */
export interface SplitRow {
  categoryId: string;
  amount: string;
}

/** The rows as stored splits; rows without a valid amount are dropped. */
export function rowsToSplits(
  rows: readonly SplitRow[],
): { categoryId?: string; amountMinor: number }[] {
  return rows.flatMap((r) => {
    const amountMinor = parseMoney(r.amount);
    return amountMinor && amountMinor > 0
      ? [{ categoryId: r.categoryId || undefined, amountMinor }]
      : [];
  });
}

export const splitsToRows = (
  splits: readonly { categoryId?: string; amountMinor: number }[],
): SplitRow[] =>
  splits.map((s) => ({ categoryId: s.categoryId ?? '', amount: formatMoneyInput(s.amountMinor) }));

/**
 * Splits one amount over several categories (a shop receipt: food and household). The remainder
 * is shown as text with a button to hand it to the last part, so the sum never needs a calculator.
 */
export function SplitEditor({
  rows,
  onChange,
  totalMinor,
  currency,
  categories,
}: {
  rows: SplitRow[];
  onChange: (rows: SplitRow[]) => void;
  totalMinor: number;
  currency: string;
  categories: { id: string; name: string }[];
}) {
  const sum = rowsToSplits(rows).reduce((s, p) => s + p.amountMinor, 0);
  const rest = totalMinor - sum;
  const money = (m: number) => formatMoney(Math.abs(m), currency);
  const e = t.finance.ext.split;
  const set = (i: number, patch: Partial<SplitRow>) =>
    onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <fieldset className={styles.splitBox}>
      <legend>{e.hint}</legend>
      {rows.map((r, i) => (
        <div key={i} className={styles.splitRow}>
          <SelectField
            label={e.part(i + 1)}
            value={r.categoryId}
            onChange={(ev) => set(i, { categoryId: ev.target.value })}
          >
            <option value="">{t.finance.noCategory}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t.money.amount}
            inputMode="decimal"
            value={r.amount}
            onChange={(ev) => set(i, { amount: ev.target.value })}
          />
          {rows.length > 2 ? (
            <Button
              variant="ghost"
              aria-label={e.remove}
              onClick={() => onChange(rows.filter((_, k) => k !== i))}
            >
              <Icon name="trash" size={18} />
            </Button>
          ) : null}
        </div>
      ))}
      <div className={patternStyles.hstackCenter}>
        <Button variant="ghost" onClick={() => onChange([...rows, { categoryId: '', amount: '' }])}>
          <Icon name="plus" size={18} />
          {e.add}
        </Button>
        <span role="status" className={rest === 0 ? styles.muted : styles.negative}>
          {rest === 0 ? e.balanced : rest > 0 ? e.rest(money(rest)) : e.over(money(rest))}
        </span>
      </div>
    </fieldset>
  );
}
