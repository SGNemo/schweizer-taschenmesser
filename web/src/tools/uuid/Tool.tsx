import { useState } from 'react';
import { t } from '@/strings';
import { Button, TextField } from '@/ui';
import { copyWithToast, num } from '../shared';
import styles from '../tools.module.css';

const s = t.tools.uuid;

export default function UuidTool() {
  const [count, setCount] = useState('1');
  const [ids, setIds] = useState<string[]>([]);
  function generate() {
    const n = Math.min(100, Math.max(1, Math.trunc(num(count) ?? 1)));
    setIds(Array.from({ length: n }, () => crypto.randomUUID()));
  }
  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <div className={styles.grow}>
          <TextField
            label={s.count}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <Button onClick={generate}>{s.generate}</Button>
      </div>
      {ids.length > 0 ? (
        <>
          <p className={styles.mono} role="status" aria-label={s.name}>
            {ids.join('\n')}
          </p>
          <div className={styles.row}>
            <Button variant="secondary" onClick={() => void copyWithToast(ids.join('\n'))}>
              {s.copy}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
