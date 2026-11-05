import { HeroSlot } from '@/ui/identity';
import { t } from '@/strings';
import styles from './AddressBarSignature.module.css';

/**
 * Signature "address bar": a mono pill with the host of the page that is open, or the address prompt (never the start page's own text).
 * Decoration (`aria-hidden`, the real address field is below); no full address and no query ever reaches the head.
 */
export function AddressBarSignature({ host }: { host?: string }) {
  return (
    <HeroSlot area="signature">
      <div className={styles.bar} aria-hidden="true" data-testid="address-bar-signature">
        <span className={styles.lock} />
        <span className={styles.text}>{host || t.browser.toolbar.address}</span>
      </div>
    </HeroSlot>
  );
}
