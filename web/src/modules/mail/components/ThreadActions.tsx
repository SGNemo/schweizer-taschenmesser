import { useState } from 'react';
import { ConnectorError } from '@/core/connectors/types';
import { hasFeature, mailModify, mailTrash, mailUntrash } from '@/core/mail/service';
import type { MailAccountRef, MailErrorCode, MailLabel, ThreadChange } from '@/core/mail/types';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Dialog, Icon, RowMenu, SelectField } from '@/ui';
import { patchCachedThread } from '../cache';
import { MailError } from './MailError';
import styles from './mail.module.css';

type Kind = 'read' | 'unread' | 'archive' | 'trash' | 'label';

const inverse = (c: ThreadChange): ThreadChange => ({
  addLabelIds: c.removeLabelIds,
  removeLabelIds: c.addLabelIds,
});

/**
 * Changes to a thread (manage permission). Mark read/unread goes straight through with an undo; archive,
 * label and the trash ask first (a dialog that says what will happen), and every change can be taken back
 * for a few seconds. Nothing here is permanent: the trash keeps mail for 30 days at the service.
 */
export function ThreadActions({
  account,
  threadId,
  unread,
  labels,
  confirmMoves,
  onUnread,
  onChanged,
  onLeave,
}: {
  account: MailAccountRef;
  threadId: string;
  unread: boolean;
  labels: MailLabel[];
  /** Ask before archiving and labelling (the trash always asks). */
  confirmMoves: boolean;
  onUnread: (unread: boolean) => void;
  /** The list should reload. */
  onChanged: () => void;
  /** The thread left the view (archived, trashed): back to the list. */
  onLeave: () => void;
}) {
  const toast = useUiStore((st) => st.toast);
  const [menu, setMenu] = useState(false);
  const [asking, setAsking] = useState<Kind | undefined>();
  const [labelId, setLabelId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MailErrorCode | undefined>();
  const userLabels = labels.filter((l) => l.kind === 'user');

  if (!hasFeature(account, 'mail-modify')) return null;

  const codeOf = (e: unknown): MailErrorCode =>
    e instanceof ConnectorError &&
    (e.code === 'expired' || e.code === 'denied' || e.code === 'rate-limited')
      ? e.code
      : 'network';

  async function run(kind: Kind) {
    const label = userLabels.find((l) => l.id === labelId);
    let change: ThreadChange | undefined;
    let done = '';
    let leaves = false;
    if (kind === 'read') [change, done] = [{ removeLabelIds: ['UNREAD'] }, t.mail.write.done.read];
    if (kind === 'unread') [change, done] = [{ addLabelIds: ['UNREAD'] }, t.mail.write.done.unread];
    if (kind === 'archive') {
      [change, done, leaves] = [{ removeLabelIds: ['INBOX'] }, t.mail.write.done.archived, true];
    }
    if (kind === 'label' && label)
      [change, done] = [{ addLabelIds: [label.id] }, t.mail.write.done.labelled(label.name)];
    if (kind === 'trash') {
      [change, done, leaves] = [
        { addLabelIds: ['TRASH'], removeLabelIds: ['INBOX'] },
        t.mail.write.done.trashed,
        true,
      ];
    }
    if (!change) return;

    setBusy(true);
    setError(undefined);
    try {
      if (kind === 'trash') await mailTrash(account, threadId);
      else await mailModify(account, threadId, change);
    } catch (e) {
      setError(codeOf(e));
      toast(t.mail.write.failed);
      setBusy(false);
      setAsking(undefined);
      return;
    }
    await patchCachedThread(account.key, threadId, change);
    if (kind === 'read') onUnread(false);
    if (kind === 'unread') onUnread(true);
    setBusy(false);
    setAsking(undefined);
    onChanged();
    const applied = change;
    toast(done, {
      label: t.mail.write.undo,
      run: () =>
        void (async () => {
          try {
            if (kind === 'trash') await mailUntrash(account, threadId);
            else await mailModify(account, threadId, inverse(applied));
            await patchCachedThread(
              account.key,
              threadId,
              kind === 'trash'
                ? { addLabelIds: ['INBOX'], removeLabelIds: ['TRASH'] }
                : inverse(applied),
            );
            if (kind === 'read') onUnread(true);
            if (kind === 'unread') onUnread(false);
            onChanged();
            toast(t.mail.write.undone);
          } catch {
            toast(t.mail.write.failed);
          }
        })(),
    });
    if (leaves) onLeave();
  }

  const ask = (kind: Kind) => {
    if (kind === 'trash' || (confirmMoves && (kind === 'archive' || kind === 'label')))
      setAsking(kind);
    else void run(kind);
  };

  const text: Record<
    'archive' | 'trash' | 'label',
    { title: string; body: string; confirm: string }
  > = {
    archive: {
      title: t.mail.write.confirm.archiveTitle,
      body: t.mail.write.confirm.archiveBody,
      confirm: t.mail.write.archive,
    },
    trash: {
      title: t.mail.write.confirm.trashTitle,
      body: t.mail.write.confirm.trashBody,
      confirm: t.mail.write.trash,
    },
    label: {
      title: t.mail.write.confirm.labelTitle,
      body: t.mail.write.confirm.labelBody,
      confirm: t.mail.write.confirm.labelConfirm,
    },
  };

  return (
    <>
      <div className={styles.row} data-testid="mail-actions">
        <Button onClick={() => ask('archive')} disabled={busy}>
          <Icon name="download" /> {t.mail.write.archive}
        </Button>
        <Button onClick={() => ask('trash')} disabled={busy}>
          <Icon name="trash" /> {t.mail.write.trash}
        </Button>
        <RowMenu
          label={t.mail.write.more}
          open={menu}
          onOpenChange={setMenu}
          items={[
            unread
              ? { id: 'read', label: t.mail.write.markRead, onSelect: () => ask('read') }
              : { id: 'unread', label: t.mail.write.markUnread, onSelect: () => ask('unread') },
            ...(userLabels.length > 0
              ? [{ id: 'label', label: t.mail.write.label, onSelect: () => setAsking('label') }]
              : []),
          ]}
        />
      </div>
      {error ? <MailError code={error} /> : null}
      <Dialog
        open={asking === 'archive' || asking === 'trash' || asking === 'label'}
        onClose={() => setAsking(undefined)}
        title={asking && asking !== 'read' && asking !== 'unread' ? text[asking].title : ''}
        footer={<Button onClick={() => setAsking(undefined)}>{t.actions.cancel}</Button>}
      >
        {asking && asking !== 'read' && asking !== 'unread' ? (
          <div className={styles.panel}>
            <p>{text[asking].body}</p>
            {asking === 'label' ? (
              <SelectField
                label={t.mail.write.confirm.labelPick}
                value={labelId}
                onChange={(e) => setLabelId(e.target.value)}
              >
                <option value="">{t.mail.write.confirm.labelNone}</option>
                {userLabels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </SelectField>
            ) : null}
            <Button
              variant={asking === 'trash' ? 'danger' : 'primary'}
              disabled={busy || (asking === 'label' && !labelId)}
              data-autofocus
              onClick={() => void run(asking)}
            >
              {text[asking].confirm}
            </Button>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
