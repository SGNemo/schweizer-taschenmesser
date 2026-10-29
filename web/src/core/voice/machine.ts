/**
 * State machine of one voice input. Pure: the controller feeds it events and acts on `deliver`.
 *
 *   idle ──start──▶ listening ──stop──▶ finishing ──end──▶ idle (+ deliver the text)
 *                      └──────cancel / error──────────────▶ idle (nothing delivered)
 */
export type VoicePhase = 'idle' | 'listening' | 'finishing';
/** Why nothing arrived, in calm words the UI maps to a sentence. */
export type VoiceNotice = 'denied' | 'silent' | 'failed';

export interface VoiceState {
  phase: VoicePhase;
  /** Text the engine is sure about. */
  final: string;
  /** Text it may still change. */
  interim: string;
  notice?: VoiceNotice;
}

export type VoiceEvent =
  | { type: 'start' }
  | { type: 'result'; final: string; interim: string }
  | { type: 'stop' }
  | { type: 'cancel' }
  | { type: 'end' }
  | { type: 'error'; code: string };

export const IDLE: VoiceState = { phase: 'idle', final: '', interim: '' };

const join = (a: string, b: string): string => [a, b].filter(Boolean).join(' ').trim();
export const transcriptOf = (s: Pick<VoiceState, 'final' | 'interim'>): string =>
  join(s.final.trim(), s.interim.trim());

function noticeFor(code: string): VoiceNotice | undefined {
  switch (code) {
    case 'aborted':
      return undefined;
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied';
    case 'no-speech':
      return 'silent';
    default:
      return 'failed';
  }
}

export function reduce(
  state: VoiceState,
  event: VoiceEvent,
): { state: VoiceState; deliver?: string } {
  switch (event.type) {
    case 'start':
      return state.phase === 'idle'
        ? { state: { phase: 'listening', final: '', interim: '' } }
        : { state };
    case 'result':
      return state.phase === 'idle'
        ? { state }
        : { state: { ...state, final: event.final, interim: event.interim } };
    case 'stop':
      return state.phase === 'listening' ? { state: { ...state, phase: 'finishing' } } : { state };
    case 'cancel':
      return { state: IDLE };
    case 'error': {
      if (state.phase === 'idle') return { state };
      return { state: { ...IDLE, notice: noticeFor(event.code) } };
    }
    case 'end': {
      if (state.phase === 'idle') return { state };
      const text = transcriptOf(state);
      return text ? { state: IDLE, deliver: text } : { state: { ...IDLE, notice: 'silent' } };
    }
  }
}
