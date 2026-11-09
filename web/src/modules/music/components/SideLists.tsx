import { useEffect, useState } from 'react';
import type { PlayerQueue } from '@/core/connectors/types';
import { tMusicPage } from '@/strings.musicPage';
import { clock } from '../nowPlayingTime';
import type { PlayerApi } from './types';
import styles from '../routes/music.module.css';

const QUEUE_SHOWN = 5;

/** The aside: the next songs of the queue (the lists themselves are the chips above the main area). */
export function SideLists({ api }: { api: PlayerApi }) {
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

  const next = queue && queue !== 'error' ? queue.next.slice(0, QUEUE_SHOWN) : [];
  return (
    <>
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
