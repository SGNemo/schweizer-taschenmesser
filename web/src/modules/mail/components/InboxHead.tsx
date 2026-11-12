import { t } from '@/strings';
import { HeroFigure, HeroSlot } from '@/ui/identity';

/**
 * The head's one figure of the mail page (Identity 4.0): the unread count of the inbox, named by its unit and its
 * context line. Nothing is unread: no figure and no zero. No mail text. Outside the head (tests) it renders as it is.
 */
export function InboxFigure({ unread }: { unread: number }) {
  if (unread <= 0) return null;
  return (
    <HeroFigure
      label={t.mail.head.inbox}
      value={String(unread)}
      unit={t.mail.head.unreadUnit}
      detail={t.mail.head.inbox}
      testId="mail-stamp"
    />
  );
}

/** Head of the mail page: the unread figure in the title row. The stamp is the empty state's motif. */
export function InboxHead({ unread }: { unread?: number }) {
  return unread ? (
    <HeroSlot area="figure">
      <InboxFigure unread={unread} />
    </HeroSlot>
  ) : null;
}
