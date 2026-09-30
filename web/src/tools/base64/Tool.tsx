import { useState } from 'react';
import { t } from '@/strings';
import { Button, SelectField, TextArea } from '@/ui';
import { copyWithToast } from '../shared';
import styles from '../tools.module.css';
import { convertText, type Base64Mode } from './logic';

const s = t.tools.base64;
const MODES = Object.keys(s.modes) as Base64Mode[];

export default function Base64Tool() {
  const [mode, setMode] = useState<Base64Mode>('b64-enc');
  const [input, setInput] = useState('');
  const output = input ? convertText(mode, input) : '';
  return (
    <div className={styles.stack}>
      <SelectField
        label={s.mode}
        value={mode}
        onChange={(e) => setMode(e.target.value as Base64Mode)}
      >
        {MODES.map((m) => (
          <option key={m} value={m}>
            {s.modes[m]}
          </option>
        ))}
      </SelectField>
      <TextArea
        label={s.input}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={4}
        spellCheck={false}
      />
      {output === undefined ? (
        <p className={styles.error} role="alert">
          {s.invalid}
        </p>
      ) : output ? (
        <>
          <p className={styles.muted}>{s.output}</p>
          <p className={styles.mono} role="status" aria-label={s.output}>
            {output}
          </p>
          <div className={styles.row}>
            <Button variant="secondary" onClick={() => void copyWithToast(output)}>
              {s.copy}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
