import { useEffect, useState } from 'react';
import type { MailAccountRef } from '@/core/mail/types';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Button } from '@/ui';
import type { ComposeState } from '../composeState';
import { sendNow, usePendingSends, withdraw } from '../pendingSend';
import { MailError } from './MailError';
import styles from './mail.module.css';

/** The send window: what is about to go out, how long it waits, "Zurückziehen" and "Jetzt senden". */
export function PendingSendBar({
  onReopen,
}: {
  onReopen: (state: ComposeState, account: MailAccountRef) => void;
}) {
  const items = usePendingSends((s) => s.items);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!items.some((i) => i.phase === 'waiting')) return;
    const timer = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(timer);
  }, [items]);

  if (items.length === 0) return null;
  return (
    <div className={styles.pendingList} role="status" aria-live="polite" data-testid="mail-pending">
      {items.map((i) => {
        const left = Math.max(0, Math.ceil((i.endsAt - now()) / 1000));
        const back = () => {
          const state = withdraw(i.id);
          if (state) onReopen(state, i.account);
        };
        return (
          <div key={i.id} className={styles.pending}>
            {i.phase === 'failed' ? (
              <>
                <span>{t.mail.write.pending.failed(i.to)}</span>
                {i.error ? <MailError code={i.error} /> : null}
                <div className={styles.row}>
                  <Button variant="primary" onClick={() => sendNow(i.id)}>
                    {t.mail.write.pending.retry}
                  </Button>
                  <Button onClick={back}>{t.mail.write.pending.edit}</Button>
                </div>
              </>
            ) : (
              <>
                <span>
                  {i.phase === 'sending'
                    ? t.mail.write.pending.sending(i.to)
                    : t.mail.write.pending.waiting(i.to, left)}
                </span>
                {i.phase === 'waiting' ? (
                  <div className={styles.row}>
                    <Button onClick={back} data-autofocus>
                      {t.mail.write.pending.withdraw}
                    </Button>
                    <Button onClick={() => sendNow(i.id)}>{t.mail.write.pending.sendNow}</Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
