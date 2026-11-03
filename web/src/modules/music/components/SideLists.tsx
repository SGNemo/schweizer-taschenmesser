import { useEffect, useState } from 'react';
import type { PlayerQueue } from '@/core/connectors/types';
import { tMusicPage } from '@/strings.musicPage';
import { tSpotify } from '@/strings.spotify';
import { Icon, type IconName } from '@/ui';
import { clock } from '../nowPlayingTime';
import type { PlayerApi, View } from './types';
import { viewKey } from './types';
import styles from '../routes/music.module.css';

const QUEUE_SHOWN = 5;

/** The aside: the library (saved songs, recently played, queue) as links into the main area, and the next songs of the queue. */
export function SideLists({ api, active }: { api: PlayerApi; active?: View }) {
  const tx = tSpotify.use();
  const tm = tMusicPage.use();
  const { source, ctx } = api.np;
  const [queue, setQueue] = useState<PlayerQueue | 'error' | undefined>();
  useEffect(() => {
    if (!source.queue) return;
    let alive = true;
    source
      .queue(ctx)
      .then((q) => alive && setQueue(q))
      .catch(() => alive && setQueue('error'));
    return () => {
      alive = false;
    };
  }, [source, ctx, api.version, api.playingId]);

  const entries: { view: View; label: string; icon: IconName }[] = [
    { view: { type: 'liked' }, label: tx.tabLiked, icon: 'heart' },
    { view: { type: 'recent' }, label: tx.navRecent, icon: 'clock' },
    { view: { type: 'queue' }, label: tx.navQueue, icon: 'menu' },
  ];
  const next = queue && queue !== 'error' ? queue.next.slice(0, QUEUE_SHOWN) : [];
  return (
    <>
      <nav className={styles.asideCard} aria-label={tm.libraryTitle}>
        <h2 className={styles.sectionTitle}>{tm.libraryTitle}</h2>
        <ul className={styles.plain}>
          {entries.map((e) => (
            <li key={viewKey(e.view)}>
              <button
                type="button"
                className={styles.libItem}
                aria-current={active && viewKey(active) === viewKey(e.view) ? 'page' : undefined}
                onClick={() => api.open(e.view)}
              >
                <Icon name={e.icon} size={16} />
                {e.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {next.length > 0 ? (
        <section className={styles.asideCard} aria-labelledby="music-queue">
          <h2 id="music-queue" className={styles.sectionTitle}>
            {tm.queueTitle}
          </h2>
          <ol className={styles.queue} data-testid="music-queue">
            {next.map((item, i) => (
              <li key={`${item.id}-${i}`}>
                <span className={styles.queueName}>
                  {item.name}
                  {item.subtitle ? <span className={styles.queueSub}>{item.subtitle}</span> : null}
                </span>
                {item.durationMs ? (
                  <span className={styles.time}>{clock(item.durationMs)}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </>
  );
}
