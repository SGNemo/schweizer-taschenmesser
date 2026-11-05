import { useEffect, useState, type ReactNode } from 'react';
import { fixedConflict } from '@/core/keyboard/fixed';
import { getPlatform, type HotkeyError } from '@/core/platform';
import { tSettings4 } from '@/strings.settings4';
import { useFocusSettings } from '@/core/settings/focus';
import {
  applyHotkey,
  applyVaultHotkey,
  hotkeyLabel,
  refreshTrayToday,
} from '@/quickCapture/desktop';
import { DEFAULT_HOTKEY, useDevicePrefs, writePrefs } from '@/quickCapture/device';
import { DEFAULT_TYPES, useCaptureSettings } from '@/quickCapture/settings';
import { t } from '@/strings';
import { tSettingsConnect } from '@/strings.settingsConnect';
import { Button, Card, HelpHint, KeyRecorder, SelectField, Switch } from '@/ui';
import { Facts, StateBanner, Step } from './ConnectParts';
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
    // A global hotkey must not take over a shortcut the app itself uses (Strg+K, Alt+L …).
    const taken = fixedConflict(accelerator);
    if (taken)
      return setError(
        tSettings4.get().shortcuts.conflictFixed(tSettings4.get().shortcuts.fixed[taken.id]),
      );
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
  const c = tSettingsConnect.use().quickCapture;

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
      <div className={styles.form}>
        <StateBanner
          icon="plus"
          tone="ok"
          title={c.title}
          line={t.quickCapture.settings.intro}
          testId="quick-capture-state"
        />
        <Facts
          label={c.title}
          items={[
            {
              label: t.quickCapture.settings.defaultType,
              value: t.quickCapture.target[settings?.defaultType ?? 'todo'],
            },
            ...(desktop.supported
              ? [
                  {
                    label: t.quickCapture.settings.hotkey,
                    value: prefs.hotkey
                      ? hotkeyLabel(prefs.hotkey)
                      : t.quickCapture.settings.hotkeyOff,
                  },
                ]
              : []),
          ]}
        />
        <Step n={1} title={c.stepEntry} hint={c.stepEntryHint}>
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
        </Step>
        {desktop.supported ? (
          <>
            <Step n={2} title={c.stepKeys} hint={c.stepKeysHint}>
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
            </Step>
            <Step n={3} title={c.stepBackground} hint={c.stepBackgroundHint}>
              <Switch
                label={t.quickCapture.settings.closeToTray}
                checked={prefs.closeToTray}
                onChange={(closeToTray) => {
                  writePrefs({ closeToTray });
                  void desktop.setCloseToTray(closeToTray);
                }}
              />
              <Switch
                label={t.quickCapture.settings.trayToday}
                hint={t.quickCapture.settings.trayTodayHint}
                checked={prefs.trayToday}
                onChange={(trayToday) => {
                  writePrefs({ trayToday });
                  refreshTrayToday();
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
            </Step>
          </>
        ) : (
          <p className={styles.muted}>{t.quickCapture.settings.desktopOnly}</p>
        )}
      </div>
    </Card>
  );
}
