import { t } from '@/strings';
import { Icon } from '@/ui';
import type { IconName } from '@/ui/icons';
import styles from '../routes/maps.module.css';

export interface ShelfTile {
  key: string;
  label: string;
  count: number;
  icon: IconName;
}

/**
 * Signature of the Karten & Orte head (shelf head): a still pin on quiet rings with the last saved place as text, and
 * up to four category tiles with their counts on a shelf line. It draws no map (nothing is fetched for the head);
 * the rings, the pin and the shelf are decoration, the sentence and the counts are the content.
 */
export function PinHead({ last, tiles }: { last?: string; tiles?: readonly ShelfTile[] }) {
  return (
    <div className={styles.pinHead} data-testid="pin-head">
      <span className={styles.pinRings} aria-hidden="true">
        <Icon name="mapPin" size={26} />
      </span>
      <span>{last ? t.maps.placesBar.last(last) : t.maps.placesBar.pinHint}</span>
      {tiles && tiles.length > 0 ? (
        <ul className={styles.shelf} data-testid="pin-shelf">
          {tiles.map((x) => (
            <li key={x.key} className={styles.shelfTile}>
              <Icon name={x.icon} size={16} />
              <strong>{x.count}</strong>
              <span>{x.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
