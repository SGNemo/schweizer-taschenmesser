import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listMailAccounts } from '@/core/mail/accounts';
import { settingsPath } from '@/core/settings/registry/paths';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Dialog } from '@/ui';
import { cacheStats, clearMailCache } from '../cache';
import styles from './mail.module.css';

/** Accounts, permission, cache and notifications of the mail module in one place. */
export function MailSettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useUiStore((st) => st.toast);
  const accounts = useLiveQuery(() => listMailAccounts(), []) ?? [];
  const [stats, setStats] = useState({ threads: 0, bodies: 0 });
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (open) void cacheStats().then(setStats);
  }, [open]);

  async function clear() {
    await clearMailCache();
    setStats(await cacheStats());
    setConfirm(false);
    toast(t.mail.panel.cleared);
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={t.mail.panel.title}
        footer={<Button onClick={onClose}>{t.mail.panel.close}</Button>}
      >
        <div className={styles.panel}>
          <section>
            <h3>{t.mail.panel.accounts}</h3>
            {accounts.length === 0 ? (
              <p>{t.mail.panel.noAccounts}</p>
            ) : (
              <ul>
                {accounts.map((a, i) => (
                  <li key={a.key}>{a.email ?? t.mail.page.accountN(i + 1)}</li>
                ))}
              </ul>
            )}
            <p className={styles.hint}>{t.mail.panel.accountsHint}</p>
            <Link to={settingsPath('verbindungen', 'connectors')} onClick={onClose}>
              {t.mail.panel.manage}
            </Link>
          </section>
          <section>
            <h3>{t.mail.panel.scopes}</h3>
            <p>{t.mail.panel.scopesBody}</p>
          </section>
          <section>
            <h3>{t.mail.panel.cache}</h3>
            <p>{t.mail.panel.cacheBody(stats.threads, stats.bodies)}</p>
            <div className={styles.row}>
              <Button
                disabled={stats.threads + stats.bodies === 0}
                onClick={() => setConfirm(true)}
              >
                {t.mail.panel.clear}
              </Button>
            </div>
          </section>
          <section>
            <h3>{t.mail.panel.notifications}</h3>
            <p>{t.mail.panel.notificationsBody}</p>
          </section>
        </div>
      </Dialog>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t.mail.panel.clearTitle}
        footer={<Button onClick={() => setConfirm(false)}>{t.actions.cancel}</Button>}
      >
        <div className={styles.panel}>
          <p>{t.mail.panel.clearBody}</p>
          <Button variant="danger" data-autofocus onClick={() => void clear()}>
            {t.mail.panel.clear}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
