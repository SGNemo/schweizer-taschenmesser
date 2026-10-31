import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { MediaItem, Playlist } from '@/core/connectors/types';
import { settingsPath } from '@/core/settings/registry/paths';
import { tSpotify } from '@/strings.spotify';
import { Button, Dialog, Icon, type IconName } from '@/ui';
import { NowBar } from './spotify/NowBar';
import { SourceView } from './spotify/SourceView';
import { trackIdOf, viewKey, type PlayerApi, type View } from './spotify/types';
import type { NowPlayingHandle } from './useNowPlaying';
import styles from './spotify/Spotify.module.css';

const CONNECTIONS = settingsPath('verbindungen');

/**
 * The player behind the "Läuft gerade" widget, built like Spotify's own: your library on the left
 * (saved songs, recently played, queue, search and every playlist), the opened list in the middle with
 * all its songs (tap one to play it, ♥ to save it, "⋯" for the queue or to hide it), and a bar at the
 * bottom with what plays, the controls, volume and device. Everything is read on request and kept only
 * while this dialog is open; hidden songs are remembered on this device (ids only).
 */
export function SpotifyPlayer({
  open,
  onClose,
  np,
}: {
  open: boolean;
  onClose: () => void;
  np: NowPlayingHandle;
  /** Kept for the widget's own cover; the player loads the covers it needs itself. */
  cover?: string | undefined;
}) {
  const tx = tSpotify.use();
  const { source, ctx, features } = np;
  const [view, setView] = useState<View>();
  const [pane, setPane] = useState<'nav' | 'main'>('nav');
  const [version, setVersion] = useState(0);
  const [playlists, setPlaylists] = useState<Playlist[] | 'error' | undefined>();
  const hasPlaylists = features.includes('playlists');

  useEffect(() => {
    if (!open || !source.playlists || !hasPlaylists) return;
    let alive = true;
    source
      .playlists(ctx)
      .then((items) => alive && setPlaylists(items))
      .catch(() => alive && setPlaylists('error'));
    return () => {
      alive = false;
    };
  }, [open, source, ctx, hasPlaylists]);

  const act = async (action: () => Promise<void>) => {
    const ok = await np.run(action);
    if (ok) {
      np.refresh(800);
      setTimeout(() => setVersion((v) => v + 1), 1200);
    }
    return ok;
  };
  const api: PlayerApi = {
    np,
    version,
    playingId: trackIdOf(np.current?.trackUrl),
    act,
    open(next) {
      setView(next);
      setPane('main');
    },
    playFromList: (item: MediaItem, list: readonly MediaItem[]) =>
      source.play ? act(() => source.play!(ctx, item, [...list])) : Promise.resolve(false),
  };

  const entries: { view: View; label: string; icon: IconName }[] = [
    { view: { type: 'liked' }, label: tx.tabLiked, icon: 'heart' },
    { view: { type: 'recent' }, label: tx.navRecent, icon: 'clock' },
    { view: { type: 'queue' }, label: tx.navQueue, icon: 'menu' },
    { view: { type: 'search' }, label: tx.tabSearch, icon: 'search' },
  ];
  const active = view ? viewKey(view) : undefined;

  return (
    <Dialog open={open} onClose={onClose} title={tx.playerTitle} size="xl">
      <div className={styles.player} data-testid="spotify-player">
        <div className={styles.shell} data-pane={pane}>
          <nav className={styles.nav} aria-label={tx.navLabel}>
            <ul className={styles.plain}>
              {entries.map((e) => (
                <li key={viewKey(e.view)}>
                  <button
                    type="button"
                    className={[
                      styles.navItem,
                      active === viewKey(e.view) ? styles.navOn : '',
                    ].join(' ')}
                    aria-current={active === viewKey(e.view) ? 'page' : undefined}
                    onClick={() => api.open(e.view)}
                  >
                    <Icon name={e.icon} size={16} />
                    <span className={styles.navName}>{e.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <h3 className={styles.sub}>{tx.tabPlaylists}</h3>
            {!hasPlaylists ? (
              <p className={styles.note}>
                {tx.playlistReconnect} <Link to={CONNECTIONS}>{tx.settings}</Link>
              </p>
            ) : playlists === undefined ? (
              <p className={styles.note}>{tx.loading}</p>
            ) : playlists === 'error' ? (
              <p className={styles.note}>{tx.playlistUnavailable}</p>
            ) : playlists.length === 0 ? (
              <p className={styles.note}>{tx.playlistNone}</p>
            ) : (
              <ul className={[styles.plain, styles.playlists].join(' ')}>
                {playlists.map((p) => {
                  const v: View = { type: 'playlist', id: p.id, name: p.name };
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={[styles.navItem, active === viewKey(v) ? styles.navOn : ''].join(
                          ' ',
                        )}
                        aria-current={active === viewKey(v) ? 'page' : undefined}
                        onClick={() => api.open(v)}
                      >
                        <span className={styles.navName}>{p.name}</span>
                        {p.trackCount !== undefined ? (
                          <span className={styles.navCount}>{p.trackCount}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
          <section className={styles.main} aria-label={tx.playerTitle}>
            <div className={styles.back}>
              <Button variant="ghost" onClick={() => setPane('nav')}>
                <Icon name="chevronLeft" size={18} />
                {tx.backToLibrary}
              </Button>
            </div>
            {view ? (
              <SourceView api={api} view={view} />
            ) : (
              <p className={styles.note}>{tx.pickSomething}</p>
            )}
          </section>
        </div>
        <NowBar api={api} />
      </div>
    </Dialog>
  );
}
