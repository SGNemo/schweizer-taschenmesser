import { useState } from 'react';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Badge, Button, Icon, IconButton, Prose, TextArea } from '@/ui';
import type { Stored } from '@/core/db/types';
import { Markdown } from '../markdown';
import type { Message } from '../schema';
import styles from '../chat.module.css';

const c = t.chat;

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    useUiStore.getState().toast(c.copied);
  } catch {
    /* clipboard not available: nothing to do */
  }
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className={styles.codeWrap}>
      <pre>
        <code>{code}</code>
      </pre>
      <IconButton label={c.copy} className={styles.codeCopy} onClick={() => void copy(code)}>
        <Icon name="copy" size={16} />
      </IconButton>
    </div>
  );
}

export function MessageView({
  message,
  busy,
  isLastAnswer,
  onRegenerate,
  onEdit,
}: {
  message: Stored<Message>;
  busy: boolean;
  isLastAnswer: boolean;
  onRegenerate: () => void;
  onEdit: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const user = message.role === 'user';

  return (
    <article
      className={[styles.msg, user ? styles.user : ''].join(' ')}
      data-testid={`msg-${message.role}`}
    >
      <div className={styles.msgHead}>
        <strong>{user ? c.you : c.assistant}</strong>
        {!user && message.stage ? (
          <Badge tone="neutral">{message.stage === 'local' ? c.stageLocal : c.stageCloud}</Badge>
        ) : null}
        {user && message.context ? <Badge tone="neutral">{c.context.attached}</Badge> : null}
        <span className={styles.msgActions}>
          {!user ? (
            <IconButton label={c.copy} onClick={() => void copy(message.content)}>
              <Icon name="copy" size={16} />
            </IconButton>
          ) : null}
          {user && !busy ? (
            <IconButton
              label={c.edit}
              onClick={() => {
                setDraft(message.content);
                setEditing(true);
              }}
            >
              <Icon name="edit" size={16} />
            </IconButton>
          ) : null}
          {!user && isLastAnswer && !busy ? (
            <IconButton label={c.regenerate} onClick={onRegenerate}>
              <Icon name="reset" size={16} />
            </IconButton>
          ) : null}
        </span>
      </div>
      {editing ? (
        <>
          <TextArea
            label={c.edit}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
          />
          <div>
            <Button
              variant="primary"
              disabled={!draft.trim()}
              onClick={() => {
                setEditing(false);
                onEdit(draft);
              }}
            >
              {c.editSave}
            </Button>{' '}
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {c.cancel}
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.body}>
          {user ? (
            <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
          ) : (
            <Prose>
              <Markdown text={message.content} renderCode={(code) => <CodeBlock code={code} />} />
            </Prose>
          )}
        </div>
      )}
    </article>
  );
}
