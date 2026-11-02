import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  copyValue,
  evaluateExpression,
  preloadEngine,
  type AngleMode,
  type EvalResult,
} from '@/core/calc/engine';
import { CalcError } from '@/core/calc/expr';
import { t } from '@/strings';
import { Button, Segmented, TextField } from '@/ui';
import { copyWithToast, useSaveAsNote } from '../shared';
import styles from '../tools.module.css';
import {
  historyText,
  loadHistory,
  pushHistory,
  saveHistory,
  searchHistory,
  type HistoryEntry,
} from './history';
import { session } from './session';

const s = t.tools.calc;

/** Keys that insert text at the cursor: [label, inserted text, accessible name]. */
const BASIC_KEYS: Array<[string, string]> = [
  ['(', '('],
  [')', ')'],
  ['%', '%'],
  ['^', '^'],
  ['÷', '÷'],
  ['×', '×'],
];
const SCI_KEYS: Array<[string, string]> = [
  ['sin', 'sin('],
  ['cos', 'cos('],
  ['tan', 'tan('],
  ['asin', 'asin('],
  ['acos', 'acos('],
  ['atan', 'atan('],
  ['ln', 'ln('],
  ['log', 'log10('],
  ['√', 'sqrt('],
  ['x²', '^2'],
  ['n!', '!'],
  ['π', 'pi'],
  ['e', 'e'],
  [';', ';'],
];

export default function ExprMode({
  scientific,
  angle,
  onAngle,
}: {
  scientific: boolean;
  angle: AngleMode;
  onAngle: (a: AngleMode) => void;
}) {
  const saveAsNote = useSaveAsNote();
  const field = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [live, setLive] = useState<EvalResult | undefined>();
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [search, setSearch] = useState('');

  useEffect(() => preloadEngine(), []);

  // Live result while typing. It works on a copy of the variables so that `a = 5` only counts on Enter,
  // and stays quiet while the expression is still incomplete.
  useEffect(() => {
    if (input.trim() === '') return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void evaluateExpression(input, { angle, vars: new Map(session.vars) }).then(
        (r) => !cancelled && setLive(r),
        () => !cancelled && setLive(undefined),
      );
    }, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [input, angle]);

  async function commit(e?: FormEvent) {
    e?.preventDefault();
    if (input.trim() === '') return;
    try {
      const r = await evaluateExpression(input, { angle, vars: session.vars });
      setLive(r);
      setError('');
      const next = pushHistory(history, { expr: input.trim(), result: r.display });
      setHistory(next);
      saveHistory(next);
    } catch (err) {
      setError(
        err instanceof CalcError ? (s.errors[err.code] ?? s.errors.syntax!) : s.errors.syntax!,
      );
    }
  }

  function insert(text: string) {
    const el = field.current;
    const from = el?.selectionStart ?? input.length;
    const to = el?.selectionEnd ?? input.length;
    const next = input.slice(0, from) + text + input.slice(to);
    setInput(next);
    setError('');
    requestAnimationFrame(() => {
      el?.focus();
      const pos = from + text.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && input !== '') {
      // First Escape clears the line; a second one reaches the dialog and closes it.
      e.stopPropagation();
      setInput('');
      setError('');
    } else if (e.key === 'ArrowUp' && input === '' && history[0]) {
      e.preventDefault();
      setInput(history[0].expr);
    }
  }

  const shown = searchHistory(history, search);

  return (
    <div className={styles.stack}>
      {scientific ? (
        <Segmented
          label={s.pro.angle}
          value={angle}
          options={[
            { value: 'deg' as const, label: s.pro.deg },
            { value: 'rad' as const, label: s.pro.rad },
          ]}
          onChange={onAngle}
        />
      ) : null}
      <form onSubmit={(e) => void commit(e)} className={styles.stack}>
        <TextField
          ref={field}
          label={s.input}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError('');
          }}
          onKeyDown={onKeyDown}
          placeholder={s.placeholder}
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          data-autofocus
        />
        <div className={styles.keys} role="group" aria-label={s.pro.keys}>
          {(scientific ? [...BASIC_KEYS, ...SCI_KEYS] : BASIC_KEYS).map(([label, text]) => (
            <Button key={label} size="sm" onClick={() => insert(text)}>
              {label}
            </Button>
          ))}
          <Button size="sm" onClick={() => insert('ans')} aria-label={s.pro.ans}>
            {'ans'}
          </Button>
          <Button
            size="sm"
            onClick={() => setInput((v) => v.slice(0, -1))}
            aria-label={t.actions.delete}
          >
            ⌫
          </Button>
        </div>
        <div className={styles.row}>
          <Button type="submit" variant="primary">
            {s.equals}
          </Button>
          {input.trim() !== '' && live ? (
            <Button onClick={() => void copyWithToast(copyValue(live))}>{s.copy}</Button>
          ) : null}
        </div>
      </form>
      <p className={styles.big} role="status" aria-label={s.pro.live} data-testid="calc-result">
        {input.trim() !== '' && live ? live.display : ''}
      </p>
      {input.trim() !== '' && live?.basic ? (
        <p className={styles.muted}>{s.pro.basicOnly}</p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className={styles.muted}>{scientific ? s.pro.sciHint : s.pro.stdHint}</p>
      <section aria-label={s.history} className={styles.stack}>
        <h3>{s.history}</h3>
        {history.length === 0 ? (
          <p className={styles.muted}>{s.pro.historyEmpty}</p>
        ) : (
          <>
            <TextField
              label={s.pro.historySearch}
              labelHidden
              placeholder={s.pro.historySearch}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {shown.length === 0 ? <p className={styles.muted}>{s.pro.noMatches}</p> : null}
            <ul className={styles.list}>
              {shown.map((h) => (
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
                    onClick={() => {
                      setInput(h.expr);
                      field.current?.focus();
                    }}
                  >
                    {h.expr}
                  </button>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 0,
                      color: 'inherit',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    aria-label={`${s.copy}: ${h.result}`}
                    onClick={() => void copyWithToast(h.result.replace(/\.(?=\d{3}(\D|$))/g, ''))}
                  >
                    {`= ${h.result}`}
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.row}>
              {saveAsNote ? (
                <Button onClick={() => saveAsNote(s.pro.noteTitle, historyText(shown))}>
                  {s.pro.toNote}
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  setHistory([]);
                  saveHistory([]);
                  setSearch('');
                }}
              >
                {s.clear}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
