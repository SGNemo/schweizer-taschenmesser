import { useState, type FormEvent } from 'react';
import { CalcError, evaluate } from '@/core/calc/expr';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, TextField } from '@/ui';
import { copyText, fmt, readStored, writeStored } from '../shared';
import styles from '../tools.module.css';

const s = t.tools.calc;
const KEY = 'tm-calc-history';
const MAX = 12;

interface Entry {
  expr: string;
  result: number;
}

function loadHistory(): Entry[] {
  try {
    const parsed: unknown = JSON.parse(readStored(KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed
          .filter((e): e is Entry => typeof e?.expr === 'string' && Number.isFinite(e?.result))
          .slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

export default function ExprMode() {
  const toast = useUiStore((st) => st.toast);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<number | undefined>();
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Entry[]>(loadHistory);

  function calculate(e?: FormEvent) {
    e?.preventDefault();
    try {
      const value = evaluate(input);
      setResult(value);
      setError('');
      const next = [
        { expr: input.trim(), result: value },
        ...history.filter((h) => h.expr !== input.trim()),
      ].slice(0, MAX);
      setHistory(next);
      writeStored(KEY, JSON.stringify(next));
    } catch (err) {
      setResult(undefined);
      setError(
        err instanceof CalcError ? (s.errors[err.code] ?? s.errors.syntax!) : s.errors.syntax!,
      );
    }
  }

  async function copy() {
    if (result !== undefined && (await copyText(String(result).replace('.', ',')))) toast(s.copied);
  }

  return (
    <div className={styles.stack}>
      <form onSubmit={calculate} className={styles.stack}>
        <TextField
          label={s.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={s.placeholder}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          data-autofocus
        />
        <div className={styles.row}>
          <Button type="submit" variant="primary">
            {s.equals}
          </Button>
          {result !== undefined ? <Button onClick={() => void copy()}>{s.copy}</Button> : null}
        </div>
      </form>
      {result !== undefined ? (
        <p className={styles.big} role="status" data-testid="calc-result">
          {fmt(result)}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {history.length > 0 ? (
        <section aria-label={s.history}>
          <h3>{s.history}</h3>
          <ul className={styles.list}>
            {history.map((h) => (
              <li key={h.expr} className={styles.item}>
                <button
                  type="button"
                  className={styles.mono}
                  style={{
                    background: 'none',
                    border: 0,
                    color: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  onClick={() => setInput(h.expr)}
                >
                  {h.expr}
                </button>
                <span>= {fmt(h.result)}</span>
              </li>
            ))}
          </ul>
          <Button
            onClick={() => {
              setHistory([]);
              writeStored(KEY, '[]');
            }}
          >
            {s.clear}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
