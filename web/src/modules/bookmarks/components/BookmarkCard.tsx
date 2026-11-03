import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { RowMenu } from '@/ui';
import { hostOf, statusOf } from '../logic';
import { usePreviewImage } from '../preview';
import type { BookmarkItem } from '../schema';
import { bookmarkMenu } from './BookmarkRow';
import styles from './BookmarkCard.module.css';

/** First letter of the site (or the title) on a tile in the module hue: the card's "picture" without a preview. */
const monogramOf = (item: BookmarkItem): string =>
  (hostOf(item.url) ?? item.title)
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .charAt(0)
    .toUpperCase() || '·';

/**
 * One saved item as a card on the pinboard: the picture of the link (or a monogram tile), the title as
 * the one link, a context line (type, status, site) and the tags as text. The status is a word, never
 * only a colour.
 */
export function BookmarkCard({
  item,
  onEdit,
  onFilterTag,
  onRead,
}: {
  item: Stored<BookmarkItem>;
  onEdit: (item: Stored<BookmarkItem>) => void;
  onFilterTag: (tag: string) => void;
  onRead?: (item: Stored<BookmarkItem>) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const image = usePreviewImage(item.id, item.preview?.image);
  const status = statusOf(item);
  const site = item.preview?.site ?? hostOf(item.url);
  const title = (
    <>
      <span className={styles.name} title={item.title}>
        {item.title}
      </span>
    </>
  );
  return (
    <article
      className={styles.card}
      data-testid="bookmark-card"
      data-status={status}
      aria-label={item.title}
    >
      <div className={styles.media} aria-hidden="true">
        {image ? (
          <img className={styles.image} src={image} alt="" loading="lazy" />
        ) : (
          <span className={styles.monogram}>{monogramOf(item)}</span>
        )}
      </div>
      <div className={styles.body}>
        {item.url ? (
          <a className={styles.link} href={item.url} target="_blank" rel="noreferrer noopener">
            {title}
          </a>
        ) : (
          <button type="button" className={styles.link} onClick={() => onEdit(item)}>
            {title}
          </button>
        )}
        <p className={styles.meta}>
          {[
            t.bookmarks.kinds[item.kind],
            status === 'open' ? undefined : t.bookmarks.statuses[status],
            site,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {item.preview?.description ? (
          <p className={styles.description}>{item.preview.description}</p>
        ) : null}
        {item.tags.length > 0 ? (
          <p className={styles.tags}>{item.tags.map((x) => `#${x}`).join(' ')}</p>
        ) : null}
      </div>
      <div className={styles.menu}>
        <RowMenu
          label={`${t.bookmarks.moreOptions}: ${item.title}`}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          items={bookmarkMenu(item, { edit: onEdit, filterTag: onFilterTag, read: onRead })}
        />
      </div>
    </article>
  );
}
