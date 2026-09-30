import { useState } from 'react';
import { t } from '@/strings';
import { Button, TextArea } from '@/ui';
import { copyWithToast } from '../shared';
import styles from '../tools.module.css';
import { parseJson } from './logic';

const s = t.tools.json;

export default function JsonTool() {
  const [input, setInput] = useState('');
  const [shown, setShown] = useState<string>();
  const parsed = input.trim() ? parseJson(input) : undefined;
  return (
    <div className={styles.stack}>
      <TextArea
        label={s.input}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setShown(undefined);
        }}
        rows={8}
        spellCheck={false}
      />
      {parsed ? (
        parsed.ok ? (
          <p role="status">{s.valid}</p>
        ) : (
          <p className={styles.error} role="alert">
            {s.invalid(parsed.message)}
          </p>
        )
      ) : null}
      {parsed?.ok ? (
        <div className={styles.row}>
          <Button onClick={() => setShown(parsed.pretty)}>{s.pretty}</Button>
          <Button variant="secondary" onClick={() => setShown(parsed.minified)}>
            {s.minify}
          </Button>
          {shown ? (
            <Button variant="secondary" onClick={() => void copyWithToast(shown)}>
              {s.copy}
            </Button>
          ) : null}
        </div>
      ) : null}
      {parsed?.ok && shown ? <pre className={styles.mono}>{shown}</pre> : null}
    </div>
  );
}
