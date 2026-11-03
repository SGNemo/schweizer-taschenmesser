import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { parseReadable, type Readable } from '@/core/io/readable';
import { fetchPublic } from '@/core/net/fetchPublic';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button, EmptyState, PageTitle } from '@/ui';
import { hostOf, statusOf } from '../logic';
import { itemRepo } from '../repo';
import styles from './reader.module.css';

type State = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; text: Readable };

/**
 * Reader mode for a saved link: the page's main text as plain text blocks in a calm column. The page is
 * fetched without cookies or login and reduced to data (`parseReadable`); nothing from it runs or loads.
 * Opening it moves an open item to "Angefangen".
 */
export default function ReaderPage() {
  const { id = '' } = useParams();
  const item = useLiveQuery(() => itemRepo.get(id).then((i) => i ?? null), [id]);
  const url = item?.url;
  // The result belongs to the address it was fetched for; another address starts at "loading" again.
  const [result, setResult] = useState<{ url: string; value: State } | null>(null);
  const state: State = result && result.url === url ? result.value : { kind: 'loading' };

  useEffect(() => {
    if (!url?.startsWith('https://')) return;
    let alive = true;
    fetchPublic(url, undefined, undefined, 'page')
      .then(async (res) => {
        if (!res.ok) throw new Error('http');
        const text = parseReadable(await res.text());
        if (!alive) return;
        setResult({
          url,
          value: text.blocks.length > 0 ? { kind: 'ready', text } : { kind: 'failed' },
        });
      })
      .catch(() => alive && setResult({ url, value: { kind: 'failed' } }));
    return () => {
      alive = false;
    };
  }, [url]);

  const ready = state.kind === 'ready';
  const open = item && statusOf(item) === 'open';
  useEffect(() => {
    if (ready && open && item) void itemRepo.update(item.id, { started: true });
    // only when the text has arrived, once per item
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, item?.id]);

  if (item === undefined) return <PageTitle title={t.bookmarks.reader.mode} />;
  if (item === null || !url)
    return (
      <>
        <PageTitle title={t.bookmarks.reader.mode} />
        <EmptyState title={t.bookmarks.reader.noAddress}>
          <Link to="/bookmarks">{t.bookmarks.reader.back}</Link>
        </EmptyState>
      </>
    );
  return (
    <>
      <PageTitle
        title={state.kind === 'ready' && state.text.title ? state.text.title : item.title}
      />
      <div className={styles.bar}>
        <Link to="/bookmarks">{t.bookmarks.reader.back}</Link>
        <span className={styles.site}>{hostOf(url)}</span>
        <Button onClick={() => void getPlatform().app.openUrl(url)}>
          {t.bookmarks.reader.inBrowser}
        </Button>
      </div>
      <p className={styles.note}>{t.bookmarks.reader.note}</p>
      {state.kind === 'loading' ? <p role="status">{t.bookmarks.reader.loading}</p> : null}
      {state.kind === 'failed' ? (
        <EmptyState title={t.bookmarks.reader.failed}>
          <Button onClick={() => void getPlatform().app.openUrl(url)}>
            {t.bookmarks.reader.inBrowser}
          </Button>
        </EmptyState>
      ) : null}
      {state.kind === 'ready' ? (
        <article className={styles.text} aria-label={t.bookmarks.reader.text}>
          {state.text.blocks.map((b, i) =>
            b.type === 'h' ? (
              b.level === 2 ? (
                <h2 key={i}>{b.text}</h2>
              ) : (
                <h3 key={i}>{b.text}</h3>
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
    </>
  );
}
