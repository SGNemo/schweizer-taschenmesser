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
 * The app lock (device-local, `core/applock`). While locked the routes are not mounted at all: nothing of
 * the app's data stays in the DOM, and every shortcut, the voice key, Back handling and open dialogs stop
 * with them (keeping them mounted under the lock left an open modal dialog on top of the lock screen and
 * earlier key listeners alive – council round 2). The cost: unsaved typing outside a draft-keeping form is
 * lost, which is why leaving the app locks after 30 s by default, not at once.
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
  const [message, setMessage] = useState<'wrong' | 'bioInvalid' | 'error' | undefined>();
  const [wait, setWait] = useState(() => waitRemaining());
  const [bioReady, setBioReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const triedBio = useRef(false);
  // Read out once when the wait starts (a per-second change in a live region would talk for minutes).
  const [waitSaid, setWaitSaid] = useState(() =>
    waitRemaining() > 0 ? waitText(waitRemaining()) : '',
  );

  // The wait counts down as text once per second (it survives a reload: stored with the fail count).
  const waiting = wait > 0;
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setWait(waitRemaining()), 1000);
    return () => clearInterval(id);
  }, [waiting]);

  // On show, and when a wait ends: the field gets the focus; the old "wrong" line goes (it would be read
  // out again), the field is simply usable.
  const waitedBefore = useRef(waiting);
  useEffect(() => {
    if (waiting) {
      waitedBefore.current = true;
      return;
    }
    if (waitedBefore.current) setMessage(undefined);
    waitedBefore.current = false;
    input.current?.focus();
  }, [waiting]);

  const tryBio = async () => {
    setBusy(true);
    try {
      const result = await unlockWithBiometric();
      if (result === 'ok') unlockApp();
      else if (result === 'invalid') {
        setBioReady(false);
        setMessage('bioInvalid');
      }
    } catch {
      setMessage('error'); // the keystore did not answer: a calm line, the PIN still works
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
        autoTry();
      });
    // One automatic prompt, only while Nemo is in front: a lock that happened in the background (or
    // while another window had the focus) asks when the user comes back, not on top of another app.
    const autoTry = () => {
      if (!live || triedBio.current) return;
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      triedBio.current = true;
      void tryBio();
    };
    const onBack = () => {
      if (document.visibilityState === 'visible') autoTry();
    };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
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
      const left = waitRemaining();
      setWait(left);
      setWaitSaid(left > 0 ? waitText(left) : '');
    } catch {
      setMessage('error');
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

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
        {/* The wait is read out once (`waitSaid`); the countdown below it is for the eyes only. */}
        <p className={waiting ? 'sr-only' : styles.status} role="status" aria-live="polite">
          {waiting ? waitSaid : message ? s[message] : ''}
        </p>
        {waiting ? (
          <p className={styles.status} aria-hidden="true">
            {waitText(wait)}
          </p>
        ) : null}
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
