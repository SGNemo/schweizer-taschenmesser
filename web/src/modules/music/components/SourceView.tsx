import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  ConnectorError,
  type MediaItem,
  type PlayerQueue,
  type SearchResult,
  type Tracklist,
} from '@/core/connectors/types';
import { readHidden, setHidden, type HiddenTracks } from '@/core/connectors/hiddenTracks';
import { settingsPath } from '@/core/settings/registry/paths';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tMusicPage } from '@/strings.musicPage';
import { tSpotify } from '@/strings.spotify';
import type { CoverImage } from '@/core/connectors/coverUrl';
import type { ConnectorContext } from '@/core/connectors/types';
import { Button, Icon, TextField } from '@/ui';
import { canEdit, changedPlaylists, readAccount } from '../library';
import { COVER_PX } from '../useCover';
import { Cover } from './Cover';
import { useAddToPlaylist } from './AddToPlaylist';
import { PlaylistDialog, type PlaylistTarget } from './PlaylistDialog';
import { PlaylistsView } from './PlaylistsView';
import { TrackList } from './TrackList';
import { useSavedTracks } from './useSavedTracks';
import { viewKey, type PlayerApi, type View } from './types';
import styles from './Spotify.module.css';

const CONNECTIONS = settingsPath('verbindungen');

type Load<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; value: T };

/** Reads once per `key` while mounted; the value is kept only as long as the view is shown. */
function useLoad<T>(read: (() => Promise<T>) | undefined, key: string): Load<T> {
  const [load, setLoad] = useState<{ key: string; result: Load<T> }>();
  useEffect(() => {
    if (!read) return;
    let alive = true;
    read()
      .then((value) => alive && setLoad({ key, result: { state: 'ready', value } }))
      .catch(() => alive && setLoad({ key, result: { state: 'error' } }));
    return () => {
      alive = false;
    };
    // `read` is rebuilt every render; the key says when to read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return load && load.key === key ? load.result : { state: 'loading' };
}

function Reconnect({ text }: { text: string }) {
  const tx = tSpotify.use();
  return (
    <p className={styles.note}>
      {text} <Link to={CONNECTIONS}>{tx.settings}</Link>
    </p>
  );
}

/** A heart column for lists of songs: shared by every list view. */
function useHearts(api: PlayerApi, items: readonly MediaItem[]) {
  const tx = tSpotify.use();
  const { canSave, saved, toggle, problem } = useSavedTracks(
    api.np,
    items.map((i) => i.id),
  );
  const note =
    problem === 'reconnect' ? (
      <Reconnect text={tx.likeNeedsReconnect} />
    ) : problem === 'failed' ? (
      <p className={styles.note}>{tx.likeFailed}</p>
    ) : null;
  return {
    saved,
    note,
    onToggleSave: canSave ? (item: MediaItem, on: boolean) => void toggle(item.id, on) : undefined,
  };
}

function useQueueAction(api: PlayerApi) {
  const tx = tSpotify.use();
  const toast = useUiStore((s) => s.toast);
  const { source, ctx } = api.np;
  if (!source.addToQueue || !api.np.canControl) return undefined;
  return (item: MediaItem) =>
    void api.act(() => source.addToQueue!(ctx, item.id)).then((ok) => ok && toast(tx.queued));
}

/** A plain list of songs (saved, recent): a tap plays the song and the rest of the list after it. */
function SongList({
  api,
  items,
  empty,
}: {
  api: PlayerApi;
  items: readonly MediaItem[];
  empty: string;
}) {
  const hearts = useHearts(api, items);
  const queue = useQueueAction(api);
  const add = useAddToPlaylist(api);
  if (items.length === 0) return <p className={styles.note}>{empty}</p>;
  return (
    <>
      {hearts.note}
      {add.dialog}
      <TrackList
        ctx={api.np.ctx}
        items={items}
        playingId={api.playingId}
        onPlay={(i) => void api.playFromList(i, items)}
        onQueue={queue}
        onAddToPlaylist={add.onAdd}
        saved={hearts.saved}
        onToggleSave={hearts.onToggleSave}
      />
    </>
  );
}

function ListHeader({
  title,
  sub,
  about,
  focusTitle = false,
  ctx,
  cover,
  children,
}: {
  title: string;
  sub?: string;
  /** A playlist's description (plain text). */
  about?: string;
  /** The list was opened by a tap: focus moves to its title, so a screen reader and the keyboard start there. */
  focusTitle?: boolean;
  ctx?: ConnectorContext;
  cover?: { coverUrl?: string; covers?: CoverImage[] };
  children?: React.ReactNode;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusTitle) titleRef.current?.focus();
  }, [focusTitle]);
  return (
    <header className={styles.header}>
      <Cover
        ctx={ctx}
        item={cover}
        px={COVER_PX.head}
        alt={title}
        className={styles.headCover}
        icon={36}
        testId="music-list-cover"
      />
      <div className={styles.headText}>
        <h3 className={styles.headTitle} ref={titleRef} tabIndex={focusTitle ? -1 : undefined}>
          {title}
        </h3>
        {sub ? <p className={styles.headSub}>{sub}</p> : null}
        {about ? (
          <p className={styles.headAbout} data-testid="music-list-about">
            {about}
          </p>
        ) : null}
        {children}
      </div>
    </header>
  );
}

