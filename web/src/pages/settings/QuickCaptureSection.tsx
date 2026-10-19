import { useEffect, useState, type ReactNode } from 'react';
import { getPlatform, type HotkeyError } from '@/core/platform';
import { useFocusSettings } from '@/core/settings/focus';
import { applyHotkey, applyVaultHotkey, hotkeyLabel } from '@/quickCapture/desktop';
import { DEFAULT_HOTKEY, useDevicePrefs, writePrefs } from '@/quickCapture/device';
import { DEFAULT_TYPES, useCaptureSettings } from '@/quickCapture/settings';
import { t } from '@/strings';
import { Button, Card, HelpHint, KeyRecorder, SelectField, Switch } from '@/ui';
import styles from './settings.module.css';

/**
 * One recordable global hotkey. `apply` registers it in the shell (the previous key stays active when
 * that fails); `save` stores it per device afterwards.
 */
export function HotkeyField({
  label,
  hint,
  value,
  defaultValue,
  apply,
  save,
  testId,
}: {
  label: ReactNode;
  hint: string;
  value: string;
  defaultValue?: string;
  apply: (accelerator: string) => Promise<HotkeyError | null>;
  save: (accelerator: string) => void;
  testId: string;
}) {
  const [error, setError] = useState('');

  async function set(accelerator: string) {
    setError('');
    const code = await apply(accelerator);
    if (code) return setError(t.quickCapture.settings.hotkeyErrors[code]);
    save(accelerator);
  }

  function onRecord(accelerator: string, modifiers: boolean) {
    if (!modifiers) return setError(t.quickCapture.settings.hotkeyNeedsModifier);
    void set(accelerator);
  }

  return (
    <div>
      <span className={styles.muted}>{label}</span>
      <div>
        <KeyRecorder
          value={value}
          onRecord={onRecord}
          onStart={() => setError('')}
          display={hotkeyLabel}
          recordingText={t.quickCapture.settings.hotkeyRecording}
          emptyText={t.quickCapture.settings.hotkeyOff}
          ariaLabel={t.quickCapture.settings.hotkeyRecord}
          testId={testId}
        />{' '}
        {defaultValue ? (
          <>
            <Button onClick={() => void set(defaultValue)}>{hotkeyLabel(defaultValue)}</Button>{' '}
          </>
        ) : null}
        {value ? (
          <Button variant="ghost" onClick={() => void set('')}>
            {t.quickCapture.settings.hotkeyClear}
          </Button>
        ) : null}
      </div>
      <span className={styles.muted}>{hint}</span>
      {error ? (
        <p role="alert" className={styles.muted}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Settings → "Schnellerfassung": default target plus (desktop only) hotkey, tray and autostart. */
export function QuickCaptureSection() {
  const desktop = getPlatform().desktop;
  const prefs = useDevicePrefs();
  const [settings, patch] = useCaptureSettings();
  const [focus, patchFocus] = useFocusSettings();
  const [error, setError] = useState('');
  const [portable, setPortable] = useState(false);

  useEffect(() => {
    if (desktop.supported)
      void desktop.info().then(
        (i) => setPortable(i.portable),
        () => undefined,
      );
  }, [desktop]);

  async function toggleAutostart(enabled: boolean) {
    setError('');
    try {
      await desktop.setAutostart(enabled);
      writePrefs({ autostart: enabled });
    } catch {
      setError(t.quickCapture.settings.autostartFailed);
    }
  }

  return (
    <Card>
      <p className={styles.muted}>{t.quickCapture.settings.intro}</p>
      <SelectField
        label={t.quickCapture.settings.defaultType}
        value={settings?.defaultType ?? 'todo'}
        onChange={(e) =>
          void patch({ defaultType: e.target.value as (typeof DEFAULT_TYPES)[number] })
        }
      >
        {DEFAULT_TYPES.map((type) => (
          <option key={type} value={type}>
            {t.quickCapture.target[type]}
          </option>
        ))}
      </SelectField>
      <Switch
        label={t.quickCapture.settings.noQuestion}
        hint={t.quickCapture.settings.noQuestionHint}
        checked={focus.captureNoQuestion}
        onChange={(v) => void patchFocus({ captureNoQuestion: v })}
      />
      {desktop.supported ? (
        <>
          <HotkeyField
            label={
              <>
                {t.quickCapture.settings.hotkey}{' '}
                <HelpHint text={t.quickCapture.settings.trayHelp} />
              </>
            }
            hint={t.quickCapture.settings.hotkeyHint}
            value={prefs.hotkey}
            defaultValue={DEFAULT_HOTKEY}
            apply={applyHotkey}
            save={(hotkey) => writePrefs({ hotkey })}
            testId="hotkey-record"
          />
          <HotkeyField
            label={t.quickCapture.settings.vaultHotkey}
            hint={t.quickCapture.settings.vaultHotkeyHint}
            value={prefs.vaultHotkey}
            apply={applyVaultHotkey}
            save={(vaultHotkey) => writePrefs({ vaultHotkey })}
            testId="vault-hotkey-record"
          />
          <Switch
            label={t.quickCapture.settings.closeToTray}
            checked={prefs.closeToTray}
            onChange={(closeToTray) => {
              writePrefs({ closeToTray });
              void desktop.setCloseToTray(closeToTray);
            }}
          />
          <Switch
            label={t.quickCapture.settings.autostart}
            checked={prefs.autostart}
            onChange={(v) => void toggleAutostart(v)}
          />
          {error ? (
            <p role="alert" className={styles.muted}>
              {error}
            </p>
          ) : null}
          {portable ? (
            <p className={styles.muted}>{t.quickCapture.settings.autostartPortable}</p>
          ) : null}
          <Switch
            label={t.quickCapture.settings.clipboard}
            hint={t.quickCapture.settings.clipboardHint}
            checked={prefs.clipboard}
            onChange={(clipboard) => writePrefs({ clipboard })}
          />
        </>
      ) : (
        <p className={styles.muted}>{t.quickCapture.settings.desktopOnly}</p>
      )}
    </Card>
  );
}
