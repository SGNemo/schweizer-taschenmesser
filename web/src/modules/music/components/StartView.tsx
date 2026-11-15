import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { MediaItem, Playlist } from '@/core/connectors/types';
import { settingsPath } from '@/core/settings/registry/paths';
import { tMusicPage } from '@/strings.musicPage';
import { tSpotify } from '@/strings.spotify';
import { readAllPlaylists } from '../library';
import { readRecent } from '../recentOnce';
import { Tile } from './Tile';
import { viewKey, type PlayerApi, type View } from './types';
import styles from '../routes/music.module.css';
import sx from './Spotify.module.css';

const CONNECTIONS = settingsPath('verbindungen');
const RECENT_SHOWN = 12;
const PLAYLISTS_SHOWN = 24;

/**
 * The start view, never empty: what you played last (a row of covers; a tap plays it) and your playlists as a cover grid (a tap
 * opens it). Each part says in one sentence what is missing when a feature is not switched on, and where to switch it on.
 */
export function StartView({
  api,
  onRead,
}: {
  api: PlayerApi;
  /** Called once both parts are read, answered or failed (0b-8: the page waits for them). */
  onRead?: () => void;
}) {
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
      readRecent(source, ctx, api.version)
        .then((items) => alive && setRecent(items))
        .catch(() => alive && setRecent('error'));
    if (hasPlaylists)
      readAllPlaylists(source, ctx)
        .then((items) => alive && setPlaylists(items))
        .catch(() => alive && setPlaylists('error'));
    return () => {
      alive = false;
    };
  }, [source, ctx, hasHistory, hasPlaylists, api.version]);

  const read = (!hasHistory || recent !== undefined) && (!hasPlaylists || playlists !== undefined);
  useEffect(() => {
    if (read) onRead?.();
  }, [read, onRead]);

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
                  cover={item}
                  alt={item.album ?? item.name}
                  onOpen={() => void api.playFromList(item, recent)}
                />
              </div>
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="music-playlists">
        <div className={styles.sectionHead}>
          <h2 id="music-playlists" className={styles.sectionTitle}>
            {tm.startPlaylists}
          </h2>
          {hasPlaylists ? (
            <button
              type="button"
              className={`${sx.linkButton} ${styles.sectionLink}`}
              onClick={() => open({ type: 'playlists' })}
            >
              {tm.allPlaylists}
            </button>
          ) : null}
        </div>
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
                    cover={p}
                    alt={p.name}
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
