import { useEffect, useState } from 'react';
import { t } from '@/strings';
import { Button, SelectField, TextArea } from '@/ui';
import { copyWithToast } from '../shared';
import styles from '../tools.module.css';
import { ALGORITHMS, digestHex, type HashAlgorithm } from './logic';

const s = t.tools.hash;

export default function HashTool() {
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-256');
  const [input, setInput] = useState('');
  // Keyed by what it was computed from, so a stale answer is never shown for newer input.
  const [digest, setDigest] = useState<{ key: string; hex: string }>();
  const key = `${algorithm}\n${input}`;

  useEffect(() => {
    let cancelled = false;
    void digestHex(algorithm, input).then((hex) => {
      if (!cancelled) setDigest({ key, hex });
    });
    return () => {
      cancelled = true;
    };
  }, [algorithm, input, key]);

  const hex = digest?.key === key ? digest.hex : undefined;
  return (
    <div className={styles.stack}>
      <SelectField
        label={s.algorithm}
        value={algorithm}
        onChange={(e) => setAlgorithm(e.target.value as HashAlgorithm)}
      >
        {ALGORITHMS.map((a) => (
          <option key={a} value={a}>
            {a}
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
      <p className={styles.muted}>{s.output}</p>
      <p className={styles.mono} role="status" aria-label={s.output}>
        {hex ?? '…'}
      </p>
      <div className={styles.row}>
        <Button variant="secondary" disabled={!hex} onClick={() => hex && void copyWithToast(hex)}>
          {s.copy}
        </Button>
      </div>
    </div>
  );
}
