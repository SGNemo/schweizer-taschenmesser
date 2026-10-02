import { useEffect, useRef, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button, Card, Dialog, Icon, IconButton } from '@/ui';
import type { DecryptedEntry } from '../vault';
import { deleteEntry } from '../vault';
import { copySecret } from '../copy';
import { isTypingTarget } from '@/core/keyboard/typing';
import { entryAction } from '../shortcuts';
import { totpNow } from '../totp';
import styles from '../accounts.module.css';
import { TotpCode } from './TotpCode';

function safeUrl(raw: string): string | undefined {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

export function EntryDetail({
  entry,
  onClose,
  onEdit,
}: {
  entry: DecryptedEntry | null;
  onClose: () => void;
  onEdit: (entry: DecryptedEntry) => void;
}) {
  return (
    <Dialog open={entry !== null} onClose={onClose} title={entry?.data.title ?? ''}>
      {entry ? <Body key={entry.id} entry={entry} onClose={onClose} onEdit={onEdit} /> : null}
    </Dialog>
  );
}

/** The same detail content as a side panel (wide screens) instead of a dialog. */
export function EntryPanel({
  entry,
  onClose,
  onEdit,
}: {
  entry: DecryptedEntry;
  onClose: () => void;
  onEdit: (entry: DecryptedEntry) => void;
}) {
  return (
    <Card title={entry.data.title}>
      <Body key={entry.id} entry={entry} onClose={onClose} onEdit={onEdit} />
    </Card>
  );
}

function Body({
  entry,
  onClose,
  onEdit,
}: {
  entry: DecryptedEntry;
  onClose: () => void;
  onEdit: (entry: DecryptedEntry) => void;
}) {
  const { data } = entry;
  const [reveal, setReveal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const link = data.url ? safeUrl(data.url) : undefined;
  const root = useRef<HTMLDivElement>(null);

  // U / P / T / O act on the shown entry – but not while typing, and not for events from another dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = entryAction(e);
      if (!action || isTypingTarget(e.target)) return;
      const dialog = e.target instanceof Element ? e.target.closest('dialog') : null;
      if (dialog && !dialog.contains(root.current)) return;
      if (action === 'username' && data.username) {
        void copySecret(t.accounts.fields.username, data.username);
      } else if (action === 'password' && data.password) {
        void copySecret(t.accounts.fields.password, data.password);
      } else if (action === 'totp' && data.totp) {
        void copySecret(t.accounts.fields.totp, totpNow(data.totp).code);
      } else if (action === 'open' && link) {
        void getPlatform().app.openUrl(link);
      } else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [data, link]);

  return (
    <div className={styles.detail} ref={root}>
      {data.username ? (
        <div className={styles.detailRow}>
          <span>
            <span className={styles.detailLabel}>{t.accounts.fields.username}</span>
            <span className={styles.detailValue}>{data.username}</span>
          </span>
          <span className={styles.detailActions}>
            <IconButton
              label={t.accounts.copyUser}
              onClick={() => void copySecret(t.accounts.fields.username, data.username)}
            >
              <Icon name="copy" size={18} />
            </IconButton>
          </span>
        </div>
      ) : null}
      {data.password ? (
        <div className={styles.detailRow}>
          <span>
            <span className={styles.detailLabel}>{t.accounts.fields.password}</span>
            <span className={styles.detailValue} data-testid="password-value">
              {reveal ? data.password : '••••••••••••'}
            </span>
          </span>
          <span className={styles.detailActions}>
            <IconButton
              label={reveal ? t.accounts.hide : t.accounts.show}
              onClick={() => setReveal(!reveal)}
            >
              <Icon name={reveal ? 'eyeOff' : 'eye'} size={18} />
            </IconButton>
            <IconButton
              label={t.accounts.copyPassword}
              onClick={() => void copySecret(t.accounts.fields.password, data.password)}
            >
              <Icon name="copy" size={18} />
            </IconButton>
          </span>
        </div>
      ) : null}
      {data.totp ? <TotpCode config={data.totp} /> : null}
      {data.url ? (
        <div className={styles.detailRow}>
          <span>
            <span className={styles.detailLabel}>{t.accounts.fields.url}</span>
            <span className={styles.detailValue}>{data.url}</span>
          </span>
          {link ? (
            <span className={styles.detailActions}>
              <IconButton
                label={t.accounts.openSite}
                onClick={() => void getPlatform().app.openUrl(link)}
              >
                <Icon name="external" size={18} />
              </IconButton>
            </span>
          ) : null}
        </div>
      ) : null}
      {data.notes ? (
        <div className={styles.detailRow}>
          <span>
            <span className={styles.detailLabel}>{t.accounts.fields.notes}</span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{data.notes}</span>
          </span>
        </div>
      ) : null}
      <p className={styles.notice}>{t.accounts.shortcutsHint}</p>
      {data.tags.length > 0 ? <p className={styles.notice}>{data.tags.join(' · ')}</p> : null}
      <div className={styles.inline}>
        <Button onClick={() => onEdit(entry)}>
          <Icon name="edit" size={18} /> {t.actions.edit}
        </Button>
        {confirmDelete ? (
          <Button
            variant="danger"
            onClick={async () => {
              await deleteEntry(entry.id);
              onClose();
            }}
          >
            {t.form.confirmDelete}
          </Button>
        ) : (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            {t.actions.delete}
          </Button>
        )}
      </div>
    </div>
  );
}
