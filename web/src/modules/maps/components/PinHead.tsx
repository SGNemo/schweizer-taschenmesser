import { t } from '@/strings';
import { Icon } from '@/ui';
import styles from '../routes/maps.module.css';

/**
 * Signature of the Karten & Orte head: a still pin on quiet rings, with the last saved place as text.
 * It draws no map (nothing is fetched for the head); the rings and the pin are decoration, the sentence is the content.
 */
export function PinHead({ last }: { last?: string }) {
  return (
    <div className={styles.pinHead} data-testid="pin-head">
      <span className={styles.pinRings} aria-hidden="true">
        <Icon name="mapPin" size={26} />
      </span>
      <span>{last ? t.maps.placesBar.last(last) : t.maps.placesBar.pinHint}</span>
    </div>
  );
}
