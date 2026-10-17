import { useVoice } from '@/core/voice/store';
import { useUiStore } from '@/stores/ui';
import { Icon } from '@/ui';
import { useVoiceStatus } from './VoiceMic';
import styles from './voice.module.css';

/** Calm note while recording outside the palette (the palette shows it on its own button). */
export function VoiceStatus() {
  const phase = useVoice((s) => s.state.phase);
  const paletteOpen = useUiStore((s) => s.paletteOpen);
  const status = useVoiceStatus();
  if (paletteOpen || phase === 'idle') return null;
  return (
    <div className={styles.pill} role="status" data-testid="voice-pill">
      <Icon name="mic" size={18} />
      {status}
    </div>
  );
}
