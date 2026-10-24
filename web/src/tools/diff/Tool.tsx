import { useMemo, useState } from 'react';
import { formatNumber } from '@/core/i18n/format';
import { t } from '@/strings';
import { Button, Checkbox, NoReadAid, TextArea } from '@/ui';
import { copyText } from '../shared';
import { useUiStore } from '@/stores/ui';
import styles from '../tools.module.css';
import own from './Tool.module.css';
import { diffLines, isTooLong, MAX_CHARS, toUnifiedDiff, type DiffRow } from './logic';

const s = t.tools.diff;

const SIGN = { same: ' ', add: '+', del: '−' } as const;

function RowText({ row }: { row: DiffRow }) {
  if (!row.parts) return <>{row.text === '' ? ' ' : row.text}</>;
  return (
    <>
      {row.parts.map((p, i) => {
        if (!p.changed) return <span key={i}>{p.text}</span>;
        return row.kind === 'add' ? <ins key={i}>{p.text}</ins> : <del key={i}>{p.text}</del>;
      })}
    </>
  );
}

/** Two texts, line by line: what was added, removed or kept; changed words are marked inside the line. */
export default function DiffTool() {
  const toast = useUiStore((st) => st.toast);
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const [ignoreWhitespace, setIgnore] = useState(false);

  const tooLong = isTooLong(before, after);
  const result = useMemo(
    () => (tooLong ? undefined : diffLines(before, after, { ignoreWhitespace })),
    [before, after, ignoreWhitespace, tooLong],
  );
  const empty = before === '' && after === '';

  const copyDiff = async () => {
    if (!result) return;
    if (await copyText(toUnifiedDiff(result.rows))) toast(s.copied);
  };

  return (
    <div className={styles.stack}>
      <div className={own.pair}>
        <TextArea
          label={s.before}
          value={before}
          onChange={(e) => setBefore(e.target.value)}
          rows={8}
          spellCheck={false}
          data-testid="diff-before"
        />
        <TextArea
          label={s.after}
          value={after}
          onChange={(e) => setAfter(e.target.value)}
          rows={8}
          spellCheck={false}
          data-testid="diff-after"
        />
      </div>
      <Checkbox
        label={s.ignoreSpace}
        checked={ignoreWhitespace}
        onChange={(e) => setIgnore(e.target.checked)}
      />

      {tooLong && (
        <p className={styles.error} role="alert" data-testid="diff-too-long">
          {s.tooLong(formatNumber(MAX_CHARS))}
        </p>
      )}
      {!tooLong && empty && <p className={styles.muted}>{s.empty}</p>}

      {result && !empty && (
        <section aria-label={s.result} className={styles.stack}>
          <p className={own.summary} data-testid="diff-count" aria-live="polite">
            {result.changed === 0 ? s.identical : s.changed(result.changed)}
          </p>
          {result.rough && <p className={styles.muted}>{s.rough}</p>}
          {result.changed > 0 && (
            <div className={styles.row}>
              <Button onClick={() => void copyDiff()}>{s.copyDiff}</Button>
            </div>
          )}
          <NoReadAid>
            <ul className={own.rows} data-testid="diff-rows">
              {result.rows.map((row, i) => (
                <li
                  key={i}
                  className={[
                    own.row,
                    row.kind === 'add' ? own.add : row.kind === 'del' ? own.del : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-kind={row.kind}
                >
                  <span className={own.sign} aria-hidden="true">
                    {SIGN[row.kind]}
                  </span>
                  <span>
                    <span className="sr-only">
                      {row.kind === 'add' ? s.added : row.kind === 'del' ? s.removed : s.same}:{' '}
                    </span>
                    <RowText row={row} />
                  </span>
                </li>
              ))}
            </ul>
          </NoReadAid>
        </section>
      )}
    </div>
  );
}
