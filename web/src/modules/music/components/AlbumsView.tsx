import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { MediaItem } from '@/core/connectors/types';
import { settingsPath } from '@/core/settings/registry/paths';
import { tMusicPage } from '@/strings.musicPage';
import { tSpotify } from '@/strings.spotify';
import { EmptyState, ErrorState, SkeletonRows } from '@/ui';
import { readFollowedArtists, readSavedAlbums } from '../library';
import { Tile } from './Tile';
import type { PlayerApi } from './types';
import styles from '../routes/music.module.css';

const CONNECTIONS = settingsPath('verbindungen');

/**
 * The albums tab: the saved albums as cover tiles (newest first, up to 200). A tap opens the album; the heart on the album
 * page saves or removes one. Needs the feature "Lieblingssongs" (the library scope); read on request, kept while the
 * page is open.
 */
export function AlbumsView({ api }: { api: PlayerApi }) {
  const tm = tMusicPage.use();
  const tx = tSpotify.use();
  const { source, ctx, features } = api.np;
  const can = features.includes('library') && !!source.savedAlbums;
  const [albums, setAlbums] = useState<MediaItem[] | 'error' | undefined>();
  const [round, setRound] = useState(0);
  const canFollow = features.includes('follow') && !!source.followedArtists;
  const [artists, setArtists] = useState<MediaItem[] | 'error' | undefined>();
  useEffect(() => {
    if (!canFollow) return;
    let alive = true;
    readFollowedArtists(source, ctx).then(
      (a) => alive && setArtists(a),
      () => alive && setArtists('error'),
    );
    return () => {
      alive = false;
    };
    // "Erneut versuchen" of the albums reads the artists again too.
  }, [source, ctx, canFollow, round]);

  useEffect(() => {
    if (!can) return;
    let alive = true;
    readSavedAlbums(source, ctx).then(
      (a) => alive && setAlbums(a),
      () => alive && setAlbums('error'),
    );
    return () => {
      alive = false;
    };
  }, [source, ctx, can, round]);

  if (!can && !canFollow)
    return (
      <p className={styles.note}>
        {tm.albumsNeedLibrary} <Link to={CONNECTIONS}>{tx.settings}</Link>
      </p>
    );
  return (
    <section className={styles.lib} aria-labelledby="music-albums-title" data-testid="music-albums">
      <div className={styles.libTitle}>
        <h2 id="music-albums-title" className={styles.sectionTitle}>
          {tm.tabAlbums}
        </h2>
        <span className={styles.libCount}>
          {Array.isArray(albums) ? tm.albumsCount(albums.length) : ''}
        </span>
      </div>
      {!can ? (
        <p className={styles.note}>
          {tm.albumsNeedLibrary} <Link to={CONNECTIONS}>{tx.settings}</Link>
        </p>
      ) : albums === undefined ? (
        <SkeletonRows count={3} />
      ) : albums === 'error' ? (
        <ErrorState title={tx.listFailed} onRetry={() => setRound((r) => r + 1)} />
      ) : albums.length === 0 ? (
        <EmptyState compact title={tm.albumsNone} />
      ) : (
        <ul className={styles.grid} data-testid="music-albums-grid">
          {albums.map((a) => (
            <li key={a.id}>
              <Tile
                api={api}
                title={a.name}
                sub={a.subtitle}
                cover={a}
                alt={a.name}
                onOpen={() => api.open({ type: 'album', id: a.id, name: a.name, back: 'albums' })}
              />
            </li>
          ))}
        </ul>
      )}
      {canFollow ? (
        <>
          <h2 className={styles.sectionTitle}>{tm.followedArtists}</h2>
          {artists === undefined ? (
            <SkeletonRows count={2} />
          ) : artists === 'error' ? (
            <p className={styles.note}>{tx.listFailed}</p>
          ) : artists.length === 0 ? (
            <p className={styles.note}>{tm.followedNone}</p>
          ) : (
            <ul className={styles.grid} data-testid="music-followed-artists">
              {artists.map((a) => (
                <li key={a.id}>
                  <Tile
                    api={api}
                    title={a.name}
                    cover={a}
                    alt={a.name}
                    onOpen={() =>
                      api.open({ type: 'artist', id: a.id, name: a.name, back: 'albums' })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
