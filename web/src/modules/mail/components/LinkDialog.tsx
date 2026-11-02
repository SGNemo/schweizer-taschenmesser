import { useState } from 'react';
import { mailPrefill, type MailLinkType } from '@/core/mail/prefill';
import type { MailAccountRef, MailMessage } from '@/core/mail/types';
import { today } from '@/core/time/now';
import { CaptureForm } from '@/quickCapture/ui/CaptureForm';
import { announceSaved } from '@/quickCapture/ui/announceSaved';
import { t } from '@/strings';
import { Checkbox, Dialog } from '@/ui';
import { saveLink } from '../links';
import styles from './mail.module.css';

/**
 * Create something from a mail: the capture sheet opens prefilled (what the mail's text suggests) and
 * saves only after "Speichern". The link to the mail is stored with the entry and listed here first,
 * so nothing is saved along unseen; the start of the mail text only goes into a note when ticked.
 */
export function LinkDialog({
  account,
  threadId,
  message,
  link,
  type,
  onClose,
}: {
  account: MailAccountRef;
  threadId: string;
  message: MailMessage;
  /** Address that opens the mail; absent for sample mail. */
  link?: string;
  type: MailLinkType | undefined;
  onClose: () => void;
}) {
  const [excerpt, setExcerpt] = useState(false);
  const prefill = type
    ? mailPrefill(type, message, { link, today: today(), withExcerpt: excerpt })
    : undefined;

  return (
    <Dialog
      open={type !== undefined}
      onClose={onClose}
      title={type ? t.mail.link.title(t.quickCapture.type[type]) : ''}
      size="roomy"
      askAfterTyping
    >
      {prefill && type ? (
        <div className={styles.panel}>
          <p className={styles.hint}>{t.mail.link.intro}</p>
          {type === 'note' && prefill.excerpt ? (
            <>
              <Checkbox
                label={t.mail.link.excerpt}
                checked={excerpt}
                onChange={(e) => setExcerpt(e.target.checked)}
              />
              {excerpt ? (
                <blockquote className={styles.excerpt}>{prefill.excerpt}</blockquote>
              ) : null}
            </>
          ) : null}
          <CaptureForm
            key={`${type}-${message.id}`}
            initialText={prefill.text}
            initialType={type}
            extra={prefill.extra}
            onCancel={onClose}
            onSaved={(saved) => {
              void saveLink(account.key, threadId, message.id, saved);
              announceSaved(saved);
              onClose();
            }}
          />
          <p className={styles.hint}>{link ? t.mail.link.stores : t.mail.link.storesNothing}</p>
        </div>
      ) : null}
    </Dialog>
  );
}
