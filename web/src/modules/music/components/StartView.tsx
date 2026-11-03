import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { MediaItem, Playlist } from '@/core/connectors/types';
import { settingsPath } from '@/core/settings/registry/paths';
import { tMusicPage } from '@/strings.musicPage';
import { tSpotify } from '@/strings.spotify';
import { Icon } from '@/ui';
import { useCover } from '../useCover';
import { viewKey, type PlayerApi, type View } from './types';
import styles from '../routes/music.module.css';

const CONNECTIONS = settingsPath('verbindungen');
const RECENT_SHOWN = 12;
const PLAYLISTS_SHOWN = 24;

function Tile({
  api,
  title,
  sub,
  coverUrl,
  onOpen,
  small = false,
}: {
  api: PlayerApi;
  title: string;
  sub?: string;
  coverUrl?: string;
  onOpen: () => void;
  small?: boolean;
}) {
  const cover = useCover(api.np.ctx, coverUrl);
  return (
    <button
      type="button"
      className={small ? `${styles.tile} ${styles.tileSmall}` : styles.tile}
      onClick={onOpen}
    >
      <span className={styles.tileCover}>
        {cover ? <img src={cover} alt="" /> : <Icon name="music" size={28} />}
      </span>
      <span className={styles.tileTitle}>{title}</span>
      {sub ? <span className={styles.tileSub}>{sub}</span> : null}
    </button>
  );
}

/**
 * The start view, never empty: what you played last (a row of covers; a tap plays it) and your playlists as a cover grid (a tap
 * opens it). Each part says in one sentence what is missing when a feature is not switched on, and where to switch it on.
 */
export function StartView({ api }: { api: PlayerApi }) {
  const tx = tSpotify.use();
  const tm = tMusicPage.use();
  const { source, ctx, features } = api.np;
  const [recent, setRecent] = useState<MediaItem[] | 'error' | undefined>();
  const [playlists, setPlaylists] = useState<Playlist[] | 'error' | undefined>();
  const hasHistory = features.includes('history') && !!source.recent;
  const hasPlaylists = features.includes('playlists') && !!source.playlists;

  useEffect(() => {
    let alive = true;
    if (hasHistory)
      source.recent!(ctx)
        .then((items) => alive && setRecent(items))
        .catch(() => alive && setRecent('error'));
    if (hasPlaylists)
      source.playlists!(ctx)
        .then((items) => alive && setPlaylists(items))
        .catch(() => alive && setPlaylists('error'));
    return () => {
      alive = false;
    };
  }, [source, ctx, hasHistory, hasPlaylists, api.version]);

  const open = (v: View) => api.open(v);
  return (
    <div className={styles.start} data-testid="music-start">
      <section aria-labelledby="music-recent">
        <h2 id="music-recent" className={styles.sectionTitle}>
          {tm.startRecent}
        </h2>
        {!hasHistory ? (
          <p className={styles.note}>
            {tm.startNeedsHistory} <Link to={CONNECTIONS}>{tx.settings}</Link>
          </p>
        ) : recent === undefined ? (
          <p className={styles.note}>{tx.loading}</p>
        ) : recent === 'error' ? (
          <p className={styles.note}>{tx.listFailed}</p>
        ) : recent.length === 0 ? (
          <p className={styles.note}>{tm.startEmpty}</p>
        ) : (
          <div className={styles.recentRow} role="list">
            {recent.slice(0, RECENT_SHOWN).map((item) => (
              <div role="listitem" key={item.id}>
                <Tile
                  api={api}
                  small
                  title={item.name}
                  sub={item.subtitle}
                  coverUrl={item.coverUrl}
                  onOpen={() => void api.playFromList(item, recent)}
                />
              </div>
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="music-playlists">
        <h2 id="music-playlists" className={styles.sectionTitle}>
          {tm.startPlaylists}
        </h2>
        {!hasPlaylists ? (
          <p className={styles.note}>
            {tm.startNeedsPlaylists} <Link to={CONNECTIONS}>{tx.settings}</Link>
          </p>
        ) : playlists === undefined ? (
          <p className={styles.note}>{tx.loading}</p>
        ) : playlists === 'error' ? (
          <p className={styles.note}>{tx.playlistUnavailable}</p>
        ) : playlists.length === 0 ? (
          <p className={styles.note}>{tx.playlistNone}</p>
        ) : (
          <ul className={styles.grid} data-testid="music-playlists">
            {playlists.slice(0, PLAYLISTS_SHOWN).map((p) => {
              const view: View = { type: 'playlist', id: p.id, name: p.name };
              return (
                <li key={viewKey(view)}>
                  <Tile
                    api={api}
                    title={p.name}
                    sub={p.trackCount !== undefined ? tm.tracks(p.trackCount) : undefined}
                    coverUrl={p.coverUrl}
                    onOpen={() => open(view)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
