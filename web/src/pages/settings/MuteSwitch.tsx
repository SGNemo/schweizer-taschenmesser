import {
  formatMuteEnd,
  MUTE_PRESETS,
  setMute,
  useMute,
  type MutePreset,
} from '@/core/notifications/mute';
import { tComfort } from '@/strings.comfort';
import { Segmented } from '@/ui';
import styles from './SettingsLayout.module.css';

/** "Stumm": off, one hour or until tomorrow morning. Ends by itself; the hint says what it does. */
export function MuteSwitch() {
  const text = tComfort.get().mute;
  const mute = useMute();
  const labels: Record<MutePreset | 'off', string> = {
    off: text.off,
    '1h': text.hour,
    tomorrow: text.tomorrow,
  };
  return (
    <div className={styles.quickItem}>
      <span className={styles.quickLabel}>
        {mute ? text.until(formatMuteEnd(mute.until)) : text.title}
      </span>
      <Segmented<MutePreset | 'off'>
        label={text.title}
        value={mute?.preset ?? 'off'}
        options={(['off', ...MUTE_PRESETS] as const).map((v) => ({ value: v, label: labels[v] }))}
        onChange={(v) => setMute(v === 'off' ? undefined : v)}
      />
      <span className={styles.quickLabel}>{text.hint}</span>
    </div>
  );
}
