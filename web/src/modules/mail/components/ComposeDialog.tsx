import { useState } from 'react';
import { Link } from 'react-router';
import { settingsPath } from '@/core/settings/registry/paths';
import { hasFeature, mailSaveDraft } from '@/core/mail/service';
import type { MailAccountRef } from '@/core/mail/types';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Dialog, TextArea, TextField } from '@/ui';
import { toDraft, toOutgoing, type ComposeProblem, type ComposeState } from '../composeState';
import { pickAttachments } from '../pickAttachments';
import { queueSend } from '../pendingSend';
import { MailError } from './MailError';
import styles from './mail.module.css';

const size = (n: number) =>
  n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

function problemText(p: ComposeProblem): string {
  if (p.code === 'bad-address') return t.mail.write.compose.invalidAddress(p.invalid.join(', '));
  return p.code === 'no-recipient'
    ? t.mail.write.compose.noRecipient
    : t.mail.write.compose.tooLarge;
}

/**
 * The compose window (new mail, reply, forward, draft). Two steps on purpose: the fields, then a review
 * ("Vor dem Senden prüfen") where the user confirms; only that confirmation starts the send window
 * (`pendingSend.ts`), and the window can still be withdrawn. Saving a draft needs the manage permission.
 */
export function ComposeDialog({
  account,
  initial,
  title,
  onClose,
}: {
  account: MailAccountRef;
  initial: ComposeState;
  title: string;
  onClose: () => void;
}) {
  const toast = useUiStore((st) => st.toast);
  const canSend = hasFeature(account, 'mail-send');
  const canDraft = hasFeature(account, 'mail-modify');
  const [s, setS] = useState(initial);
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [problem, setProblem] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [draftError, setDraftError] = useState(false);
  const set = (patch: Partial<ComposeState>) => setS((old) => ({ ...old, ...patch }));
  const dirty = s.to + s.cc + s.subject + s.text !== '' || s.attachments.length > 0;

  function review() {
    const built = toOutgoing(s);
    if ('problem' in built) return setProblem(problemText(built.problem));
    setProblem(undefined);
    setStep('review');
  }

  function confirmSend() {
    if (queueSend(account, s) !== undefined) onClose();
  }

  async function saveDraft() {
    const mail = toDraft(s);
    if (!mail) return;
    setBusy(true);
    setDraftError(false);
    try {
      const saved = await mailSaveDraft(account, mail, s.draftId);
      set({ draftId: saved.id });
      toast(t.mail.write.compose.draftSaved);
      onClose();
    } catch {
      setDraftError(true);
    } finally {
      setBusy(false);
    }
  }

  async function attach() {
    const { files, tooLarge } = await pickAttachments();
    if (files.length > 0) set({ attachments: [...s.attachments, ...files] });
    setProblem(
      tooLarge.length > 0 ? t.mail.write.compose.fileTooLarge(tooLarge.join(', ')) : undefined,
    );
  }

  const built = step === 'review' ? toOutgoing(s) : undefined;
  const mail = built && 'mail' in built ? built.mail : undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      title={step === 'review' ? t.mail.write.review.title : title}
      size="roomy"
      askAfterTyping={step === 'edit' && dirty}
    >
      {step === 'review' && mail ? (
        <div className={styles.panel} data-testid="mail-review">
          <dl className={styles.review}>
            <dt>{t.mail.write.compose.to}</dt>
            <dd>
              {[...mail.to, ...mail.cc, ...mail.bcc]
                .map((a) => (a.name ? `${a.name} <${a.email}>` : a.email))
                .join(', ')}
            </dd>
            <dt>{t.mail.write.compose.subject}</dt>
            <dd>{mail.subject || t.mail.write.review.noSubject}</dd>
            <dt>{t.mail.write.compose.body}</dt>
            <dd className={styles.reviewBody}>
              {mail.text.trim() || t.mail.write.review.emptyBody}
            </dd>
            {mail.attachments.length > 0 ? (
              <>
                <dt>{t.mail.write.compose.attachments}</dt>
                <dd>{mail.attachments.map((a) => a.filename).join(', ')}</dd>
              </>
            ) : null}
          </dl>
          <p className={styles.hint}>{t.mail.write.review.hint}</p>
          <div className={styles.row}>
            <Button onClick={() => setStep('edit')}>{t.mail.write.review.back}</Button>
            <Button variant="primary" data-autofocus onClick={confirmSend}>
              {t.mail.write.review.confirm}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.panel}>
          <TextField
            label={t.mail.write.compose.to}
            value={s.to}
            onChange={(e) => set({ to: e.target.value })}
            data-autofocus={!s.to}
          />
          <TextField
            label={t.mail.write.compose.cc}
            value={s.cc}
            onChange={(e) => set({ cc: e.target.value })}
          />
          <details>
            <summary>{t.mail.write.compose.moreRecipients}</summary>
            <TextField
              label={t.mail.write.compose.bcc}
              value={s.bcc}
              onChange={(e) => set({ bcc: e.target.value })}
            />
          </details>
          <TextField
            label={t.mail.write.compose.subject}
            value={s.subject}
            onChange={(e) => set({ subject: e.target.value })}
          />
          <TextArea
            label={t.mail.write.compose.body}
            rows={10}
            value={s.text}
            onChange={(e) => set({ text: e.target.value })}
            data-autofocus={!!s.to}
          />
          <div>
            {s.attachments.length > 0 ? (
              <ul className={styles.attachments}>
                {s.attachments.map((a, i) => (
                  <li key={`${a.filename}-${i}`} className={styles.attachment}>
                    <span>
                      {a.filename} <span className={styles.meta}>({size(a.data.length)})</span>
                    </span>
                    <Button
                      aria-label={t.mail.write.compose.removeAttachment(a.filename)}
                      onClick={() => set({ attachments: s.attachments.filter((_, j) => j !== i) })}
                    >
                      {t.actions.delete}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Button onClick={() => void attach()}>{t.mail.write.compose.attach}</Button>
            <p className={styles.hint}>{t.mail.write.compose.attachNote}</p>
          </div>
          {problem ? (
            <p className={styles.problem} role="alert">
              {problem}
            </p>
          ) : null}
          {draftError ? <MailError code="denied" /> : null}
          {!canSend ? (
            <p className={styles.hint}>
              {t.mail.write.compose.noSendPermission}{' '}
              <Link to={settingsPath('verbindungen', 'connectors')} onClick={onClose}>
                {t.mail.panel.manage}
              </Link>
            </p>
          ) : null}
          <div className={styles.row}>
            <Button onClick={onClose}>{t.mail.write.compose.discard}</Button>
            {canDraft ? (
              <Button disabled={busy} onClick={() => void saveDraft()}>
                {t.mail.write.compose.saveDraft}
              </Button>
            ) : null}
            {canSend ? (
              <Button variant="primary" onClick={review}>
                {t.mail.write.compose.send}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Dialog>
  );
}
