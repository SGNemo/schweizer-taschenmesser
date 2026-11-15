import { useState } from 'react';
import { ConnectorError } from '@/core/connectors/types';
import type { MailAccountRef, MailErrorCode } from '@/core/mail/types';
import { t } from '@/strings';
import { Button, Dialog, RowMenu, SelectionBar } from '@/ui';
import { asksFirst, doneText, runStep, STEPS, type MailAction, type Target } from '../mailActions';
import { MailError } from './MailError';
import styles from './mail.module.css';

type Asking = Extract<MailAction, 'archive' | 'trash' | 'spam'>;

/**
 * Actions for the selected threads. The two moves Gmail shows first (archive, trash) are buttons, the rest
 * is one menu; in the trash and the spam folder the one way back is the button. Moves out of the inbox ask
 * first (trash and spam always, archive per setting), every change has one undo for all of them.
 */
export function BatchBar({
  account,
  targets,
  labelId,
  confirmMoves,
  onCancel,
  onDone,
}: {
  account: MailAccountRef;
  /** Selected threads with their labels, in list order. */
  targets: Target[];
  /** The folder on screen (`TRASH`, `SPAM` offer their way back); empty for a search. */
  labelId: string;
  confirmMoves: boolean;
  onCancel: () => void;
  /** A change (`do`) or its undo went through for these threads. */
  onDone: (direction: 'do' | 'undo', ids: string[], action: MailAction) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [asking, setAsking] = useState<Asking | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MailErrorCode | undefined>();
  const n = targets.length;

  async function act(action: MailAction) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    const res = await runStep(
      account,
      targets,
      STEPS[action],
      doneText(action),
      (direction, changed) => onDone(direction, changed, action),
    );
    setBusy(false);
    setAsking(undefined);
    // Nothing went through: say why (an expired login gets its own way back, like in the thread view).
    if (res.ok.length === 0 && res.error !== undefined)
      setError(
        res.error instanceof ConnectorError &&
          (res.error.code === 'expired' ||
            res.error.code === 'denied' ||
            res.error.code === 'rate-limited')
          ? res.error.code
          : 'network',
      );
  }
  const ask = (action: Asking) => {
    if (asksFirst(STEPS[action], confirmMoves)) setAsking(action);
    else void act(action);
  };

  const text: Record<Asking, { title: string; body: string; confirm: string }> = {
    archive: {
      title: t.mail.batch.confirm.archiveTitle(n),
      body: t.mail.batch.confirm.archiveBody,
      confirm: t.mail.write.archive,
    },
    trash: {
      title: t.mail.batch.confirm.trashTitle(n),
      body: t.mail.batch.confirm.trashBody,
      confirm: t.mail.write.trash,
    },
    spam: {
      title: t.mail.batch.confirm.spamTitle(n),
      body: t.mail.batch.confirm.spamBody,
      confirm: t.mail.write.spam,
    },
  };

  const item = (id: MailAction, label: string) => ({ id, label, onSelect: () => void act(id) });
  const inTrash = labelId === 'TRASH';
  const inSpam = labelId === 'SPAM';
  // Archive takes mail out of the inbox: offered where the inbox is on screen (the inbox or a search).
  const canArchive = labelId === 'INBOX' || labelId === '';
  return (
    <>
      <SelectionBar count={n} onCancel={onCancel}>
        {inTrash ? (
          <Button onClick={() => void act('untrash')} disabled={busy}>
            {t.mail.write.untrash}
          </Button>
        ) : inSpam ? (
          <Button onClick={() => void act('notSpam')} disabled={busy}>
            {t.mail.write.notSpam}
          </Button>
        ) : (
          <>
            {canArchive ? (
              <Button onClick={() => ask('archive')} disabled={busy}>
                {t.mail.write.archive}
              </Button>
            ) : null}
            <Button onClick={() => ask('trash')} disabled={busy}>
              {t.mail.write.trash}
            </Button>
          </>
        )}
        <RowMenu
          label={t.mail.batch.more}
          open={menu}
          onOpenChange={setMenu}
          items={[
            item('read', t.mail.write.markRead),
            item('unread', t.mail.write.markUnread),
            item('star', t.mail.write.star),
            item('unstar', t.mail.write.unstar),
            item('important', t.mail.write.important),
            item('unimportant', t.mail.write.unimportant),
            ...(inTrash || inSpam
              ? []
              : [{ id: 'spam', label: t.mail.write.spam, onSelect: () => ask('spam') }]),
          ]}
        />
      </SelectionBar>
      {error ? <MailError code={error} /> : null}
      <Dialog
        open={asking !== undefined}
        onClose={() => setAsking(undefined)}
        title={asking ? text[asking].title : ''}
        footer={<Button onClick={() => setAsking(undefined)}>{t.actions.cancel}</Button>}
      >
        {asking ? (
          <div className={styles.panel}>
            <p>{text[asking].body}</p>
            <Button
              variant={asking === 'archive' ? 'primary' : 'danger'}
              disabled={busy}
              data-autofocus
              onClick={() => void act(asking)}
            >
              {text[asking].confirm}
            </Button>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
