import { useState } from 'react';
import type { MailAccountRef } from '@/core/mail/types';
import { t } from '@/strings';
import { Button, Dialog, RowMenu, SelectionBar } from '@/ui';
import { asksFirst, doneText, runStep, STEPS, type MailAction } from '../mailActions';
import styles from './mail.module.css';

type Asking = Extract<MailAction, 'archive' | 'trash' | 'spam'>;

/**
 * Actions for the selected threads. The two moves Gmail shows first (archive, trash) are buttons, the rest
 * is one menu; in the trash and the spam folder the one way back is the button. Moves out of the inbox ask
 * first (trash and spam always, archive per setting), every change has one undo for all of them.
 */
export function BatchBar({
  account,
  ids,
  labelId,
  confirmMoves,
  onCancel,
  onDone,
}: {
  account: MailAccountRef;
  /** Selected thread ids, in list order. */
  ids: string[];
  /** The folder on screen (`TRASH`, `SPAM` offer their way back). */
  labelId: string;
  confirmMoves: boolean;
  onCancel: () => void;
  /** A change (`do`) or its undo went through for these threads. */
  onDone: (direction: 'do' | 'undo', ids: string[], action: MailAction) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [asking, setAsking] = useState<Asking | undefined>();
  const [busy, setBusy] = useState(false);
  const n = ids.length;

  async function act(action: MailAction) {
    setBusy(true);
    await runStep(account, ids, STEPS[action], doneText(action), (direction, changed) =>
      onDone(direction, changed, action),
    );
    setBusy(false);
    setAsking(undefined);
  }
  const ask = (action: Asking) => {
    if (asksFirst(STEPS[action], confirmMoves)) setAsking(action);
    else void act(action);
  };

  const text: Record<Asking, { title: string; body: string; confirm: string }> = {
    archive: {
      title: t.mail.batch.confirm.archiveTitle(n),
      body: t.mail.write.confirm.archiveBody,
      confirm: t.mail.write.archive,
    },
    trash: {
      title: t.mail.batch.confirm.trashTitle(n),
      body: t.mail.write.confirm.trashBody,
      confirm: t.mail.write.trash,
    },
    spam: {
      title: t.mail.batch.confirm.spamTitle(n),
      body: t.mail.write.confirm.spamBody,
      confirm: t.mail.write.spam,
    },
  };

  const item = (id: MailAction, label: string) => ({ id, label, onSelect: () => void act(id) });
  const inTrash = labelId === 'TRASH';
  const inSpam = labelId === 'SPAM';
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
            <Button onClick={() => ask('archive')} disabled={busy}>
              {t.mail.write.archive}
            </Button>
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
