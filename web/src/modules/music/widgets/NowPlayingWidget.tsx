import { clock, useProgress } from '../nowPlayingTime';
import { useCover } from '../useCover';
import { useNowPlaying } from '../useNowPlaying';
import { tMusicPage } from '@/strings.musicPage';
import { tSpotify } from '@/strings.spotify';
import { Button, Icon, WidgetBody } from '@/ui';
import { settingsPath } from '@/core/settings/registry/paths';
import styles from '../routes/music.module.css';

/**
 * Overview widget: a mini player, only what matters (cover, title, artist, play/pause and next, a thin progress line). One tap on
 * the title opens the module for everything else. Not connected: one calm next step; nothing plays: one quiet line.
 */
export default function NowPlayingWidget() {
  const tx = tSpotify.use();
  const tm = tMusicPage.use();
  const np = useNowPlaying();
  const cover = useCover(np?.ctx, np?.current?.coverUrl);
  const current = np?.current;
  const position = useProgress(
    current?.progressMs,
    current?.durationMs,
    current?.playing ?? false,
    np?.readAt ?? 0,
  );
  const progress =
    position !== undefined && current?.durationMs ? position / current.durationMs : undefined;
  return (
    <WidgetBody
      loading={false}
      isEmpty={!np}
      empty={tm.notConnectedTitle}
      emptyAction={{ label: tm.widgetConnect, to: settingsPath('verbindungen') }}
    >
      {np ? (
        <div className={styles.mini} data-testid="music-widget">
          <span className={styles.miniCover}>
            {cover ? <img src={cover} alt="" /> : <Icon name="music" size={22} />}
          </span>
          <div className={styles.miniText}>
            {current ? (
              <>
                <p className={styles.miniTitle}>{current.title}</p>
                <p className={styles.miniSub}>{current.artist ?? ''}</p>
              </>
            ) : (
              <p className={styles.miniTitle}>{tm.widgetIdle}</p>
            )}
          </div>
          {np.canControl && current ? (
            <span role="group" aria-label={tx.controlsLabel} className={styles.miniControls}>
              <Button
                variant="ghost"
                data-testid="now-playing-toggle"
                aria-label={current.playing ? tx.pause : tx.resume}
                onClick={() => void np.control(current.playing ? 'pause' : 'play')}
              >
                <Icon name={current.playing ? 'pause' : 'play'} size={18} />
              </Button>
              <Button
                variant="ghost"
                data-testid="now-playing-next"
                aria-label={tx.next}
                onClick={() => void np.control('next')}
              >
                <Icon name="skipForward" size={18} />
              </Button>
            </span>
          ) : null}
          {progress !== undefined && position !== undefined && current?.durationMs ? (
            <div
              className={styles.miniBar}
              role="progressbar"
              aria-label={tx.position}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-valuetext={`${clock(position)} / ${clock(current.durationMs)}`}
            >
              <span style={{ width: `${Math.round(progress * 1000) / 10}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}
    </WidgetBody>
  );
}
