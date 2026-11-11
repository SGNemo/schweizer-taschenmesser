import { t } from '@/strings';
import { HeroSlot, Signature, Stamp } from '@/ui/identity';
import styles from './InboxHead.module.css';

/**
 * The stamp beside the title (`schreib`, identity v3.1): the unread count on the stamp, the inbox line next to it as
 * real text (the stamp is decoration). Outside the head (tests) it renders as it is.
 */
export function InboxStamp({ unread }: { unread: number }) {
  return (
    <div className={styles.stamp} data-testid="mail-stamp">
      <Stamp>{unread}</Stamp>
      <p className={styles.text}>
        <span className={styles.title}>{t.mail.head.inbox}</span>
        <span className={styles.context}>{t.mail.head.unread(unread)}</span>
      </p>
    </div>
  );
}

/**
 * Head of the mail page: the stamp with the count and the envelope. Identity 4.0: both are the page's signature block,
 * which lies in the page under the standard head (the title row takes a plain figure only). No mail text.
 */
export function InboxHead({ unread }: { unread?: number }) {
  return (
    <>
      {unread !== undefined ? (
        <HeroSlot area="signature">
          <InboxStamp unread={unread} />
        </HeroSlot>
      ) : null}
      <HeroSlot area="signature">
        <span className={styles.envelope} data-testid="mail-envelope">
          <Signature id="envelope" size="S" />
        </span>
      </HeroSlot>
    </>
  );
}
