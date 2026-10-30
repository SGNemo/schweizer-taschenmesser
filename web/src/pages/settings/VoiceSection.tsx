import { useState } from 'react';
import { getPlatform } from '@/core/platform';
import { applyVoiceHotkey } from '@/core/voice/hotkey';
import { actionLabel } from '@/core/keyboard/labels';
import { holderOf } from '@/core/keyboard/map';
import { useShortcutPrefs } from '@/core/keyboard/prefs';
import { isValidVoiceKey, keyCaps } from '@/core/voice/keys';
import { DEFAULT_VOICE_KEY, useVoicePrefs, writeVoicePrefs } from '@/core/voice/settings';
import { voiceSupport } from '@/core/voice/support';
import { t } from '@/strings';
import { tKeys } from '@/strings.keys';
import { Button, Card, Dialog, KeyRecorder, Switch } from '@/ui';
import { HotkeyField } from './QuickCaptureSection';
import styles from './settings.module.css';

/** In-app voice key: press the key you want (F1–F12, or a key with Ctrl/Alt). */
function KeyField({
  value,
  onChange,
  check,
}: {
  value: string;
  onChange: (key: string) => void;
  /** Error text when the key belongs to another action (the key map), else undefined. */
  check: (key: string) => string | undefined;
}) {
  const [error, setError] = useState('');

  function onRecord(key: string) {
    if (!isValidVoiceKey(key)) return setError(t.voice.keyInvalid);
    const taken = check(key);
    if (taken) return setError(taken);
    setError('');
    onChange(key);
  }

  return (
    <div>
      <span className={styles.muted}>{t.voice.key}</span>
      <div>
        <KeyRecorder
          value={value}
          onRecord={onRecord}
          onStart={() => setError('')}
          display={(v) => keyCaps(v).join(' + ')}
          recordingText={t.voice.keyRecording}
          emptyText={t.voice.keyOff}
          ariaLabel={t.voice.keyRecord}
          testId="voice-key-record"
        />{' '}
        {value !== DEFAULT_VOICE_KEY ? (
          <Button onClick={() => onChange(DEFAULT_VOICE_KEY)}>
            {t.voice.keyDefault} ({DEFAULT_VOICE_KEY})
          </Button>
        ) : null}{' '}
        {value ? (
          <Button variant="ghost" onClick={() => onChange('')}>
            {t.voice.keyClear}
          </Button>
        ) : null}
      </div>
      <span className={styles.muted}>{t.voice.keyHint}</span>
      {error ? (
        <p role="alert" className={styles.muted}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Settings → "Schnellerfassung" → Spracheingabe: off by default, privacy notice on first use. */
export function VoiceSection() {
  const prefs = useVoicePrefs();
  const shortcuts = useShortcutPrefs();
  const desktop = getPlatform().desktop;
  const supported = voiceSupport().ok;
  const [asking, setAsking] = useState(false);

  function toggle(on: boolean) {
    if (on && !prefs.noticeSeen) return setAsking(true);
    writeVoicePrefs({ enabled: on });
  }

  return (
    <Card>
      <p className={styles.muted}>{t.voice.intro}</p>
      {supported ? null : (
        <p className={styles.muted} data-testid="voice-unavailable">
          {t.voice.unavailable}
        </p>
      )}
      <Switch
        label={t.voice.enable}
        hint={t.voice.enableHint}
        checked={prefs.enabled && supported}
        disabled={!supported}
        onChange={toggle}
      />
      {prefs.enabled && supported ? (
        <>
          <KeyField
            value={prefs.key}
            onChange={(key) => writeVoicePrefs({ key })}
            check={(key) => {
              // The current voice key already suppresses the action it sits on: re-recording it is free.
              const holder = holderOf(shortcuts, key, prefs.key);
              const tx = tKeys.get();
              return holder ? tx.voiceTaken(key, actionLabel(holder)) : undefined;
            }}
          />
          {desktop.supported ? (
            <HotkeyField
              label={t.voice.globalKey}
              hint={t.voice.globalHint}
              value={prefs.globalHotkey}
              apply={applyVoiceHotkey}
              save={(globalHotkey) => writeVoicePrefs({ globalHotkey })}
              testId="voice-hotkey-record"
            />
          ) : null}
        </>
      ) : null}
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title={t.voice.noticeTitle}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsking(false)}>
              {t.voice.noticeCancel}
            </Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => {
                writeVoicePrefs({ enabled: true, noticeSeen: true });
                setAsking(false);
              }}
              data-testid="voice-notice-confirm"
            >
              {t.voice.noticeConfirm}
            </Button>
          </>
        }
      >
        <p>{t.voice.noticeText}</p>
      </Dialog>
    </Card>
  );
}
