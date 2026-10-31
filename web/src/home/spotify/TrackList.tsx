import { useState } from 'react';
import type { MediaItem } from '@/core/connectors/types';
import { getPlatform } from '@/core/platform';
import { tSpotify } from '@/strings.spotify';
import { Icon, RowMenu, type RowMenuItem } from '@/ui';
import { clock } from '../nowPlayingTime';
import styles from './Spotify.module.css';

/** Link of a track on Spotify's site (built from the checked id, never taken from a response). */
export const trackUrl = (id: string): string => `https://open.spotify.com/track/${id}`;

export interface TrackListProps {
  items: readonly MediaItem[];
  /** The id of the song that plays now, to mark its row. */
  playingId?: string;
  onPlay: (item: MediaItem) => void;
  onQueue?: (item: MediaItem) => void;
  /** Hearts: `saved` by track id; `onToggleSave` is absent when saving is not possible. */
  saved?: Record<string, boolean>;
  onToggleSave?: (item: MediaItem, on: boolean) => void;
  /** Songs hidden in this list, and the handlers that hide or show one (absent = no hiding here). */
  hidden?: ReadonlySet<string>;
  onHide?: (item: MediaItem) => void;
  onUnhide?: (item: MediaItem) => void;
  showHidden?: boolean;
}

/**
 * Songs as a table: play, title and artist, album, a heart, the length and a "⋯" menu (queue, hide, open
 * in Spotify). A tap on the title starts that song. Hidden songs are left out (or dimmed with a mark
 * while "Ausgeblendete zeigen" is on).
 */
export function TrackList({
  items,
  playingId,
  onPlay,
  onQueue,
  saved,
  onToggleSave,
  hidden,
  onHide,
  onUnhide,
  showHidden,
}: TrackListProps) {
  const tx = tSpotify.use();
  const [menu, setMenu] = useState<string>();
  const rows = items.filter((i) => showHidden || !hidden?.has(i.id));
  if (rows.length === 0) return <p className={styles.note}>{tx.noTracks}</p>;
  return (
    <div className={styles.table} role="table" aria-label={tx.colTitle}>
      <div className={styles.head} role="row">
        <span role="columnheader">{tx.colTitle}</span>
        <span role="columnheader" className={styles.colAlbum}>
          {tx.colAlbum}
        </span>
        <span role="columnheader" className={styles.colLength}>
          {tx.colLength}
        </span>
      </div>
      <ul className={styles.rows}>
        {rows.map((item, index) => {
          const rowKey = `${item.id}:${index}`;
          const isHidden = hidden?.has(item.id) === true;
          const isSaved = saved?.[item.id] === true;
          const actions: RowMenuItem[] = [
            { id: 'play', label: tx.play(item.name), onSelect: () => onPlay(item) },
            ...(onQueue
              ? [{ id: 'queue', label: tx.menuQueue, onSelect: () => onQueue(item) }]
              : []),
            ...(isHidden && onUnhide
              ? [{ id: 'show', label: tx.menuShow, onSelect: () => onUnhide(item) }]
              : []),
            ...(!isHidden && onHide
              ? [{ id: 'hide', label: tx.menuHide, onSelect: () => onHide(item) }]
              : []),
            {
              id: 'open',
              label: tx.menuOpen,
              onSelect: () => void getPlatform().app.openUrl(trackUrl(item.id)),
            },
          ];
          return (
            <li
              key={rowKey}
              className={[
                styles.track,
                item.id === playingId ? styles.playing : '',
                isHidden ? styles.dim : '',
              ].join(' ')}
              data-testid="track-row"
            >
              <button
                type="button"
                className={styles.trackMain}
                aria-label={tx.play(item.name)}
                onClick={() => onPlay(item)}
              >
                <span className={styles.index} aria-hidden="true">
                  {item.id === playingId ? <Icon name="volume" size={14} /> : index + 1}
                </span>
                <span className={styles.trackText}>
                  <span className={styles.trackName}>{item.name}</span>
                  {item.subtitle ? <span className={styles.trackSub}>{item.subtitle}</span> : null}
                </span>
                <span className={styles.trackAlbum}>{item.album ?? ''}</span>
              </button>
              {isHidden ? (
                <span className={styles.hiddenMark} title={tx.menuShow}>
                  <Icon name="eyeOff" size={14} />
                </span>
              ) : null}
              {onToggleSave ? (
                <button
                  type="button"
                  className={[styles.heart, isSaved ? styles.heartOn : ''].join(' ')}
                  aria-pressed={isSaved}
                  aria-label={isSaved ? tx.unlike(item.name) : tx.like(item.name)}
                  onClick={() => onToggleSave(item, !isSaved)}
                >
                  <Icon name="heart" size={16} />
                </button>
              ) : null}
              <span className={styles.length}>{item.durationMs ? clock(item.durationMs) : ''}</span>
              <RowMenu
                label={tx.moreFor(item.name)}
                items={actions}
                open={menu === rowKey}
                onOpenChange={(o) => setMenu(o ? rowKey : undefined)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
