import { useEffect } from 'react';
import { matchesVoiceKey, releasesVoiceKey } from '@/core/keyboard/shortcuts';
import { getPlatform } from '@/core/platform';
import { currentVoicePrefs, useVoicePrefs } from '@/core/voice/settings';
import { useVoice, voice, voiceUsable } from '@/core/voice/store';
import { voiceSupport } from '@/core/voice/support';
import { applyVoiceHotkey } from '@/core/voice/hotkey';

/**
 * Mounts the voice key once: hold to talk, or tap to start and tap again to finish; Esc drops the
 * recording. The key works inside text fields too (an F-key types nothing). Where voice input is
 * off or impossible nothing is listened to.
 */
export function useVoiceKey(): void {
  const prefs = useVoicePrefs();
  const supported = voiceSupport().ok;
  const active = prefs.enabled && supported;

  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useVoice.getState().state.phase !== 'idle') {
        // Esc ends the recording only; it must not also close the palette behind it.
        e.preventDefault();
        e.stopPropagation();
        voice.cancel();
        return;
      }
      if (!matchesVoiceKey(e, currentVoicePrefs().key)) return;
      e.preventDefault();
      if (!e.repeat) voice.press();
    };
    const up = (e: KeyboardEvent) => {
      if (releasesVoiceKey(e, currentVoicePrefs().key)) voice.release();
    };
    const blur = () => voice.release();
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', blur);
      voice.cancel();
    };
  }, [active]);

  // Desktop: the system-wide key (off unless set) and its signal from the shell.
  const globalKey = active ? prefs.globalHotkey : '';
  useEffect(() => {
    const desktop = getPlatform().desktop;
    if (!desktop.supported) return;
    void applyVoiceHotkey(globalKey);
    return desktop.onVoiceToggle(() => {
      if (voiceUsable()) voice.toggle();
    });
  }, [globalKey]);
}
