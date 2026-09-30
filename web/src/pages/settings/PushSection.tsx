import { useCallback, useEffect, useState } from 'react';
import {
  disablePush,
  enablePush,
  PushError,
  pushStatus,
  sendTestPush,
  type PushStatus,
} from '@/core/notifications/push';
import { t } from '@/strings';
import { Button, Card } from '@/ui';
import styles from './settings.module.css';

/** Optional Web Push via the sync server (see core/notifications/push.ts). */
export function PushSection() {
  const [status, setStatus] = useState<PushStatus | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | undefined>();

  const refresh = useCallback(async () => setStatus(await pushStatus()), []);
  useEffect(() => {
    let alive = true;
    void pushStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, []);

  async function run(action: () => Promise<string | void>) {
    setBusy(true);
    setMessage(undefined);
    try {
      const text = await action();
      if (text) setMessage({ text, error: false });
    } catch (e) {
      const code = e instanceof PushError ? e.code : 'server';
      setMessage({
        text: t.notifications.push.errors[code] ?? t.notifications.push.errors.server!,
        error: true,
      });
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  const state = status?.state;
  return (
    <Card title={t.notifications.push.title}>
      <div className={styles.form}>
        <p>{t.notifications.push.intro}</p>
        {state ? (
          <p role="status" data-testid="push-status">
            {t.notifications.push.state[state]}
          </p>
        ) : null}
        <div className={styles.row}>
          {state === 'off' || state === 'denied' ? (
            <Button
              variant="primary"
              disabled={busy || state === 'denied'}
              onClick={() => void run(enablePush)}
            >
              {t.notifications.push.enable}
            </Button>
          ) : null}
          {state === 'on' ? (
            <>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () =>
                    (await sendTestPush())
                      ? t.notifications.push.testSent
                      : Promise.reject(new PushError('server')),
                  )
                }
              >
                {t.notifications.push.test}
              </Button>
              <Button disabled={busy} onClick={() => void run(disablePush)}>
                {t.notifications.push.disable}
              </Button>
            </>
          ) : null}
        </div>
        {message ? (
          <p
            role={message.error ? 'alert' : 'status'}
            className={message.error ? styles.error : styles.muted}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
