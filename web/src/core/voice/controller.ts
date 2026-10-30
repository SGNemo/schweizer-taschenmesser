import { now } from '@/core/time/now';
import { IDLE, reduce, type VoiceEvent, type VoiceState } from './machine';
import type { RecognitionEventLike, RecognitionLike } from './support';

/** Held at least this long = push-to-talk (release stops); shorter = a tap that keeps listening. */
export const HOLD_MS = 400;

export interface VoiceControllerDeps {
  /** A fresh recogniser, or undefined where there is none. */
  create(): RecognitionLike | undefined;
  lang(): string;
  /** The recognised text of a finished recording; never called for a cancelled one. */
  onTranscript(text: string): void;
}

export interface VoiceController {
  getState(): VoiceState;
  subscribe(listener: (state: VoiceState) => void): () => void;
  /** Key down: starts listening, or (while a tap keeps it open) stops it. */
  press(): void;
  /** Key up: ends a push-to-talk hold; a short tap keeps listening. */
  release(): void;
  /** Button / global key: start when idle, stop while listening. */
  toggle(): void;
  /** Esc: drops the recording; nothing is delivered and nothing typed so far is touched. */
  cancel(): void;
}

type Mode = 'none' | 'held' | 'tap';

export function createVoiceController(deps: VoiceControllerDeps): VoiceController {
  let state: VoiceState = IDLE;
  let recogniser: RecognitionLike | undefined;
  let mode: Mode = 'none';
  let pressedAt = 0;
  const listeners = new Set<(s: VoiceState) => void>();

  const dispatch = (event: VoiceEvent): void => {
    const next = reduce(state, event);
    state = next.state;
    listeners.forEach((l) => l(state));
    if (next.deliver) deps.onTranscript(next.deliver);
  };

  const detach = (r: RecognitionLike | undefined): void => {
    if (!r) return;
    r.onresult = r.onerror = r.onend = null;
  };

  function begin(): boolean {
    if (state.phase !== 'idle') return false;
    const r = deps.create();
    if (!r) {
      dispatch({ type: 'start' });
      dispatch({ type: 'error', code: 'unavailable' });
      return false;
    }
    r.lang = deps.lang();
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: RecognitionEventLike) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const part = e.results[i]![0].transcript;
        if (e.results[i]!.isFinal) final += part;
        else interim += part;
      }
      dispatch({ type: 'result', final, interim });
    };
    r.onerror = (e) => {
      // The engine ends itself after an error; drop it now so a late `end` cannot hit a new recording.
      detach(r);
      if (recogniser === r) recogniser = undefined;
      mode = 'none';
      dispatch({ type: 'error', code: e.error });
      try {
        r.abort();
      } catch {
        // already gone
      }
    };
    r.onend = () => {
      if (recogniser === r) recogniser = undefined;
      mode = 'none';
      dispatch({ type: 'end' });
    };
    recogniser = r;
    dispatch({ type: 'start' });
    try {
      r.start();
    } catch {
      detach(r);
      recogniser = undefined;
      dispatch({ type: 'error', code: 'failed' });
      return false;
    }
    return true;
  }

  function finish(): void {
    if (state.phase !== 'listening') return;
    dispatch({ type: 'stop' });
    try {
      recogniser?.stop();
    } catch {
      dispatch({ type: 'end' });
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    press() {
      if (state.phase === 'idle') {
        if (begin()) {
          mode = 'held';
          pressedAt = now();
        }
      } else if (state.phase === 'listening' && mode === 'tap') {
        mode = 'none';
        finish();
      }
    },
    release() {
      if (mode !== 'held') return;
      if (now() - pressedAt >= HOLD_MS) {
        mode = 'none';
        finish();
      } else mode = 'tap';
    },
    toggle() {
      if (state.phase === 'idle') {
        if (begin()) mode = 'tap';
      } else {
        mode = 'none';
        finish();
      }
    },
    cancel() {
      if (state.phase === 'idle') return;
      const r = recogniser;
      recogniser = undefined;
      mode = 'none';
      detach(r);
      dispatch({ type: 'cancel' });
      try {
        r?.abort();
      } catch {
        // already gone
      }
    },
  };
}
