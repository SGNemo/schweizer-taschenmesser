import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Playlist } from '@/core/connectors/types';
import { settingsPath } from '@/core/settings/registry/paths';
import { tMusicPage } from '@/strings.musicPage';
import { tSpotify } from '@/strings.spotify';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  Segmented,
  SelectField,
  SkeletonRows,
  TextField,
} from '@/ui';
import { readAccount, readAllPlaylists } from '../library';
import {
  isOwn,
  readView,
  selectPlaylists,
  writeView,
  type PlaylistFilter,
  type PlaylistSort,
  type PlaylistView,
} from '../playlistFilter';
import { PlaylistDialog } from './PlaylistDialog';
import { Tile } from './Tile';
import type { PlayerApi } from './types';
import styles from '../routes/music.module.css';

const CONNECTIONS = settingsPath('verbindungen');

/**
 * The playlists tab: every playlist of the account (own and followed, up to 1000) as cover tiles, with a search over
 * name and description, a filter (Alle / Eigene / Gefolgte) and a sort. A tap opens the playlist; "Neue Playlist" makes
 * one (feature "Playlists bearbeiten"). Filter and sort stay on this device; the names are read on request and kept
 * only while the page is open.
 */
export function PlaylistsView({ api }: { api: PlayerApi }) {
  const tm = tMusicPage.use();
  const tx = tSpotify.use();
  const { source, ctx, features } = api.np;
  const canList = features.includes('playlists') && !!source.playlists;
  const canCreate = features.includes('playlistEdit') && !!source.createPlaylist;
  const [lists, setLists] = useState<Playlist[] | 'error' | undefined>();
  // `undefined` while asked, `null` when the account id is not known (the filter then goes: nothing would count as own).
  const [me, setMe] = useState<string | null | undefined>();
  const [view, setView] = useState<PlaylistView>(readView);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!canList) return;
    let alive = true;
    readAllPlaylists(source, ctx).then(
      (l) => alive && setLists(l),
      () => alive && setLists('error'),
    );
    readAccount(source, ctx).then(
      (id) => alive && setMe(id ?? null),
      () => alive && setMe(null),
    );
    return () => {
      alive = false;
    };
  }, [source, ctx, canList, round]);

  const change = (next: Partial<PlaylistView>) => {
    const v = { ...view, ...next };
    setView(v);
    writeView(v);
  };
  const all = useMemo(() => (Array.isArray(lists) ? lists : []), [lists]);
  const shown = useMemo(
    () => selectPlaylists(all, view, query, me ?? undefined),
    [all, view, query, me],
  );
  const narrowed = shown.length !== all.length;

  if (!canList)
    return (
      <p className={styles.note}>
        {tm.startNeedsPlaylists} <Link to={CONNECTIONS}>{tx.settings}</Link>
      </p>
    );

  return (
    <section className={styles.lib} aria-labelledby="music-lib-title" data-testid="music-lib">
      <div className={styles.libHead}>
        <div className={styles.libTitle}>
          <h2 id="music-lib-title" className={styles.sectionTitle}>
            {tm.tabPlaylists}
          </h2>
          {/* The count is announced when search or filter change it (the heading stays the same). */}
          <span className={styles.libCount} role="status" data-testid="music-lib-count">
            {Array.isArray(lists)
              ? narrowed
                ? tm.playlistsShown(shown.length, all.length)
                : tm.playlistsCount(all.length)
              : ''}
          </span>
        </div>
        {canCreate ? (
          <Button onClick={() => setCreating(true)}>
            <Icon name="plus" size={18} />
            {tm.newPlaylist}
          </Button>
        ) : null}
      </div>
      {all.length > 0 ? (
        <div className={styles.libTools}>
          <TextField
            type="search"
            label={tm.playlistsSearch}
            labelHidden
            placeholder={tm.playlistsSearch}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-list-search=""
          />
          {me !== null ? (
            <Segmented<PlaylistFilter>
              label={tm.filterLabel}
              value={view.filter}
              options={[
                { value: 'all', label: tm.filterAll },
                { value: 'own', label: tm.filterOwn },
                { value: 'followed', label: tm.filterFollowed },
              ]}
              onChange={(filter) => change({ filter })}
            />
          ) : null}
          <SelectField
            label={tm.sortLabel}
            labelHidden
            value={view.sort}
            onChange={(e) => change({ sort: e.target.value as PlaylistSort })}
          >
            <option value="spotify">{tm.sortSpotify}</option>
            <option value="name">{tm.sortName}</option>
            <option value="count">{tm.sortCount}</option>
          </SelectField>
        </div>
      ) : null}
      {lists === undefined ? (
        <SkeletonRows count={3} />
      ) : lists === 'error' ? (
        <ErrorState title={tx.playlistUnavailable} onRetry={() => setRound((r) => r + 1)} />
      ) : all.length === 0 ? (
        <EmptyState compact title={tm.playlistsNone} />
      ) : shown.length === 0 ? (
        <EmptyState compact title={tm.playlistsNoMatch}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              change({ filter: 'all' });
            }}
          >
            {tm.playlistsReset}
          </Button>
        </EmptyState>
      ) : (
        <ul className={styles.grid} data-testid="music-lib-grid">
          {shown.map((p) => (
            <li key={p.id}>
              <Tile
                api={api}
                title={p.name}
                // The count first: on a narrow tile the end of the line is cut off.
                sub={[
                  p.trackCount !== undefined ? tm.tracks(p.trackCount) : undefined,
                  p.owner && !isOwn(p, me ?? undefined) ? tm.byOwner(p.owner) : undefined,
                  p.collaborative ? tm.shared : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                cover={p}
                alt={p.name}
                onOpen={() =>
                  api.open({ type: 'playlist', id: p.id, name: p.name, back: 'playlists' })
                }
              />
            </li>
          ))}
        </ul>
      )}
      {!canCreate && Array.isArray(lists) ? (
        // A quiet line under the tiles, not above them: it says once where the switch is, it does not ask.
        <p className={styles.note}>
          {tm.newNeedsEdit} <Link to={CONNECTIONS}>{tx.settings}</Link>
        </p>
      ) : null}
      {canCreate ? (
        <PlaylistDialog
          api={api}
          target={creating ? { kind: 'new' } : null}
          onClose={() => setCreating(false)}
          onDone={(made) => {
            setCreating(false);
            api.open({ type: 'playlist', id: made.id, name: made.name, back: 'playlists' });
          }}
        />
      ) : null}
    </section>
  );
}