/** A playlist or an album: header with play / shuffle, then every song. Songs can be hidden here. */
function ContentView({
  api,
  view,
}: {
  api: PlayerApi;
  view: Extract<View, { type: 'playlist' | 'album' }>;
}) {
  const tx = tSpotify.use();
  const tm = tMusicPage.use();
  const toast = useUiStore((s) => s.toast);
  const { source, ctx, canControl, features } = api.np;
  const list = useLoad<Tracklist>(
    source.tracks ? () => source.tracks!(ctx, view.type, view.id) : undefined,
    viewKey(view),
  );
  const [me, setMe] = useState<string | undefined>();
  useEffect(() => {
    if (view.type !== 'playlist' || !features.includes('playlistEdit')) return;
    let alive = true;
    readAccount(source, ctx).then(
      (id) => alive && setMe(id),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [view.type, features, source, ctx]);
  // Edits made here, shown at once (Spotify takes a moment to report them back).
  const [edited, setEdited] = useState<{ name: string; description?: string }>();
  const [editing, setEditing] = useState<PlaylistTarget | null>(null);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [hiddenAll, setHiddenAll] = useState<HiddenTracks>(readHidden);
  const [showHidden, setShowHidden] = useState(false);
  const hiddenIds = new Set(hiddenAll[view.id] ?? []);
  const items = list.state === 'ready' ? list.value.items.filter((i) => !removed.has(i.id)) : [];
  const hearts = useHearts(api, items);
  const queue = useQueueAction(api);
  const add = useAddToPlaylist(api);
  const visible = items.filter((i) => !hiddenIds.has(i.id));
  const hiddenHere = items.length - visible.length;

  const hide = (item: MediaItem, on: boolean) => setHiddenAll(setHidden(view.id, item.id, on));

  // Nothing hidden: the playlist itself plays (and goes on beyond the 200 shown). Otherwise the visible
  // songs are the list, so the hidden ones are skipped.
  const playAll = (shuffle: boolean) =>
    void api.act(async () => {
      if (shuffle && source.setShuffle) await source.setShuffle(ctx, true);
      if (hiddenHere === 0 && source.play) {
        await source.play(ctx, { kind: view.type, id: view.id, name: view.name });
      } else if (source.play && visible[0]) {
        await source.play(ctx, visible[0], visible);
      }
    });

  const playOne = (item: MediaItem) => {
    if (hiddenHere === 0 && source.playFrom)
      void api.act(() => source.playFrom!(ctx, { kind: view.type, id: view.id }, item.id));
    else void api.playFromList(item, visible);
  };

  const back =
    view.type === 'playlist' && view.back === 'playlists' ? (
      <Button
        variant="ghost"
        className={styles.backButton}
        onClick={() => api.open({ type: 'playlists' })}
      >
        <Icon name="chevronLeft" size={18} />
        {tm.backToPlaylists}
      </Button>
    ) : null;
  if (list.state === 'loading')
    return (
      <>
        {back}
        <p className={styles.note}>{tx.loading}</p>
      </>
    );
  if (list.state === 'error')
    return (
      <>
        {back}
        <p className={styles.note}>{tx.listFailed}</p>
      </>
    );
  const { value } = list;
  const name = edited?.name ?? (value.name || view.name);
  const about = edited ? edited.description : value.description;
  // Changing the playlist: the feature "Playlists bearbeiten" and a playlist this account may change (own or shared).
  const editable =
    view.type === 'playlist' && features.includes('playlistEdit') && canEdit(value, me);

  /** Removes a song from the playlist on Spotify (every time it is in there), with "Rückgängig" that puts it back. */
  const remove = (item: MediaItem) => {
    setRemoved((r) => new Set(r).add(item.id));
    const putBack = () => setRemoved((r) => new Set([...r].filter((x) => x !== item.id)));
    source.removeFromPlaylist!(ctx, view.id, [item.id]).then(
      () =>
        toast(tm.removed(item.name), {
          label: t.ui.undo,
          run: () => {
            putBack();
            source.addToPlaylist!(ctx, view.id, [item.id], item.position).catch(() => {
              setRemoved((r) => new Set(r).add(item.id));
              toast(tm.restoreFailed);
            });
          },
        }),
      () => {
        putBack();
        toast(tm.removeFailed);
      },
    );
  };
  return (
    <>
      {back}
      <ListHeader
        title={name}
        sub={[
          value.subtitle,
          tx.tracksCount(Math.max(0, (value.total ?? items.length) - removed.size)),
        ]
          .filter(Boolean)
          .join(' · ')}
        about={about}
        focusTitle
        ctx={ctx}
        cover={value}
      >
        {canControl || (editable && source.editPlaylist) ? (
          <div className={styles.headActions}>
            {canControl ? (
              <Button onClick={() => playAll(false)} disabled={visible.length === 0}>
                <Icon name="play" size={18} />
                {tx.playAll}
              </Button>
            ) : null}
            {canControl && source.setShuffle ? (
              <Button variant="ghost" onClick={() => playAll(true)} disabled={visible.length === 0}>
                <Icon name="shuffle" size={18} />
                {tx.shuffleAll}
              </Button>
            ) : null}
            {editable && source.editPlaylist ? (
              <Button
                variant="ghost"
                aria-label={tm.editFor(name)}
                onClick={() => setEditing({ kind: 'edit', id: view.id, name, description: about })}
              >
                <Icon name="edit" size={18} />
                {tm.edit}
              </Button>
            ) : null}
          </div>
        ) : null}
        {view.type === 'playlist' && hiddenHere > 0 ? (
          <p className={styles.note}>
            {tx.hiddenCount(hiddenHere)} ·{' '}
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => setShowHidden((v) => !v)}
            >
              {showHidden ? tx.hideHidden : tx.showHidden}
            </button>
          </p>
        ) : null}
      </ListHeader>
      {hearts.note}
      {add.dialog}
      {value.total !== undefined && value.total > items.length ? (
        <p className={styles.note}>{tx.tracksShown(items.length, value.total)}</p>
      ) : null}
      <TrackList
        ctx={api.np.ctx}
        items={items}
        playingId={api.playingId}
        onPlay={playOne}
        onQueue={queue}
        onAddToPlaylist={add.onAdd}
        onRemove={
          editable && source.removeFromPlaylist && source.addToPlaylist ? remove : undefined
        }
        saved={hearts.saved}
        onToggleSave={hearts.onToggleSave}
        hidden={view.type === 'playlist' ? hiddenIds : undefined}
        onHide={view.type === 'playlist' ? (i) => hide(i, true) : undefined}
        onUnhide={view.type === 'playlist' ? (i) => hide(i, false) : undefined}
        showHidden={showHidden}
      />
      {view.type === 'playlist' ? <p className={styles.note}>{tx.hiddenNote}</p> : null}
      {editable ? (
        <PlaylistDialog
          api={api}
          target={editing}
          onClose={() => setEditing(null)}
          onDone={(saved) => {
            setEditing(null);
            setEdited({ name: saved.name, description: saved.description });
            changedPlaylists();
          }}
        />
      ) : null}
    </>
  );
}

function QueueView({ api }: { api: PlayerApi }) {
  const tx = tSpotify.use();
  const { source, ctx } = api.np;
  const q = useLoad<PlayerQueue>(
    source.queue ? () => source.queue!(ctx) : undefined,
    `queue:${api.version}`,
  );
  if (q.state === 'loading') return <p className={styles.note}>{tx.loading}</p>;
  if (q.state === 'error') return <p className={styles.note}>{tx.listFailed}</p>;
  return (
    <>
      <h3 className={styles.sub}>{tx.queueNow}</h3>
      {q.value.current ? (
        <TrackList
          ctx={ctx}
          items={[q.value.current]}
          playingId={api.playingId}
          onPlay={() => undefined}
        />
      ) : (
        <p className={styles.note}>{tx.nothingPlaying}</p>
      )}
      <h3 className={styles.sub}>{tx.queueNext}</h3>
      <p className={styles.note}>{tx.queueNote}</p>
      {q.value.next.length === 0 ? (
        <p className={styles.note}>{tx.queueEmpty}</p>
      ) : (
        <SongList api={api} items={q.value.next} empty={tx.queueEmpty} />
      )}
    </>
  );
}

function SearchView({ api }: { api: PlayerApi }) {
  const tx = tSpotify.use();
  const { source, ctx } = api.np;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Load<SearchResult> | undefined>();

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!source.search || query.trim().length < 2) return;
    setResults({ state: 'loading' });
    try {
      setResults({ state: 'ready', value: await source.search(ctx, query) });
    } catch (err) {
      if (err instanceof ConnectorError && err.code === 'expired')
        await api.np.run(() => Promise.reject(err));
      setResults({ state: 'error' });
    }
  }

  const found = results?.state === 'ready' ? results.value : undefined;
  return (
    <div className={styles.search}>
      <form className={styles.searchForm} onSubmit={(e) => void run(e)}>
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
      {results?.state === 'loading' ? <p className={styles.note}>{tx.searching}</p> : null}
      {results?.state === 'error' ? <p className={styles.note}>{tx.searchFailed}</p> : null}
      {found ? (
        found.tracks.length + found.playlists.length + found.albums.length === 0 ? (
          <p className={styles.note}>{tx.noResults}</p>
        ) : (
          <div data-testid="spotify-results">
            {found.tracks.length > 0 ? (
              <section>
                <h3 className={styles.sub}>{tx.groupTracks}</h3>
                <SongList api={api} items={found.tracks} empty="" />
              </section>
            ) : null}
            {(
              [
                [tx.groupPlaylists, found.playlists, 'playlist'],
                [tx.groupAlbums, found.albums, 'album'],
              ] as const
            ).map(([label, items, type]) =>
              items.length > 0 ? (
                <section key={label}>
                  <h3 className={styles.sub}>{label}</h3>
                  <ul className={styles.plain}>
                    {items.map((i) => (
                      <li key={i.id}>
                        <button
                          type="button"
                          className={styles.navItem}
                          onClick={() => api.open({ type, id: i.id, name: i.name })}
                        >
                          <Cover
                            ctx={ctx}
                            item={i}
                            px={COVER_PX.row}
                            alt={i.name}
                            className={styles.rowCover}
                            icon={16}
                          />
                          <span className={styles.navName}>{i.name}</span>
                          {i.subtitle ? (
                            <span className={styles.trackSub}>{i.subtitle}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null,
            )}
          </div>
        )
      ) : null}
    </div>
  );
}

/** The main pane of the player: one list at a time, picked in the library on the left. */
export function SourceView({ api, view }: { api: PlayerApi; view: View }) {
  const tx = tSpotify.use();
  const { source, ctx, features } = api.np;
  const liked = useLoad<MediaItem[]>(
    view.type === 'liked' && source.likedSongs && features.includes('library')
      ? () => source.likedSongs!(ctx)
      : undefined,
    `liked:${api.version}`,
  );
  const recent = useLoad<MediaItem[]>(
    view.type === 'recent' && source.recent && features.includes('history')
      ? () => source.recent!(ctx)
      : undefined,
    `recent:${api.version}`,
  );

  if (view.type === 'playlist' || view.type === 'album')
    return <ContentView key={viewKey(view)} api={api} view={view} />;
  if (view.type === 'queue') return <QueueView api={api} />;
  if (view.type === 'playlists') return <PlaylistsView api={api} />;
  if (view.type === 'search') return <SearchView api={api} />;
  if (view.type === 'liked') {
    if (!features.includes('library')) return <Reconnect text={tx.libraryReconnect} />;
    return (
      <>
        <ListHeader title={tx.tabLiked} />
        {liked.state === 'loading' ? (
          <p className={styles.note}>{tx.loading}</p>
        ) : liked.state === 'error' ? (
          <p className={styles.note}>{tx.listFailed}</p>
        ) : (
          <SongList api={api} items={liked.value} empty={tx.likedNone} />
        )}
      </>
    );
  }
  if (!features.includes('history')) return <Reconnect text={tx.historyReconnect} />;
  return (
    <>
      <ListHeader title={tx.navRecent} />
      {recent.state === 'loading' ? (
        <p className={styles.note}>{tx.loading}</p>
      ) : recent.state === 'error' ? (
        <p className={styles.note}>{tx.listFailed}</p>
      ) : (
        <SongList api={api} items={recent.value} empty={tx.recentNone} />
      )}
    </>
  );
}
