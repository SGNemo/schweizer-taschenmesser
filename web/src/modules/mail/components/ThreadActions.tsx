import { useState } from 'react';
import { ConnectorError } from '@/core/connectors/types';
import { hasFeature } from '@/core/mail/service';
import type { MailAccountRef, MailErrorCode, MailLabel, ThreadChange } from '@/core/mail/types';
import { t } from '@/strings';
import { Button, Dialog, Icon, RowMenu, SelectField } from '@/ui';
import {
  asksFirst,
  deltaFor,
  doneText,
  inverse,
  labelStep,
  runStep,
  STEPS,
  type MailAction,
  type Step,
} from '../mailActions';
import { MailError } from './MailError';
import { useMailKeys } from '../useMailKeys';
import styles from './mail.module.css';

type Asking = 'archive' | 'trash' | 'spam' | 'label';

const codeOf = (e: unknown): MailErrorCode =>
  e instanceof ConnectorError &&
  (e.code === 'expired' || e.code === 'denied' || e.code === 'rate-limited')
    ? e.code
    : 'network';

/**
 * Changes to a thread (manage permission). Read/unread, star, important and removing a label go straight
 * through with an undo; archive and label ask first when the setting says so; the trash and spam always
 * ask. Every change can be taken back for a few seconds. Nothing here is permanent: the trash keeps mail
 * for 30 days at the service, spam can be taken back.
 */
