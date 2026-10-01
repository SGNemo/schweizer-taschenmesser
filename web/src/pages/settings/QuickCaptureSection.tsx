import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { getPlatform, type HotkeyError } from '@/core/platform';
import { applyHotkey, applyVaultHotkey, hotkeyLabel } from '@/quickCapture/desktop';
import { DEFAULT_HOTKEY, useDevicePrefs, writePrefs } from '@/quickCapture/device';
import { DEFAULT_TYPES, useCaptureSettings } from '@/quickCapture/settings';
import { t } from '@/strings';
import { Button, Card, HelpHint, SelectField, Switch } from '@/ui';
import styles from './settings.module.css';

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph']);

/** `KeyboardEvent` → accelerator such as `Ctrl+Shift+Space`; undefined while only modifiers are down. */
export function acceleratorOf(
  e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>,
): string | undefined {
  if (MODIFIER_KEYS.has(e.key)) return undefined;
  const key = /^Key[A-Z]$/.test(e.code)
    ? e.code.slice(3)
    : /^Digit\d$/.test(e.code)
      ? e.code.slice(5)
      : e.code; // Space, F1, ArrowUp, …
  if (!key) return undefined;
  const parts = [
    e.ctrlKey && 'Ctrl',
    e.altKey && 'Alt',
    e.shiftKey && 'Shift',
    e.metaKey && 'Super',
  ];
  return [...parts.filter(Boolean), key].join('+');
}

/**
 * One recordable global hotkey. `apply` registers it in the shell (the previous key stays active when
 * that fails); `save` stores it per device afterwards.
 */
function HotkeyField({
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
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');

  async function set(accelerator: string) {
    setError('');
    const code = await apply(accelerator);
    if (code) return setError(t.quickCapture.settings.hotkeyErrors[code]);
    save(accelerator);
  }

  function onRecord(e: KeyboardEvent<HTMLButtonElement>) {
    if (!recording) return;
    e.preventDefault();
    if (e.key === 'Escape') return setRecording(false);
    const accelerator = acceleratorOf(e);
    if (!accelerator) return;
    setRecording(false);
    if (!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      return setError(t.quickCapture.settings.hotkeyNeedsModifier);
    }
    void set(accelerator);
  }

  return (
    <div>
      <span className={styles.muted}>{label}</span>
      <div>
        <Button
          onClick={() => {
            setError('');
            setRecording(true);
          }}
          onKeyDown={onRecord}
          onBlur={() => setRecording(false)}
          aria-label={t.quickCapture.settings.hotkeyRecord}
          data-testid={testId}
        >
          {recording
            ? t.quickCapture.settings.hotkeyRecording
            : value
              ? hotkeyLabel(value)
              : t.quickCapture.settings.hotkeyOff}
        </Button>{' '}
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
