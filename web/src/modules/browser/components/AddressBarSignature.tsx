import { HeroSlot } from '@/ui/identity';
import { t } from '@/strings';
import styles from './AddressBarSignature.module.css';

/**
 * Signature "address bar": a mono pill with the host of the page that is open, or the question of the start page.
 * Decoration (`aria-hidden`, the real address field is below); no full address and no query ever reaches the head.
 */
export function AddressBarSignature({ host }: { host?: string }) {
  return (
    <HeroSlot>
      <div className={styles.bar} aria-hidden="true" data-testid="address-bar-signature">
        <span className={styles.lock} />
        <span className={styles.text}>{host || t.browser.start.title}</span>
      </div>
    </HeroSlot>
  );
}
