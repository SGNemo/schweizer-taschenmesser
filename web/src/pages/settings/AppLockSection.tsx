import { useEffect, useId, useState, type FormEvent } from 'react';
import { changeAppLockPin, turnOffAppLock, turnOnAppLock } from '@/core/applock/actions';
import { biometricAvailable, disableBiometric, enableBiometric } from '@/core/applock/biometric';
import { isValidPin, type PinCheck } from '@/core/applock/pin';
import {
  BACKGROUND_MODES,
  IDLE_MINUTES,
  useAppLockPrefs,
  writePrefs,
  type BackgroundMode,
  type IdleMinutes,
} from '@/core/applock/prefs';
import { lockApp } from '@/core/applock/state';
import { waitRemaining } from '@/core/applock/fails';
import { t } from '@/strings';
import { tAppLock } from '@/strings.applock';
import { useUiStore } from '@/stores/ui';
import { Button, Dialog, Segmented, SettingRow, SettingsGroup, Switch, TextField } from '@/ui';
import styles from './AppLockSection.module.css';

type Mode = 'set' | 'off' | 'change' | 'bio';

/**
 * App lock (device-local, `core/applock`): PIN, idle and background lock, optional biometrics.
 * A privacy lock, not encryption; the section says so in one line.
 */
export function AppLockSection() {
  const s = tAppLock.use();
  const prefs = useAppLockPrefs();
  const toast = useUiStore((st) => st.toast);
  const [mode, setMode] = useState<Mode | undefined>();
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    let live = true;
    void biometricAvailable().then((ok) => live && setBioAvailable(ok));
    return () => {
      live = false;
    };
  }, []);

  const done = (message: string) => {
    setMode(undefined);
    toast(message);
  };

  return (
    <SettingsGroup id="app-lock" title={s.title} description={s.honest}>
      <SettingRow id="app-lock--enabled" label={s.enabled} description={s.enabledHint}>
        <Switch
          label={s.enabled}
          labelHidden
          checked={prefs.enabled}
          onChange={(on) => setMode(on ? 'set' : 'off')}
        />
      </SettingRow>
      {prefs.enabled ? (
        <>
          <SettingRow id="app-lock--pin" label={s.changePin} description={s.changePinHint}>
            <Button onClick={() => setMode('change')}>{s.changePin}</Button>
          </SettingRow>
          <SettingRow id="app-lock--idle" label={s.idle} description={s.idleHint}>
            <Segmented<IdleMinutes>
              label={s.idle}
              value={prefs.idleMinutes}
              options={IDLE_MINUTES.map((v) => ({ value: v, label: s.idleOption(Number(v)) }))}
              onChange={(v) => writePrefs({ idleMinutes: v })}
            />
          </SettingRow>
          <SettingRow id="app-lock--background" label={s.background} description={s.backgroundHint}>
            <Segmented<BackgroundMode>
              label={s.background}
              value={prefs.background}
              options={BACKGROUND_MODES.map((v) => ({ value: v, label: s.backgroundOptions[v] }))}
              onChange={(v) => writePrefs({ background: v })}
            />
          </SettingRow>
          {bioAvailable ? (
            <SettingRow id="app-lock--biometric" label={s.biometric} description={s.biometricHint}>
              <Switch
                label={s.biometric}
                labelHidden
                checked={prefs.biometric}
                onChange={(on) => (on ? setMode('bio') : void disableBiometric())}
              />
            </SettingRow>
          ) : null}
          <SettingRow id="app-lock--lock-now" label={s.lockNow} description={s.lockNowHint}>
            <Button data-testid="app-lock-now" onClick={lockApp}>
              {s.lockNow}
            </Button>
          </SettingRow>
        </>
      ) : null}
      {mode ? (
        <PinDialog
          mode={mode}
          onClose={() => setMode(undefined)}
          onDone={(message) => done(message)}
        />
      ) : null}
    </SettingsGroup>
  );
}

function PinDialog({
  mode,
  onClose,
  onDone,
}: {
  mode: Mode;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const s = tAppLock.use();
  const formId = useId();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const needsCurrent = mode !== 'set';
  const needsNew = mode === 'set' || mode === 'change';
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 12);

  const title = { set: s.setTitle, off: s.offTitle, change: s.changePin, bio: s.bioTitle }[mode];
  const intro = { set: s.setIntro, off: s.offIntro, change: s.changePinHint, bio: s.bioIntro }[
    mode
  ];
  const action = { set: s.save, off: s.turnOff, change: s.save, bio: s.next }[mode];

  const checkFailed = (result: Exclude<PinCheck, 'ok'>) => {
    setCurrent('');
    const wait = waitRemaining();
    const secs = Math.ceil(wait / 1000);
    setError(
      result === 'wait'
        ? s.wait(secs < 60 ? s.seconds(secs) : s.minutes(Math.ceil(secs / 60)))
        : s.wrong,
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (needsNew && !isValidPin(next)) return setError(s.pinFormat);
    if (needsNew && next !== repeat) return setError(s.pinMismatch);
    // Read once, then the fields are emptied: the PIN lives only as long as this submit.
    const cur = current;
    const fresh = next;
    setCurrent('');
    setNext('');
    setRepeat('');
    setError(undefined);
    setBusy(true);
    try {
      if (mode === 'set') {
        await turnOnAppLock(fresh);
        onDone(s.lockOn);
      } else if (mode === 'off') {
        const r = await turnOffAppLock(cur);
        if (r === 'ok') onDone(s.lockOff);
        else checkFailed(r);
      } else if (mode === 'change') {
        const r = await changeAppLockPin(cur, fresh);
        if (r === 'ok') onDone(s.pinSaved);
        else checkFailed(r);
      } else {
        const r = await enableBiometric(cur);
        if (r === 'enabled') onDone(s.bioOn);
        else if (r === 'cancelled' || r === 'unavailable') onDone(s.bioCancelled);
        else checkFailed(r);
      }
    } finally {
      setBusy(false);
    }
  };

  const pinProps = {
    type: 'password',
    inputMode: 'numeric',
    pattern: '[0-9]*',
    autoComplete: 'off',
    maxLength: 12,
  } as const;

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>{t.actions.cancel}</Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            disabled={busy}
            data-testid="app-lock-submit"
          >
            {action}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(e) => void submit(e)} className={styles.form}>
        <p className={styles.text}>{intro}</p>
        {needsCurrent ? (
          <TextField
            {...pinProps}
            label={s.currentPin}
            data-autofocus
            value={current}
            onChange={(e) => setCurrent(digits(e.target.value))}
          />
        ) : null}
        {needsNew ? (
          <>
            <TextField
              {...pinProps}
              label={s.newPin}
              data-autofocus={needsCurrent ? undefined : true}
              value={next}
              onChange={(e) => setNext(digits(e.target.value))}
            />
            <TextField
              {...pinProps}
              label={s.repeatPin}
              value={repeat}
              onChange={(e) => setRepeat(digits(e.target.value))}
            />
          </>
        ) : null}
        <p className={styles.status} role="status" aria-live="polite">
          {error ?? ''}
        </p>
      </form>
    </Dialog>
  );
}
