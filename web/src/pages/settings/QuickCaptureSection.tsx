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
import { now, today } from '@/core/time/now';
import { parseCapture, PREFIXES, type CaptureType } from '@/quickCapture/parser';
import { previewChips } from '@/quickCapture/ui/chips';
import { useCaptureTypes } from '@/quickCapture/ui/useCaptureTypes';
import { t } from '@/strings';
import { tSettingsV31 } from '@/strings.settingsV31';
import {
  Button,
  KeyRecorder,
  SelectField,
  SettingRow,
  SettingsGroup,
  Switch,
  TextField,
} from '@/ui';
import { StatusCard } from './components/StatusCard';
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
  /** Leave out inside a `SettingRow` (the row shows the label). */
  label?: ReactNode;
  hint?: string;
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
      {label ? <span className={styles.muted}>{label}</span> : null}
      <div className={styles.keyRow}>
        <KeyRecorder
          value={value}
          onRecord={onRecord}
          onStart={() => setError('')}
          display={hotkeyLabel}
          recordingText={t.quickCapture.settings.hotkeyRecording}
          emptyText={t.quickCapture.settings.hotkeyOff}
          ariaLabel={t.quickCapture.settings.hotkeyRecord}
          testId={testId}
        />
        {/* Settings identity v3.1: one key field; "back to the default" only when it differs, so no two buttons
            ever show the same keys. */}
        {defaultValue && value !== defaultValue ? (
          <Button variant="ghost" onClick={() => void set(defaultValue)}>
            {tSettingsV31.get().quick.hotkeyDefault(hotkeyLabel(defaultValue))}
          </Button>
        ) : null}
        {value ? (
          <Button variant="ghost" onClick={() => void set('')}>
            {t.quickCapture.settings.hotkeyClear}
          </Button>
        ) : null}
      </div>
      {hint ? <span className={styles.muted}>{hint}</span> : null}
      {error ? (
        <p role="alert" className={styles.muted}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The prefixes shown under the sample; their targets come from the parser's own table. */
const SAMPLE_PREFIXES = ['p', 't', 'k', '$'] as const;

/**
 * A live sample of the parser: what a typed sentence would become (target, date, time) as chips. Saves nothing and
 * sends nothing; the text stays in this field (component state only).
 */
export function CaptureSample({ defaultType }: { defaultType?: CaptureType }) {
  const o = tSettingsV31.use().quick;
  const [text, setText] = useState('');
  const sentence = text.trim() || o.samplePlaceholder;
  // React Compiler memoizes this; the parser is pure and fast (one short sentence).
  const { fitness, place } = useCaptureTypes();
  const result = parseCapture(sentence, { now: new Date(now()), defaultType, fitness, place });
  const chips = previewChips(result.fields, result.type, result.notes, today());
  const prefixes = SAMPLE_PREFIXES.map((p) => `${p} → ${t.quickCapture.target[PREFIXES[p]!]}`).join(
    ' · ',
  );
  return (
    <div className={styles.sample} data-testid="capture-sample">
      <TextField
        label={o.sampleLabel}
        placeholder={o.samplePlaceholder}
        value={text}
        autoComplete="off"
        // Like the real capture field: no browser spellcheck, so the typed sentence never leaves the device.
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
      />
      <ul className={styles.sampleChips} aria-label={o.sampleResult}>
        {chips.map((c) => (
          <li
            key={`${c.id}-${c.label}`}
            className={styles.sampleChip}
            data-warn={c.warn || undefined}
          >
            {c.label}
          </li>
        ))}
      </ul>
      <p className={styles.muted}>{o.prefixes(prefixes)}</p>
    </div>
  );
}

/**
 * Settings → "Schnellerfassung" (settings identity v3.1): a live sample in the tab's status card, then the groups
 * "Ziel", "Tastenkürzel" and "Im Hintergrund" as rows (title, one line, control; long explanations behind ⓘ).
 */
export function QuickCaptureSection() {
  const desktop = getPlatform().desktop;
  const prefs = useDevicePrefs();
  const [settings, patch] = useCaptureSettings();
  const [focus, patchFocus] = useFocusSettings();
  const [error, setError] = useState('');
  const [portable, setPortable] = useState(false);
  const o = tSettingsV31.use().quick;
  const qs = t.quickCapture.settings;

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
      setError(qs.autostartFailed);
    }
  }

  return (
    <div className={styles.quickStack}>
      <StatusCard
        title={o.sampleTitle}
        line={o.sampleLine}
        testId="quick-capture-state"
        body={<CaptureSample defaultType={settings?.defaultType} />}
      />
      <SettingsGroup id="quickcapture" title={o.groupTarget} plain>
        <SettingRow
          id="quickcapture--defaultType"
          label={qs.defaultType}
          description={o.defaultTypeLine}
        >
          <SelectField
            label={qs.defaultType}
            labelHidden
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
        </SettingRow>
        <SettingRow
          id="quickcapture--noQuestion"
          label={qs.noQuestion}
          description={o.noQuestionLine}
          hint={qs.noQuestionHint}
        >
          <Switch
            label={qs.noQuestion}
            labelHidden
            checked={focus.captureNoQuestion}
            onChange={(v) => void patchFocus({ captureNoQuestion: v })}
          />
        </SettingRow>
      </SettingsGroup>
      {desktop.supported ? (
        <>
          <SettingsGroup id="quickcapture-keys" title={o.groupKeys} plain>
            <SettingRow
              id="quickcapture--hotkey"
              label={qs.hotkey}
              description={o.hotkeyLine}
              hint={qs.hotkeyHint}
            >
              <HotkeyField
                value={prefs.hotkey}
                defaultValue={DEFAULT_HOTKEY}
                apply={applyHotkey}
                save={(hotkey) => writePrefs({ hotkey })}
                testId="hotkey-record"
              />
            </SettingRow>
            <SettingRow
              id="quickcapture--vaultHotkey"
              label={qs.vaultHotkey}
              description={o.vaultHotkeyLine}
              hint={qs.vaultHotkeyHint}
            >
              <HotkeyField
                value={prefs.vaultHotkey}
                apply={applyVaultHotkey}
                save={(vaultHotkey) => writePrefs({ vaultHotkey })}
                testId="vault-hotkey-record"
              />
            </SettingRow>
          </SettingsGroup>
          <SettingsGroup id="quickcapture-background" title={o.groupBackground} plain>
            <SettingRow
              id="quickcapture--closeToTray"
              label={qs.closeToTray}
              description={o.closeToTrayLine}
              hint={qs.trayHelp}
            >
              <Switch
                label={qs.closeToTray}
                labelHidden
                checked={prefs.closeToTray}
                onChange={(closeToTray) => {
                  writePrefs({ closeToTray });
                  void desktop.setCloseToTray(closeToTray);
                }}
              />
            </SettingRow>
            <SettingRow
              id="quickcapture--trayToday"
              label={qs.trayToday}
              description={o.trayTodayLine}
              hint={qs.trayTodayHint}
            >
              <Switch
                label={qs.trayToday}
                labelHidden
                checked={prefs.trayToday}
                onChange={(trayToday) => {
                  writePrefs({ trayToday });
                  refreshTrayToday();
                }}
              />
            </SettingRow>
            <SettingRow
              id="quickcapture--autostart"
              label={qs.autostart}
              description={o.autostartLine}
              hint={portable ? qs.autostartPortable : undefined}
            >
              <Switch
                label={qs.autostart}
                labelHidden
                checked={prefs.autostart}
                onChange={(v) => void toggleAutostart(v)}
              />
            </SettingRow>
            {error ? (
              <p role="alert" className={styles.muted}>
                {error}
              </p>
            ) : null}
            <SettingRow
              id="quickcapture--clipboard"
              label={qs.clipboard}
              description={o.clipboardLine}
              hint={qs.clipboardHint}
            >
              <Switch
                label={qs.clipboard}
                labelHidden
                checked={prefs.clipboard}
                onChange={(clipboard) => writePrefs({ clipboard })}
              />
            </SettingRow>
          </SettingsGroup>
        </>
      ) : (
        <p className={styles.muted}>{qs.desktopOnly}</p>
      )}
    </div>
  );
}
