import { useEffect, useMemo, useState } from 'react';
import { formatNumber } from '@/core/i18n/format';
import { t } from '@/strings';
import { Checkbox, NoReadAid, TextArea, TextField } from '@/ui';
import styles from '../tools.module.css';
import own from './Tool.module.css';
import {
  FLAGS,
  MAX_MATCHES,
  MAX_TEXT,
  normalizeFlags,
  toSegments,
  type RegexOutcome,
} from './logic';
import { runInBrowser, workerSupported } from './run';

const s = t.tools.regex;

type Answer = 'timeout' | { outcome: RegexOutcome; text: string };

/** Try a pattern on a text. The pattern runs in a worker with a 1 s limit; the page never executes it. */
export default function RegexTool() {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState<string[]>(['g']);
  const [text, setText] = useState('');
  const [replacement, setReplacement] = useState('');
  // The answer belongs to the inputs it was computed for; an older one is simply not shown.
  const [answer, setAnswer] = useState<{ key: string; value: Answer } | undefined>();

  const tooLong = text.length > MAX_TEXT;
  const supported = workerSupported();
  const flagString = normalizeFlags(flags);
  const runnable = supported && !tooLong && pattern !== '';
  const key = [pattern, flagString, text, replacement].join('\u0000');
  const current = answer?.key === key ? answer.value : undefined;

  useEffect(() => {
    if (!runnable) return;
    let run: ReturnType<typeof runInBrowser> | undefined;
    const timer = setTimeout(() => {
      run = runInBrowser({
        pattern,
        flags: flagString,
        text,
        ...(replacement !== '' ? { replacement } : {}),
      });
      void run.result.then((r) =>
        setAnswer({ key, value: 'timeout' in r ? 'timeout' : { outcome: r, text } }),
      );
    }, 250);
    return () => {
      clearTimeout(timer);
      run?.cancel();
    };
  }, [runnable, pattern, flagString, text, replacement, key]);

  const timedOut = current === 'timeout';
  const finished = current && current !== 'timeout' ? current : undefined;
  const done = finished?.outcome.ok ? finished.outcome : undefined;
  const failed = finished && !finished.outcome.ok ? finished.outcome : undefined;
  const segments = useMemo(
    () => (finished && done ? toSegments(finished.text, done.hits) : []),
    [finished, done],
  );

  const toggle = (f: string, on: boolean) =>
    setFlags((cur) => (on ? [...cur, f] : cur.filter((x) => x !== f)));

  return (
    <div className={styles.stack}>
      <NoReadAid>
        <TextField
          label={s.pattern}
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          className={own.code}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          data-testid="regex-pattern"
        />
      </NoReadAid>
      <fieldset className={own.flags}>
        <legend>{s.flags}</legend>
        {FLAGS.map((f) => (
          <Checkbox
            key={f}
            label={s.flagNames[f]}
            checked={flags.includes(f)}
            onChange={(e) => toggle(f, e.target.checked)}
          />
        ))}
      </fieldset>
      <TextArea
        label={s.text}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        spellCheck={false}
        data-testid="regex-text"
      />
      <NoReadAid>
        <TextField
          label={s.replacement}
          hint={s.replacementHint}
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          className={own.code}
          spellCheck={false}
          autoComplete="off"
          data-testid="regex-replacement"
        />
      </NoReadAid>

      {!supported && <p className={styles.error}>{s.unsupported}</p>}
      {tooLong && (
        <p className={styles.error} role="alert" data-testid="regex-too-long">
          {s.tooLong(formatNumber(MAX_TEXT))}
        </p>
      )}
      {supported && !tooLong && !runnable && <p className={styles.muted}>{s.idle}</p>}
      {runnable && !current && <p className={styles.muted}>{s.checking}</p>}
      {timedOut && (
        <p className={styles.error} role="alert" data-testid="regex-timeout">
          {s.tooSlow}
        </p>
      )}
      {failed && (
        <p className={styles.error} role="alert" data-testid="regex-invalid">
          {s.invalid}
          {failed.error ? (
            <>
              {' '}
              <NoReadAid>
                <span className={own.code}>{failed.error}</span>
              </NoReadAid>
            </>
          ) : null}
        </p>
      )}

      {done && (
        <>
          <p className={own.summary} aria-live="polite" data-testid="regex-count">
            {done.hits.length === 0 ? s.none : s.count(done.hits.length)}
          </p>
          {done.capped && <p className={styles.muted}>{s.capped(formatNumber(MAX_MATCHES))}</p>}

          {done.hits.length > 0 && (
            <>
              <section aria-label={s.highlighted} className={styles.stack}>
                <h3>{s.highlighted}</h3>
                <NoReadAid>
                  <pre className={own.highlight} data-testid="regex-highlight">
                    {segments.map((seg, i) =>
                      seg.hit ? (
                        <mark key={i}>
                          {seg.text}
                          <sup>{seg.hit}</sup>
                        </mark>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
                  </pre>
                </NoReadAid>
              </section>

              <section aria-label={s.matches} className={styles.stack}>
                <h3>{s.matches}</h3>
                <NoReadAid>
                  <ul className={own.hits} data-testid="regex-hits">
                    {done.hits.map((h, i) => (
                      <li key={i} className={own.hit}>
                        <p className={own.hitTitle}>
                          {s.match(i + 1)}:{' '}
                          <span className={own.code}>{h.text === '' ? s.emptyMatch : h.text}</span>{' '}
                          <span className={own.dim}>({s.position(h.index + 1)})</span>
                        </p>
                        {h.groups.length > 0 && (
                          <ul className={own.groups}>
                            {h.groups.map((g) => (
                              <li key={g.num}>
                                <span className={own.dim}>
                                  {g.name
                                    ? `${s.group(g.num)}, ${s.named(g.name)}`
                                    : s.group(g.num)}
                                  :
                                </span>{' '}
                                {g.value === undefined ? (
                                  <span className={own.dim}>{s.notMatched}</span>
                                ) : (
                                  <span className={own.code}>
                                    {g.value === '' ? s.emptyMatch : g.value}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </NoReadAid>
              </section>
            </>
          )}

          {done.replaced !== undefined && (
            <section aria-label={s.preview} className={styles.stack}>
              <h3>{s.preview}</h3>
              <NoReadAid>
                <pre className={own.highlight} data-testid="regex-replaced">
                  {done.replaced}
                </pre>
              </NoReadAid>
            </section>
          )}
        </>
      )}
    </div>
  );
}
