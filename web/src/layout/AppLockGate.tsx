import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { unlockWithBiometric } from '@/core/applock/biometric';
import { waitRemaining } from '@/core/applock/fails';
import { checkPin } from '@/core/applock/pin';
import { useAppLockPrefs } from '@/core/applock/prefs';
import { unlockApp, useAppLock } from '@/core/applock/state';
import { getPlatform } from '@/core/platform';
import { tAppLock } from '@/strings.applock';
import { Button, Logo, TextField } from '@/ui';
import styles from './AppLockGate.module.css';

/**
 * The app lock (device-local, `core/applock`). While locked the children are not rendered at all, so
 * nothing of the app's data stays in the DOM; the lock screen takes their place.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const locked = useAppLock((s) => s.locked);
  return locked ? <AppLockScreen /> : <>{children}</>;
}

function waitText(ms: number): string {
  const s = tAppLock.get();
  const secs = Math.ceil(ms / 1000);
  return s.wait(secs < 60 ? s.seconds(secs) : s.minutes(Math.ceil(secs / 60)));
}

function AppLockScreen() {
  const s = tAppLock.use();
  const prefs = useAppLockPrefs();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<'wrong' | 'bioInvalid' | undefined>();
  const [wait, setWait] = useState(() => waitRemaining());
  const [bioReady, setBioReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const triedBio = useRef(false);

  // The wait counts down as text once per second (it survives a reload: stored with the fail count).
  useEffect(() => {
    if (wait <= 0) return;
    const id = setInterval(() => setWait(waitRemaining()), 1000);
    return () => clearInterval(id);
  }, [wait]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const tryBio = async () => {
    setBusy(true);
    try {
      const result = await unlockWithBiometric();
      if (result === 'ok') unlockApp();
      else if (result === 'invalid') {
        setBioReady(false);
        setMessage('bioInvalid');
      }
    } finally {
      setBusy(false);
    }
  };

  // Biometrics: the button only where it is set up and the device has them; one automatic try on show.
  useEffect(() => {
    if (!prefs.biometric) return;
    let live = true;
    void getPlatform()
      .biometrics.available()
      .catch(() => false)
      .then((ok) => {
        if (!live) return;
        setBioReady(ok);
        if (ok && !triedBio.current) {
          triedBio.current = true;
          void tryBio();
        }
      });
    return () => {
      live = false;
    };
  }, [prefs.biometric]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || wait > 0 || pin === '') return;
    const entered = pin;
    setPin(''); // the PIN lives only as long as this submit
    setBusy(true);
    try {
      const result = await checkPin(entered);
      if (result === 'ok') {
        unlockApp();
        return;
      }
      setMessage(result === 'wrong' ? 'wrong' : undefined);
      setWait(waitRemaining());
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

  const waiting = wait > 0;
  return (
    <main className={styles.page} data-testid="app-lock">
      <form className={styles.panel} onSubmit={(e) => void submit(e)}>
        <div className={styles.logo}>
          <Logo size={56} />
        </div>
        <h1 className={styles.title}>{s.lockedTitle}</h1>
        <p className={styles.intro}>{s.lockedIntro}</p>
        <TextField
          ref={input}
          label={s.pin}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={12}
          data-autofocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          disabled={busy || waiting}
        />
        <p className={styles.status} role="status" aria-live="polite">
          {waiting ? waitText(wait) : message ? s[message] : ''}
        </p>
        <Button type="submit" variant="primary" disabled={busy || waiting || pin === ''}>
          {s.unlock}
        </Button>
        {prefs.biometric && bioReady ? (
          <Button onClick={() => void tryBio()} disabled={busy}>
            {s.unlockBio}
          </Button>
        ) : null}
        <details className={styles.forgot}>
          <summary>{s.forgot}</summary>
          <p>{s.forgotText}</p>
        </details>
      </form>
    </main>
  );
}
