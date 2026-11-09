import { useEffect, useState } from 'react';
import { suggestCaptureLine } from '@/core/mail/localAssist';
import { mailPrefill, type MailLinkType } from '@/core/mail/prefill';
import type { MailAccountRef, MailMessage } from '@/core/mail/types';
import { today } from '@/core/time/now';
import { reinstateCapture, type SavedCapture } from '@/quickCapture/targets';
import { CaptureForm } from '@/quickCapture/ui/CaptureForm';
import { announceSaved } from '@/quickCapture/ui/announceSaved';
import { t } from '@/strings';
import { Button, Checkbox, Dialog } from '@/ui';
import { invoiceMailId } from '../invoiceRow';
import { saveLink } from '../links';
import { useUiStore } from '@/stores/ui';
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
  localAi = false,
  type,
  onClose,
}: {
  account: MailAccountRef;
  threadId: string;
  message: MailMessage;
  /** Address that opens the mail, without the account's address (`forStorage`); absent for sample mail. */
  link?: string;
  /** The local model may read mail (module setting): offers a suggestion for the line. */
  localAi?: boolean;
  type: MailLinkType | undefined;
  onClose: () => void;
}) {
  const [excerpt, setExcerpt] = useState(false);
  // An invoice from this message gets the id the mail list's „Anlegen“ uses (Kopf leer, Nachlese): the sheet
  // and the row find the same invoice, also on another device once it has synced.
  const [invoiceId, setInvoiceId] = useState<{ message: string; id: string }>();
  useEffect(() => {
    let alive = true;
    void invoiceMailId(message.id).then((id) => alive && setInvoiceId({ message: message.id, id }));
    return () => {
      alive = false;
    };
  }, [message.id]);
  const idFor = invoiceId?.message === message.id ? { invoice: invoiceId.id } : undefined;
  const [suggestion, setSuggestion] = useState<
    { phase: 'idle' } | { phase: 'working' } | { phase: 'done'; text: string } | { phase: 'none' }
  >({ phase: 'idle' });
  const [applied, setApplied] = useState<string | undefined>();

  /** After the sheet saved: the link back, and the right words for an invoice that was there already. */
  async function filed(saved: SavedCapture) {
    if (saved.existed === true) {
      await saveLink(account.key, threadId, message.id, saved).catch(() => undefined);
      useUiStore
        .getState()
        .toast(saved.amended ? t.mail.invoice.alreadyNoted : t.mail.invoice.already);
      return;
    }
    // Deleted before (an undo, or by hand): the same invoice comes back instead of a second one.
    const entry =
      saved.existed === 'tombstone' ? await reinstateCapture(saved.type, saved.id) : saved;
    await saveLink(account.key, threadId, message.id, entry).catch(() => undefined);
    await announceSaved(entry);
  }

  // A fresh start for the next time the dialog opens (another destination, another mail).
  const close = () => {
    setSuggestion({ phase: 'idle' });
    setApplied(undefined);
    setExcerpt(false);
    onClose();
  };

  async function suggest(forType: MailLinkType) {
    setSuggestion({ phase: 'working' });
    try {
      const answer = await suggestCaptureLine(forType, message);
      setSuggestion(answer ? { phase: 'done', text: answer.text } : { phase: 'none' });
    } catch {
      setSuggestion({ phase: 'none' });
    }
  }
  const prefill = type
    ? mailPrefill(type, message, { link, threadId, today: today(), withExcerpt: excerpt })
    : undefined;

  return (
    <Dialog
      open={type !== undefined}
      onClose={close}
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
          {localAi ? (
            <div className={styles.panel} data-testid="mail-local-suggest">
              {suggestion.phase === 'done' ? (
                <>
                  <p>
                    <strong>{t.mail.local.suggestion}:</strong> {suggestion.text}
                  </p>
                  <div className={styles.row}>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setApplied(suggestion.text);
                        setSuggestion({ phase: 'idle' });
                      }}
                    >
                      {t.mail.local.apply}
                    </Button>
                    <Button onClick={() => setSuggestion({ phase: 'idle' })}>
                      {t.mail.local.discard}
                    </Button>
                  </div>
                </>
              ) : (
                <div className={styles.row}>
                  <Button
                    disabled={suggestion.phase === 'working'}
                    onClick={() => void suggest(type)}
                  >
                    {suggestion.phase === 'working' ? t.mail.local.working : t.mail.local.suggest}
                  </Button>
                  <span className={styles.hint}>
                    {suggestion.phase === 'none' ? t.mail.local.none : t.mail.local.privacy}
                  </span>
                </div>
              )}
            </div>
          ) : null}
          <CaptureForm
            key={`${type}-${message.id}-${applied ?? ''}`}
            initialText={applied ?? prefill.text}
            initialType={type}
            extra={prefill.extra}
            onCancel={close}
            idFor={idFor}
            onSaved={(saved) => void filed(saved).finally(close)}
          />
          <p className={styles.hint}>{link ? t.mail.link.stores : t.mail.link.storesNothing}</p>
        </div>
      ) : null}
    </Dialog>
  );
}
