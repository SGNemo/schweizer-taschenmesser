import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ConnectorError,
  type MediaItem,
  type PlayerState,
  type Playlist,
  type SearchResult,
} from '@/core/connectors/types';
import { settingsPath } from '@/core/settings/registry/paths';
import { tSpotify } from '@/strings.spotify';
import { Button, Dialog, Icon, Segmented, TextField } from '@/ui';
import { clock, useProgress } from './nowPlayingTime';
import type { NowPlayingHandle } from './useNowPlaying';
import styles from './SpotifyPlayer.module.css';

type Tab = 'playlists' | 'liked' | 'search';
const CONNECTIONS = settingsPath('verbindungen');
const REPEAT: Record<NonNullable<PlayerState['repeat']>, NonNullable<PlayerState['repeat']>> = {
  off: 'context',
  context: 'track',
  track: 'off',
};

type Load<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; items: T };

/** One list of things to play; a tap on a row starts it. */
function MediaRows({
  items,
  onPlay,
  empty,
}: {
  items: readonly MediaItem[];
  onPlay: (item: MediaItem) => void;
  empty: string;
}) {
  const tx = tSpotify.use();
  if (items.length === 0) return <p className={styles.note}>{empty}</p>;
  return (
    <ul className={styles.rows}>
      {items.map((item) => (
        <li key={`${item.kind}:${item.id}`}>
          <button
            type="button"
            className={styles.row}
            aria-label={tx.play(item.name)}
            onClick={() => onPlay(item)}
          >
            <Icon name={item.kind === 'track' ? 'music' : 'play'} size={16} />
            <span className={styles.rowName}>{item.name}</span>
            {item.subtitle ? <span className={styles.rowSub}>{item.subtitle}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The player behind the "Läuft gerade" widget: big controls with position, volume, shuffle and repeat,
 * and three ways to start something: your playlists, your saved songs, a search. Everything is read on
 * request and kept only while this dialog is open; the typed search words go to Spotify and nowhere else.
 */
export function SpotifyPlayer({
  open,
  onClose,
  np,
  cover,
}: {
  open: boolean;
  onClose: () => void;
  np: NowPlayingHandle;
  cover: string | undefined;
}) {
  const tx = tSpotify.use();
  const { source, ctx, current, features, canControl } = np;
  const [player, setPlayer] = useState<PlayerState | undefined | 'none'>();
  const [tab, setTab] = useState<Tab>('playlists');
  const [playlists, setPlaylists] = useState<Load<Playlist[]>>({ state: 'loading' });
  const [liked, setLiked] = useState<Load<MediaItem[]>>({ state: 'loading' });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Load<SearchResult> | undefined>();
  const [failed, setFailed] = useState(false);
  const [seekTo, setSeekTo] = useState<number>();
  const [volume, setVolume] = useState<number>();
  const hasPlaylists = features.includes('playlists');
  const hasLiked = features.includes('library');

  const loadState = () => {
    if (!source.state) return;
    source
      .state(ctx)
      .then((s) => setPlayer(s ?? 'none'))
      .catch(() => undefined);
  };
  useEffect(loadState, [source, ctx, current?.title, current?.playing]);

  useEffect(() => {
    if (!open || !source.playlists || !hasPlaylists) return;
    let alive = true;
    source
      .playlists(ctx)
      .then((items) => alive && setPlaylists({ state: 'ready', items }))
      .catch(() => alive && setPlaylists({ state: 'error' }));
    return () => {
      alive = false;
    };
  }, [open, source, ctx, hasPlaylists]);

  useEffect(() => {
    if (!open || tab !== 'liked' || !source.likedSongs || !hasLiked) return;
    let alive = true;
    source
      .likedSongs(ctx)
      .then((items) => alive && setLiked({ state: 'ready', items }))
      .catch(() => alive && setLiked({ state: 'error' }));
    return () => {
      alive = false;
    };
  }, [open, tab, source, ctx, hasLiked]);

  const position = useProgress(
    current?.progressMs,
    current?.durationMs,
    current?.playing ?? false,
    np.readAt,
  );
  const state = player && player !== 'none' ? player : undefined;

  async function act(action: () => Promise<void>) {
    setFailed(false);
    const ok = await np.run(action);
    if (ok) {
      np.refresh(800);
      setTimeout(loadState, 1200);
    } else setFailed(true);
  }

  const playItem = (item: MediaItem, queue?: MediaItem[]) =>
    source.play ? act(() => source.play!(ctx, item, queue)) : undefined;

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!source.search || query.trim().length < 2) return;
    setResults({ state: 'loading' });
    try {
      setResults({ state: 'ready', items: await source.search(ctx, query) });
    } catch (err) {
      if (err instanceof ConnectorError && err.code === 'expired')
        await np.run(() => Promise.reject(err));
      setResults({ state: 'error' });
    }
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: 'playlists', label: tx.tabPlaylists },
    { value: 'liked', label: tx.tabLiked },
    { value: 'search', label: tx.tabSearch },
  ];

  return (
    <Dialog open={open} onClose={onClose} title={tx.playerTitle} size="wide">
      <div className={styles.player} data-testid="spotify-player">
        <div className={styles.now}>
          <div className={styles.cover}>
            {cover ? <img src={cover} alt="" /> : <Icon name="music" size={40} />}
          </div>
          <div className={styles.nowText}>
            {current ? (
              <>
                <p className={styles.title}>{current.title}</p>
                <p className={styles.artist}>{current.artist}</p>
                {current.album ? <p className={styles.album}>{current.album}</p> : null}
              </>
            ) : (
              <p className={styles.title}>{tx.nothingPlaying}</p>
            )}
            {state?.device ? <p className={styles.album}>{tx.onDevice(state.device)}</p> : null}
            {player === 'none' ? <p className={styles.album}>{tx.noDevice}</p> : null}
          </div>
        </div>

        {current && position !== undefined && current.durationMs ? (
          <div className={styles.seek}>
            <span className={styles.time}>{clock(seekTo ?? position)}</span>
            <input
              type="range"
              aria-label={tx.position}
              min={0}
              max={current.durationMs}
              step={1000}
              value={seekTo ?? position}
              disabled={!canControl || !source.seek}
              onChange={(e) => setSeekTo(Number(e.target.value))}
              onPointerUp={() => {
                if (seekTo !== undefined) void act(() => source.seek!(ctx, seekTo));
                setSeekTo(undefined);
              }}
              onKeyUp={() => {
                if (seekTo !== undefined) void act(() => source.seek!(ctx, seekTo));
                setSeekTo(undefined);
              }}
            />
            <span className={styles.time}>{clock(current.durationMs)}</span>
          </div>
        ) : null}

        {canControl ? (
          <div className={styles.controls} role="group" aria-label={tx.controlsLabel}>
            {source.setShuffle ? (
              <Button
                variant="ghost"
                aria-pressed={state?.shuffle === true}
                aria-label={tx.shuffle}
                onClick={() => void act(() => source.setShuffle!(ctx, !(state?.shuffle === true)))}
              >
                <Icon name="shuffle" size={20} />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              aria-label={tx.previous}
              onClick={() => void np.control('previous')}
            >
              <Icon name="skipBack" size={22} />
            </Button>
            <Button
              data-testid="player-toggle"
              onClick={() => void np.control(current?.playing ? 'pause' : 'play')}
            >
              <Icon name={current?.playing ? 'pause' : 'play'} size={20} />
              {current?.playing ? tx.pause : tx.resume}
            </Button>
            <Button variant="ghost" aria-label={tx.next} onClick={() => void np.control('next')}>
              <Icon name="skipForward" size={22} />
            </Button>
            {source.setRepeat ? (
              <Button
                variant="ghost"
                aria-pressed={!!state?.repeat && state.repeat !== 'off'}
                aria-label={tx.repeatMode(
                  state?.repeat === 'track'
                    ? tx.repeatTrack
                    : state?.repeat === 'context'
                      ? tx.repeatAll
                      : tx.repeatOff,
                )}
                onClick={() =>
                  void act(() => source.setRepeat!(ctx, REPEAT[state?.repeat ?? 'off']))
                }
              >
                <Icon name={state?.repeat === 'track' ? 'repeatOne' : 'repeat'} size={20} />
              </Button>
            ) : null}
          </div>
        ) : (
          <p className={styles.note}>{tx.controlsNeeded}</p>
        )}

        {canControl && source.setVolume && state?.volume !== undefined ? (
          <label className={styles.volume}>
            <Icon name="volume" size={18} />
            <span>{tx.volume}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={volume ?? state.volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              onPointerUp={() => {
                if (volume !== undefined) void act(() => source.setVolume!(ctx, volume));
                setVolume(undefined);
              }}
              onKeyUp={() => {
                if (volume !== undefined) void act(() => source.setVolume!(ctx, volume));
                setVolume(undefined);
              }}
            />
            <span className={styles.time}>{volume ?? state.volume} %</span>
          </label>
        ) : null}

        {failed ? <p className={styles.note}>{tx.playFailed}</p> : null}

        {canControl ? (
          <div className={styles.library}>
            <Segmented label={tx.playerTitle} value={tab} options={tabs} onChange={setTab} />
            {tab === 'playlists' ? (
              !hasPlaylists ? (
                <p className={styles.note}>
                  {tx.playlistReconnect} <Link to={CONNECTIONS}>{tx.settings}</Link>
                </p>
              ) : playlists.state === 'loading' ? (
                <p className={styles.note}>{tx.loading}</p>
              ) : playlists.state === 'error' ? (
                <p className={styles.note}>{tx.playlistUnavailable}</p>
              ) : (
                <MediaRows
                  empty={tx.playlistNone}
                  items={playlists.items.map((p) => ({
                    kind: 'playlist' as const,
                    id: p.id,
                    name: p.name,
                  }))}
                  onPlay={(i) => void playItem(i)}
                />
              )
            ) : null}
            {tab === 'liked' ? (
              !hasLiked ? (
                <p className={styles.note}>
                  {tx.libraryReconnect} <Link to={CONNECTIONS}>{tx.settings}</Link>
                </p>
              ) : liked.state === 'loading' ? (
                <p className={styles.note}>{tx.loading}</p>
              ) : liked.state === 'error' ? (
                <p className={styles.note}>{tx.playlistUnavailable}</p>
              ) : (
                <MediaRows
                  empty={tx.likedNone}
                  items={liked.items}
                  onPlay={(i) => void playItem(i, liked.items)}
                />
              )
            ) : null}
            {tab === 'search' ? (
              <div className={styles.search}>
                <form className={styles.searchForm} onSubmit={(e) => void runSearch(e)}>
                  <TextField
                    label={tx.searchLabel}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    enterKeyHint="search"
                  />
                  <Button type="submit" disabled={query.trim().length < 2}>
                    <Icon name="search" size={18} />
                    {tx.searchButton}
                  </Button>
                </form>
                <p className={styles.note}>{tx.searchPrivacy}</p>
                {results?.state === 'loading' ? (
                  <p className={styles.note}>{tx.searching}</p>
                ) : null}
                {results?.state === 'error' ? (
                  <p className={styles.note}>{tx.searchFailed}</p>
                ) : null}
                {results?.state === 'ready' ? (
                  results.items.tracks.length +
                    results.items.playlists.length +
                    results.items.albums.length ===
                  0 ? (
                    <p className={styles.note}>{tx.noResults}</p>
                  ) : (
                    <div data-testid="spotify-results">
                      {(
                        [
                          [tx.groupTracks, results.items.tracks],
                          [tx.groupPlaylists, results.items.playlists],
                          [tx.groupAlbums, results.items.albums],
                        ] as const
                      ).map(([label, items]) =>
                        items.length > 0 ? (
                          <section key={label}>
                            <h3 className={styles.sub}>{label}</h3>
                            <MediaRows empty="" items={items} onPlay={(i) => void playItem(i)} />
                          </section>
                        ) : null,
                      )}
                    </div>
                  )
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
