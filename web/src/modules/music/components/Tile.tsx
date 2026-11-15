import type { CoverImage } from '@/core/connectors/coverUrl';
import { COVER_PX } from '../useCover';
import { Cover } from './Cover';
import type { PlayerApi } from './types';
import styles from '../routes/music.module.css';

/** A cover tile (start view, playlists tab): the picture, the name and one quiet line under it. A tap opens or plays. */
export function Tile({
  api,
  title,
  sub,
  cover,
  alt,
  onOpen,
  small = false,
  label,
}: {
  api: PlayerApi;
  title: string;
  sub?: string;
  cover: { coverUrl?: string; covers?: CoverImage[] };
  /** Name of the playlist or album the picture belongs to. */
  alt: string;
  onOpen: () => void;
  small?: boolean;
  /** The button's name when a tap does more than open (e.g. "Fokus weiterhören"); default: what the tile shows. */
  label?: string;
}) {
  return (
    <button
      type="button"
      className={small ? `${styles.tile} ${styles.tileSmall}` : styles.tile}
      onClick={onOpen}
      aria-label={label}
    >
      <Cover
        ctx={api.np.ctx}
        item={cover}
        px={small ? COVER_PX.tileSmall : COVER_PX.tile}
        alt={alt}
        className={styles.tileCover}
        icon={28}
        testId="music-tile-cover"
      />
      <span className={styles.tileTitle} data-testid="music-tile-title">
        {title}
      </span>
      {sub ? <span className={styles.tileSub}>{sub}</span> : null}
    </button>
  );
}
