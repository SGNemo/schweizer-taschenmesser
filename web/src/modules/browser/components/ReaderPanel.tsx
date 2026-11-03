import { useEffect, useState } from 'react';
import { parseReadable, type Readable } from '@/core/io/readable';
import { fetchPublic } from '@/core/net/fetchPublic';
import { t } from '@/strings';
import { Button } from '@/ui';
import styles from './ReaderPanel.module.css';

type State = { url: string; value: 'failed' | Readable } | null;

/**
 * Reader mode of the browser: the page's main text as calm plain text. The text is fetched by the app
 * (`fetchPublic`, no cookies, no login) and reduced to data (`parseReadable`); nothing is read out of the
 * tab and nothing is sent into it. Not for private tabs or plain-HTTP pages (the caller does not offer it).
 */
export function ReaderPanel({ url, onBack }: { url: string; onBack: () => void }) {
  const [state, setState] = useState<State>(null);
  useEffect(() => {
    let alive = true;
    fetchPublic(url, undefined, undefined, 'page')
      .then(async (res) => {
        if (!res.ok) throw new Error('http');
        const text = parseReadable(await res.text());
        if (alive) setState({ url, value: text.blocks.length > 0 ? text : 'failed' });
      })
      .catch(() => alive && setState({ url, value: 'failed' }));
    return () => {
      alive = false;
    };
  }, [url]);
  const value = state?.url === url ? state.value : undefined;
  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <Button onClick={onBack}>{t.browser.reader.back}</Button>
      </div>
      <p className={styles.note}>{t.browser.reader.note}</p>
      {value === undefined ? <p role="status">{t.browser.reader.loading}</p> : null}
      {value === 'failed' ? <p role="status">{t.browser.reader.failed}</p> : null}
      {value && value !== 'failed' ? (
        <article className={styles.text} aria-label={t.browser.reader.title}>
          {value.title ? <h2>{value.title}</h2> : null}
          {value.blocks.map((b, i) =>
            b.type === 'h' ? (
              b.level === 2 ? (
                <h3 key={i}>{b.text}</h3>
              ) : (
                <h4 key={i}>{b.text}</h4>
              )
            ) : b.type === 'li' ? (
              <ul key={i}>
                <li>{b.text}</li>
              </ul>
            ) : b.type === 'quote' ? (
              <blockquote key={i}>{b.text}</blockquote>
            ) : (
              <p key={i}>{b.text}</p>
            ),
          )}
        </article>
      ) : null}
    </div>
  );
}
