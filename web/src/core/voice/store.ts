import { create } from 'zustand';
import { getLang } from '@/core/i18n/lang';
import { useUiStore } from '@/stores/ui';
import { createVoiceController } from './controller';
import { IDLE, type VoiceState } from './machine';
import { currentVoicePrefs } from './settings';
import { findRecognitionCtor, recognitionLang, voiceSupport } from './support';

interface VoiceStore {
  state: VoiceState;
  /** Recognised text waiting for the input that takes it (the palette). Memory only, never stored. */
  pending: { id: number; text: string } | undefined;
  takePending(): string | undefined;
}

let seq = 0;

export const useVoice = create<VoiceStore>((set, get) => ({
  state: IDLE,
  pending: undefined,
  takePending() {
    const p = get().pending;
    if (p) set({ pending: undefined });
    return p?.text;
  },
}));

/** Voice input is offered only where the engine exists and the person turned it on. */
export const voiceUsable = (): boolean => currentVoicePrefs().enabled && voiceSupport().ok;

export const voice = createVoiceController({
  create() {
    const Ctor = findRecognitionCtor();
    return Ctor ? new Ctor() : undefined;
  },
  lang: () => recognitionLang(getLang()),
  onTranscript(text) {
    useVoice.setState({ pending: { id: ++seq, text } });
    // The text goes into the same input as typed text: open the palette if it is closed.
    useUiStore.getState().setPaletteOpen(true);
  },
});

voice.subscribe((state) => useVoice.setState({ state }));
