import { useEffect, useState } from 'react';
import { evaluateExpression, preloadEngine } from '@/core/calc/engine';
import {
  toInteger,
  viewInteger,
  WORD_SIZES,
  type IntegerView,
  type WordSize,
} from '@/core/calc/programmer';
import { t } from '@/strings';
import { Button, Checkbox, Icon, IconButton, Segmented, TextField } from '@/ui';
import { copyWithToast } from '../shared';
import styles from '../tools.module.css';
import { session } from './session';

const s = t.tools.calc.pro.programmer;
const OPS: Array<[string, string]> = [
  ['AND', ' & '],
  ['OR', ' | '],
  ['XOR', ' ^| '],
  ['NOT', '~'],
  ['<<', ' << '],
  ['>>', ' >> '],
  ['0x', '0x'],
  ['0b', '0b'],
];
const BASES = ['hex', 'dec', 'oct', 'bin'] as const;

export default function ProgrammerMode() {
  const [input, setInput] = useState('0xFF & 0x0F');
  const [size, setSize] = useState<WordSize>(32);
  const [signed, setSigned] = useState(true);
  const [value, setValue] = useState<bigint | undefined>();
  const [note, setNote] = useState('');

  useEffect(() => preloadEngine(), []);
  useEffect(() => {
    if (input.trim() === '') return;
    let cancelled = false;
    void evaluateExpression(input, { vars: new Map(session.vars) }).then(
      (r) => {
        if (cancelled) return;
        const n = toInteger(r.canonical);
        setValue(n);
        setNote(n === undefined ? s.notInteger : '');
      },
      () => {
        if (cancelled) return;
        setValue(undefined);
        setNote('');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [input]);

  const empty = input.trim() === '';
  const view: IntegerView | undefined =
    !empty && value !== undefined ? viewInteger(value, size, signed) : undefined;

  return (
    <div className={styles.stack}>
      <TextField
        label={s.input}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        data-autofocus
      />
      <div className={styles.keys}>
        {OPS.map(([label, text]) => (
          <Button key={label} size="sm" onClick={() => setInput((v) => v + text)}>
            {label}
          </Button>
        ))}
      </div>
      <Segmented
        label={s.word}
        value={String(size)}
        options={WORD_SIZES.map((w) => ({ value: String(w), label: String(w) }))}
        onChange={(v) => setSize(Number(v) as WordSize)}
      />
      <Checkbox label={s.signed} checked={signed} onChange={(e) => setSigned(e.target.checked)} />
      <div className={styles.table} role="status">
        {view
          ? BASES.map((b) => (
              <Row key={b} label={s[b]} text={view[b]} copy={view[b].replaceAll(' ', '')} />
            ))
          : null}
      </div>
      {view && !view.fits ? <p className={styles.muted}>{s.overflow}</p> : null}
      {!empty && note ? <p className={styles.muted}>{note}</p> : null}
      <p className={styles.muted}>{s.hint}</p>
    </div>
  );
}

function Row({ label, text, copy }: { label: string; text: string; copy: string }) {
  return (
    <>
      <span className={styles.label}>{label}</span>
      <span className={styles.mono}>{text}</span>
      <IconButton label={`${t.tools.calc.copy}: ${label}`} onClick={() => void copyWithToast(copy)}>
        <Icon name="copy" size={18} />
      </IconButton>
    </>
  );
}
