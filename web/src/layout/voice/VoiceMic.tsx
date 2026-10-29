import { useVoice, voice, voiceUsable } from '@/core/voice/store';
import { keyCaps } from '@/core/voice/keys';
import { useVoicePrefs } from '@/core/voice/settings';
import { voiceSupport } from '@/core/voice/support';
import { t } from '@/strings';
import { Icon } from '@/ui';
import styles from './voice.module.css';

/** What the recording is doing, in words; shared by the palette button and the floating pill. */
export function useVoiceStatus(): string {
  const { state } = useVoice();
  const prefs = useVoicePrefs();
  if (state.phase === 'finishing') return t.voice.finishing;
  if (state.phase === 'listening') {
    return `${t.voice.listening} ${
      prefs.key ? t.voice.listeningHint(keyCaps(prefs.key).join('+')) : t.voice.listeningHintNoKey
    }`;
  }
  return state.notice ? t.voice.notices[state.notice] : '';
}

/** Microphone button next to the palette input (hidden where voice input is off or impossible). */
export function VoiceMic() {
  const phase = useVoice((s) => s.state.phase);
  useVoicePrefs();
  const status = useVoiceStatus();
  if (!voiceUsable() || !voiceSupport().ok) return null;
  const listening = phase === 'listening';
  return (
    <div className={styles.row}>
      <button
        type="button"
        className={`${styles.button} ${listening ? styles.on : ''}`}
        aria-pressed={listening}
        disabled={phase === 'finishing'}
        onClick={() => voice.toggle()}
        data-testid="voice-mic"
      >
        <Icon name="mic" size={18} />
        {listening ? t.voice.buttonStop : t.voice.button}
      </button>
      <p className={styles.status} role="status" data-testid="voice-status">
        {status}
      </p>
    </div>
  );
}
