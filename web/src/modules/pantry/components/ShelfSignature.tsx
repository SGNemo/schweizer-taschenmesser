import { HeroSlot } from '@/ui/identity';
import { t } from '@/strings';
import { PLACES, type Place } from '../schema';
import styles from './ShelfSignature.module.css';

export type ShelfCounts = Record<Place, { items: number; flagged: number }>;

/**
 * Signature "shelf with labels": one board per place that holds something, each label shows the place and
 * how many kinds are on it; a tick mark on the label says something there needs a look (expiring or low).
 * Decoration only (`aria-hidden`), it never moves; the sections below carry the same numbers as text.
 */
export function ShelfSignature({ counts }: { counts: ShelfCounts }) {
  const places = PLACES.filter((p) => counts[p].items > 0);
  if (places.length === 0) return null;
  return (
    <HeroSlot>
      <div className={styles.shelf} aria-hidden="true" data-testid="shelf-signature">
        {places.map((p) => (
          <div key={p} className={styles.board}>
            <span className={styles.label}>
              <span className={styles.name}>{t.pantry.places[p]}</span>
              <span className={styles.num}>{counts[p].items}</span>
              {counts[p].flagged > 0 ? <span className={styles.flag} /> : null}
            </span>
          </div>
        ))}
      </div>
    </HeroSlot>
  );
}
