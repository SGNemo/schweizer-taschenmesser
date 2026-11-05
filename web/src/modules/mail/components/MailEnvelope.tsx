import { HeroSlot } from '@/ui/identity';
import styles from './MailEnvelope.module.css';

/**
 * Signature "envelope": a closed envelope with its flap and two address lines, beside the stamp that carries the
 * unread count. Pure decoration (`aria-hidden`, no mail text, no numbers): it never moves and shows nothing of any message.
 */
export function MailEnvelope() {
  return (
    <HeroSlot area="signature">
      <div className={styles.envelope} aria-hidden="true" data-testid="mail-envelope">
        <svg viewBox="0 0 120 80" className={styles.flap} width="120" height="80">
          <path d="M4 10 60 50 116 10" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className={styles.lines}>
          <i />
          <i />
        </span>
        <span className={styles.postmark} />
      </div>
    </HeroSlot>
  );
}
