import { tMusicPage } from '@/strings.musicPage';
import { Button, Icon } from '@/ui';
import { backView, type Back, type PlayerApi } from './types';
import styles from './Spotify.module.css';

/** "Zurück zu …" above a list that was opened from a tab or an artist page; nothing when it was opened from a tab itself. */
export function BackButton({ api, back }: { api: PlayerApi; back: Back | undefined }) {
  const tm = tMusicPage.use();
  if (!back) return null;
  const label =
    back === 'start'
      ? tm.backToStart
      : back === 'playlists'
        ? tm.backToPlaylists
        : back === 'albums'
          ? tm.backToAlbums
          : tm.backToArtist(back.name);
  return (
    <Button variant="ghost" className={styles.backButton} onClick={() => api.open(backView(back))}>
      <Icon name="chevronLeft" size={18} />
      {label}
    </Button>
  );
}
