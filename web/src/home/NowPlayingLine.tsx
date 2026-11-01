import { Suspense, useState, type ComponentProps } from 'react';
import { lazyOnline } from '@/core/net/OnlineChunk';
import { tSpotify } from '@/strings.spotify';
import { Button, Icon } from '@/ui';
import { clock, useProgress } from './nowPlayingTime';
import { useCover } from './useCover';
import { useNowPlaying } from './useNowPlaying';
import type { SpotifyPlayer as Player } from './SpotifyPlayer';
import styles from './NowPlayingLine.module.css';

/** The player (playlists, saved songs, search) loads when it is first opened, not with the Overview. */
const SpotifyPlayer = lazyOnline<ComponentProps<typeof Player>>(() =>
  import('./SpotifyPlayer').then((m) => ({ default: m.SpotifyPlayer })),
);

/**
 * The "Läuft gerade" widget under the weather: cover, "Läuft gerade: Titel – Interpret", album, a progress
 * bar and Zurück / Pause or Weiter / Nächster. A tap on the card opens the player (playlists, saved
 * songs, search). Not there until a media connector (Spotify) is connected with "Anzeigen" or when the
 * user switched it off on the Overview. While nothing plays it is one quiet row with the way into the
 * player. Reads at most every 30 s while the app is visible; the last reading lives on this device.
 * Without Premium the controls disappear (once, with a quiet hint); the display stays.
 */
export function NowPlayingLine() {
  const np = useNowPlaying();
  const tx = tSpotify.use();
  const [open, setOpen] = useState(false);
  const cover = useCover(np?.ctx, np?.current?.coverUrl);
  const current = np?.current;
  const position = useProgress(
    current?.progressMs,
    current?.durationMs,
    current?.playing ?? false,
    np?.readAt ?? 0,
  );
  if (!np) return null;
  const player = open ? (
    <Suspense fallback={null}>
      <SpotifyPlayer open={open} onClose={() => setOpen(false)} np={np} cover={cover} />
    </Suspense>
  ) : null;

  if (!current) {
    return (
      <>
        <div className={styles.idle} data-testid="now-playing-idle">
          <Icon name="music" size={16} />
          <span className={styles.idleText}>{tx.idle}</span>
          <Button variant="ghost" data-testid="now-playing-open" onClick={() => setOpen(true)}>
            {tx.openPlayer}
          </Button>
        </div>
        {player}
      </>
    );
  }

  const lead = tx.lead(current.playing ? tx.playing : tx.paused);
  const progress =
    position !== undefined && current.durationMs ? position / current.durationMs : undefined;
  return (
    <>
      <section className={styles.card} data-testid="now-playing-line" aria-label={tx.playerTitle}>
        <button
          type="button"
          className={styles.cover}
          onClick={() => setOpen(true)}
          aria-label={tx.openPlayer}
          data-testid="now-playing-open"
        >
          {cover ? <img src={cover} alt="" /> : <Icon name="music" size={28} />}
        </button>
        <div className={styles.body}>
          <p className={styles.title}>
            <span className={styles.lead}>{lead}</span>
            {current.trackUrl ? (
              <a href={current.trackUrl} target="_blank" rel="noreferrer noopener">
                {current.title}
              </a>
            ) : (
              current.title
            )}
            {current.artist ? ` – ${current.artist}` : ''}
          </p>
          {current.album ? <p className={styles.meta}>{current.album}</p> : null}
          {progress !== undefined && position !== undefined ? (
            <div className={styles.progressRow}>
              <span className={styles.time}>{clock(position)}</span>
              <div
                className={styles.bar}
                role="progressbar"
                aria-label={tx.position}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
              >
                <span style={{ width: `${Math.round(progress * 1000) / 10}%` }} />
              </div>
              <span className={styles.time}>{clock(current.durationMs!)}</span>
            </div>
          ) : null}
        </div>
        {np.canControl ? (
          <span role="group" aria-label={tx.controlsLabel} className={styles.controls}>
            <Button
              variant="ghost"
              data-testid="now-playing-previous"
              aria-label={tx.previous}
              onClick={() => void np.control('previous')}
            >
              <Icon name="skipBack" size={18} />
            </Button>
            <Button
              variant="ghost"
              data-testid="now-playing-toggle"
              onClick={() => void np.control(current.playing ? 'pause' : 'play')}
            >
              <Icon name={current.playing ? 'pause' : 'play'} size={18} />
              {current.playing ? tx.pause : tx.resume}
            </Button>
            <Button
              variant="ghost"
              data-testid="now-playing-next"
              onClick={() => void np.control('next')}
            >
              {tx.next}
              <Icon name="skipForward" size={18} />
            </Button>
          </span>
        ) : null}
      </section>
      {player}
    </>
  );
}
