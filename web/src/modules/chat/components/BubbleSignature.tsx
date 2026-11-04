import { HeroSlot } from '@/ui/identity';
import styles from './BubbleSignature.module.css';

/**
 * Signature "bubble": two speech bubbles, yours and the answer, drawn in outline in the module hue. Decoration only
 * (`aria-hidden`, no text of any chat): it never moves and shows nothing of what was written.
 */
export function BubbleSignature() {
  return (
    <HeroSlot>
      <div className={styles.bubbles} aria-hidden="true" data-testid="bubble-signature">
        <span className={`${styles.bubble} ${styles.answer}`}>
          <i />
          <i />
        </span>
        <span className={`${styles.bubble} ${styles.mine}`}>
          <i />
        </span>
      </div>
    </HeroSlot>
  );
}
