import { useState } from 'react';
import { ConnectorError } from '@/core/connectors/types';
import { hasFeature } from '@/core/mail/service';
import type { MailAccountRef, MailErrorCode, MailLabel } from '@/core/mail/types';
import { t } from '@/strings';
import { Button, Dialog, Icon, RowMenu, SelectField } from '@/ui';
import {
  applyChange,
  asksFirst,
  doneText,
  labelStep,
  runStep,
  STEPS,
  type MailAction,
  type Step,
} from '../mailActions';
import { MailError } from './MailError';
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
  labels,
  confirmMoves,
  onLabels,
  onChanged,
  onLeave,
}: {
  account: MailAccountRef;
  threadId: string;
  /** The thread's labels as they are now (all messages together). */
  labelIds: readonly string[];
  labels: MailLabel[];
  /** Ask before archiving and labelling (the trash and spam always ask). */
  confirmMoves: boolean;
  /** The thread's labels changed (a change or its undo went through). */
  onLabels: (next: string[]) => void;
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

  if (!hasFeature(account, 'mail-modify')) return null;

  const has = (id: string) => labelIds.includes(id);
  const inTrash = has('TRASH');
  const inSpam = has('SPAM');

  async function go(step: Step, done: (n: number) => string) {
    setBusy(true);
    setError(undefined);
    // The view follows each direction itself, so an undo after leaving still reloads the list.
    let current = [...labelIds];
    const res = await runStep(account, [threadId], step, done, (direction) => {
      current = applyChange(current, direction === 'do' ? step.change : step.undo);
      onLabels(current);
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
            <Button onClick={() => ask('archive')} disabled={busy}>
              <Icon name="download" /> {t.mail.write.archive}
            </Button>
            <Button onClick={() => ask('trash')} disabled={busy}>
              <Icon name="trash" /> {t.mail.write.trash}
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          aria-pressed={starred}
          onClick={() => act(starred ? 'unstar' : 'star')}
          disabled={busy}
        >
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
  onLabels: (next: string[]) => void;
  onChanged: () => void;
}) {
  const own = labels.filter((l) => l.kind === 'user' && labelIds.includes(l.id));
  if (own.length === 0) return null;
  const canModify = hasFeature(account, 'mail-modify');
  async function remove(label: MailLabel) {
    const step = labelStep(label.id, false);
    let current = [...labelIds];
    await runStep(
      account,
      [threadId],
      step,
      () => t.mail.write.done.unlabelled(label.name),
      (direction) => {
        current = applyChange(current, direction === 'do' ? step.change : step.undo);
        onLabels(current);
        onChanged();
      },
    );
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
