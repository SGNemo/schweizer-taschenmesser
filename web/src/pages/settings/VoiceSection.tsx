import { useState, type KeyboardEvent } from 'react';
import { getPlatform } from '@/core/platform';
import { applyVoiceHotkey } from '@/core/voice/hotkey';
import { isValidVoiceKey, keyCaps, keyString } from '@/core/voice/keys';
import { DEFAULT_VOICE_KEY, useVoicePrefs, writeVoicePrefs } from '@/core/voice/settings';
import { voiceSupport } from '@/core/voice/support';
import { t } from '@/strings';
import { Button, Card, Dialog, Switch } from '@/ui';
import { HotkeyField } from './QuickCaptureSection';
import styles from './settings.module.css';

/** In-app voice key: press the key you want (F1–F12, or a key with Ctrl/Alt). */
function KeyField({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');

  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (!recording) return;
    e.preventDefault();
    if (e.key === 'Escape') return setRecording(false);
    const key = keyString(e);
    if (!key) return;
    setRecording(false);
    if (!isValidVoiceKey(key)) return setError(t.voice.keyInvalid);
    setError('');
    onChange(key);
  }

  return (
    <div>
      <span className={styles.muted}>{t.voice.key}</span>
      <div>
        <Button
          onClick={() => {
            setError('');
            setRecording(true);
          }}
          onKeyDown={onKey}
          onBlur={() => setRecording(false)}
          aria-label={t.voice.keyRecord}
          data-testid="voice-key-record"
        >
          {recording ? t.voice.keyRecording : value ? keyCaps(value).join(' + ') : t.voice.keyOff}
        </Button>{' '}
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
          <KeyField value={prefs.key} onChange={(key) => writeVoicePrefs({ key })} />
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