export function ThreadActions({
  account,
  threadId,
  labelIds,
  inTrash,
  inSpam,
  labels,
  confirmMoves,
  shortcuts = false,
  onLabels,
  onChanged,
  onLeave,
}: {
  account: MailAccountRef;
  threadId: string;
  /** The thread's labels as they are now (all messages together). */
  labelIds: readonly string[];
  /** Every message is in the trash / in spam: the way back replaces archive and trash. */
  inTrash: boolean;
  inSpam: boolean;
  labels: MailLabel[];
  /** Ask before archiving and labelling (the trash and spam always ask). */
  confirmMoves: boolean;
  /** Gmail-style keys: e, #, !, s, Shift+I, Shift+U do what the buttons do (asking where they ask). */
  shortcuts?: boolean;
  /** A change or its undo went through: exactly this label change, applied to the newest state. */
  onLabels: (change: ThreadChange) => void;
  /** The list should reload. */
  onChanged: () => void;
  /** The thread left the view (archived, trashed, spam): back to the list. */
  onLeave: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [asking, setAsking] = useState<Asking | undefined>();
  const [labelId, setLabelId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MailErrorCode | undefined>();
  const userLabels = labels.filter((l) => l.kind === 'user' && !labelIds.includes(l.id));

  const has = (id: string) => labelIds.includes(id);
  const canModify = hasFeature(account, 'mail-modify');
  useMailKeys(shortcuts && canModify && !asking, {
    archive: () => {
      if (has('INBOX') && !inTrash && !inSpam) ask('archive');
    },
    trash: () => {
      if (!inTrash && !inSpam) ask('trash');
    },
    spam: () => {
      if (!inSpam && !inTrash) ask('spam');
    },
    star: () => act(has('STARRED') ? 'unstar' : 'star'),
    read: () => {
      if (has('UNREAD')) act('read');
    },
    unread: () => {
      if (!has('UNREAD')) act('unread');
    },
  });

  if (!canModify) return null;

  async function go(step: Step, done: (n: number) => string) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    // The view follows each direction itself (exactly the delta that went through), so an undo after
    // leaving still reloads the list.
    const delta = deltaFor(labelIds, step.change);
    const res = await runStep(account, [{ id: threadId, labelIds }], step, done, (direction) => {
      if (delta) onLabels(direction === 'do' ? delta : inverse(delta));
      onChanged();
    });
    setBusy(false);
    setAsking(undefined);
    if (res.ok.length === 0) {
      setError(codeOf(res.error));
      return;
    }
    if (step.leaves) onLeave();
  }

  const act = (action: MailAction) => void go(STEPS[action], doneText(action));

  const ask = (action: Extract<MailAction, 'archive' | 'trash' | 'spam'>) => {
    if (asksFirst(STEPS[action], confirmMoves)) setAsking(action);
    else act(action);
  };

  function setLabel() {
    const label = labels.find((l) => l.id === labelId);
    if (label) void go(labelStep(label.id, true), () => t.mail.write.done.labelled(label.name));
  }

  const text: Record<Asking, { title: string; body: string; confirm: string }> = {
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
    spam: {
      title: t.mail.write.confirm.spamTitle,
      body: t.mail.write.confirm.spamBody,
      confirm: t.mail.write.spam,
    },
    label: {
      title: t.mail.write.confirm.labelTitle,
      body: t.mail.write.confirm.labelBody,
      confirm: t.mail.write.confirm.labelConfirm,
    },
  };

  const starred = has('STARRED');
  return (
    <>
      <div className={styles.row} data-testid="mail-actions">
        {inTrash ? (
          <Button onClick={() => act('untrash')} disabled={busy}>
            <Icon name="undo" /> {t.mail.write.untrash}
          </Button>
        ) : inSpam ? (
          <Button onClick={() => act('notSpam')} disabled={busy}>
            <Icon name="undo" /> {t.mail.write.notSpam}
          </Button>
        ) : (
          <>
            {has('INBOX') ? (
              <Button onClick={() => ask('archive')} disabled={busy}>
                <Icon name="download" /> {t.mail.write.archive}
              </Button>
            ) : null}
            <Button onClick={() => ask('trash')} disabled={busy}>
              <Icon name="trash" /> {t.mail.write.trash}
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={() => act(starred ? 'unstar' : 'star')} disabled={busy}>
          <Icon name="star" /> {starred ? t.mail.write.unstar : t.mail.write.star}
        </Button>
        <RowMenu
          label={t.mail.write.more}
          open={menu}
          onOpenChange={setMenu}
          items={[
            has('UNREAD')
              ? { id: 'read', label: t.mail.write.markRead, onSelect: () => act('read') }
              : { id: 'unread', label: t.mail.write.markUnread, onSelect: () => act('unread') },
            has('IMPORTANT')
              ? {
                  id: 'unimportant',
                  label: t.mail.write.unimportant,
                  onSelect: () => act('unimportant'),
                }
              : {
                  id: 'important',
                  label: t.mail.write.important,
                  onSelect: () => act('important'),
                },
            ...(userLabels.length > 0
              ? [
                  {
                    id: 'label',
                    label: t.mail.write.label,
                    onSelect: () => {
                      setLabelId('');
                      setAsking('label');
                    },
                  },
                ]
              : []),
            ...(inSpam || inTrash
              ? []
              : [{ id: 'spam', label: t.mail.write.spam, onSelect: () => ask('spam') }]),
          ]}
        />
      </div>
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
              variant={asking === 'trash' || asking === 'spam' ? 'danger' : 'primary'}
              disabled={busy || (asking === 'label' && !labelId)}
              data-autofocus
              onClick={() => (asking === 'label' ? setLabel() : act(asking))}
            >
              {text[asking].confirm}
            </Button>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

/**
 * The thread's own labels as quiet chips. With the manage permission each has a remove button (straight
 * through, with an undo: removing a label moves nothing).
 */
export function ThreadLabels({
  account,
  threadId,
  labelIds,
  labels,
  onLabels,
  onChanged,
}: {
  account: MailAccountRef;
  threadId: string;
  labelIds: readonly string[];
  labels: MailLabel[];
  onLabels: (change: ThreadChange) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const own = labels.filter((l) => l.kind === 'user' && labelIds.includes(l.id));
  if (own.length === 0) return null;
  const canModify = hasFeature(account, 'mail-modify');
  async function remove(label: MailLabel) {
    if (busy) return;
    setBusy(true);
    const step = labelStep(label.id, false);
    const delta = deltaFor(labelIds, step.change);
    await runStep(
      account,
      [{ id: threadId, labelIds }],
      step,
      () => t.mail.write.done.unlabelled(label.name),
      (direction) => {
        if (delta) onLabels(direction === 'do' ? delta : inverse(delta));
        onChanged();
      },
    );
    setBusy(false);
  }
  return (
    <ul className={styles.labelChips} aria-label={t.mail.write.labelsOf}>
      {own.map((l) => (
        <li key={l.id} className={styles.labelChip}>
          <span>{l.name}</span>
          {canModify ? (
            <button
              type="button"
              className={styles.labelRemove}
              aria-label={t.mail.write.removeLabel(l.name)}
              disabled={busy}
              onClick={() => void remove(l)}
            >
              <Icon name="close" size={14} />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
