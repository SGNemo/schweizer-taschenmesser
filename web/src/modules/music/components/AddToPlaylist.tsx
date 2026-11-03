import { useEffect, useState } from 'react';
import type { MediaItem, Playlist } from '@/core/connectors/types';
import { useUiStore } from '@/stores/ui';
import { tSpotify } from '@/strings.spotify';
import { Button, Dialog, Form, TextField } from '@/ui';
import type { PlayerApi } from './types';
import styles from './Spotify.module.css';

/**
 * "Zu Playlist hinzufügen …" for a song: a short dialog (pick one of your playlists, or name a new one). Only offered when
 * the connection has "Playlists bearbeiten" switched on; one request per choice, nothing is kept.
 */
export function useAddToPlaylist(api: PlayerApi): {
  onAdd: ((item: MediaItem) => void) | undefined;
  dialog: React.ReactNode;
} {
  const { source, features } = api.np;
  const [item, setItem] = useState<MediaItem | null>(null);
  const can =
    features.includes('playlistEdit') && !!source.addToPlaylist && !!source.createPlaylist;
  return {
    onAdd: can ? setItem : undefined,
    dialog: can ? <PlaylistPicker api={api} item={item} onClose={() => setItem(null)} /> : null,
  };
}

function PlaylistPicker({
  api,
  item,
  onClose,
}: {
  api: PlayerApi;
  item: MediaItem | null;
  onClose: () => void;
}) {
  const tx = tSpotify.use();
  const toast = useUiStore((s) => s.toast);
  const { source, ctx, features } = api.np;
  const [loaded, setLoaded] = useState<{ item: string; lists: Playlist[] | 'error' } | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = item?.id;
  // Without the "playlists" feature there is nothing to pick from: only "new playlist" is offered.
  const canList = !!source.playlists && features.includes('playlists');
  const lists = !canList ? [] : loaded && loaded.item === id ? loaded.lists : undefined;

  useEffect(() => {
    if (!id || !canList) return;
    let alive = true;
    source.playlists!(ctx).then(
      (l) => alive && setLoaded({ item: id, lists: l }),
      () => alive && setLoaded({ item: id, lists: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, [id, canList, source, ctx]);

  async function add(target: Playlist | undefined) {
    if (!item || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const list = target ?? (await source.createPlaylist!(ctx, name.trim() || tx.newPlaylist));
      await source.addToPlaylist!(ctx, list.id, [item.id]);
      toast(tx.addedToPlaylist(list.name));
      setName('');
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={item !== null} onClose={onClose} title={tx.addToPlaylistTitle}>
      {item ? <p className={styles.note}>{item.name}</p> : null}
      {lists === undefined ? <p className={styles.note}>{tx.loading}</p> : null}
      {lists === 'error' ? <p className={styles.note}>{tx.listFailed}</p> : null}
      {Array.isArray(lists) && lists.length === 0 ? (
        <p className={styles.note}>{tx.noOwnPlaylists}</p>
      ) : null}
      {Array.isArray(lists) && lists.length > 0 ? (
        <ul className={styles.pickList} aria-label={tx.addToPlaylistTitle}>
          {lists.map((l) => (
            <li key={l.id}>
              <Button onClick={() => void add(l)} disabled={busy}>
                {l.name}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <Form onSubmit={() => void add(undefined)}>
        <TextField
          label={tx.playlistName}
          placeholder={tx.newPlaylist}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          {tx.newPlaylistCreate}
        </Button>
      </Form>
      {failed ? <p role="alert">{tx.playlistEditFailed}</p> : null}
    </Dialog>
  );
}
