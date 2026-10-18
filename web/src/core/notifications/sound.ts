/**
 * The app's own reminder tone for the game mode: a few sine notes, synthesised (no audio asset, no
 * licence). Three tunes, a volume, a test button. The same note list drives both players:
 *
 * - Web Audio, when the window is visible and the audio context runs;
 * - the native side (`desktop.playTone`, Windows `PlaySound`) otherwise. A window hidden in the
 *   tray or covered by a game gets no guaranteed audio from WebView2: its timers are throttled
 *   and an `AudioContext` that never saw a click stays suspended (autoplay rules). The native
 *   player does not depend on either. Details: docs/features/game-mode.md.
 */
import { getPlatform } from '@/core/platform';
import type { ToneNote } from '@/core/platform/types';

export const REMINDER_SOUNDS = ['soft', 'bell', 'drop'] as const;
export type ReminderSound = (typeof REMINDER_SOUNDS)[number];

const note = (hz: number, atMs: number, durMs: number, gain = 1): ToneNote => ({
  hz,
  atMs,
  durMs,
  gain,
});

/** All tunes stay under 1.2 s and use gentle, low-mid notes. */
export const SOUND_NOTES: Record<ReminderSound, ToneNote[]> = {
  /** Two soft rising notes. */
  soft: [note(523.25, 0, 220), note(659.25, 180, 380)],
  /** One round bell: a note with a quieter fifth above it. */
  bell: [note(784, 0, 900), note(1176, 0, 700, 0.35)],
  /** A single falling drop. */
  drop: [note(880, 0, 160), note(587.33, 140, 420)],
};

/** 0–100 → 0–1 (a gentle curve, so the lower half is not too quiet to tell apart). */
export const toGain = (volume: number): number => {
  const v = Math.min(100, Math.max(0, volume)) / 100;
  return v * v;
};

export interface ToneDeps {
  /** Whether the window can play now (visible). */
  visible(): boolean;
  /** Plays with Web Audio; resolves false when the context could not start (suspended, no audio). */
  web(notes: ToneNote[], gain: number): Promise<boolean>;
  /** Native player; absent where there is none (browser, Android). */
  native?: (notes: ToneNote[], gain: number) => Promise<void>;
}

/** Plays the tune. Returns which player did it, or `none` (silence is never an error). */
export async function playReminderTone(
  sound: ReminderSound,
  volume: number,
  deps: ToneDeps = defaultDeps(),
): Promise<'web' | 'native' | 'none'> {
  const gain = toGain(volume);
  if (gain <= 0) return 'none';
  const notes = SOUND_NOTES[sound];
  if (deps.visible() && (await deps.web(notes, gain).catch(() => false))) return 'web';
  if (deps.native) {
    try {
      await deps.native(notes, gain);
      return 'native';
    } catch {
      return 'none';
    }
  }
  return 'none';
}

const RESUME_WAIT_MS = 250;

let ctx: AudioContext | undefined;

async function playWeb(notes: ToneNote[], gain: number): Promise<boolean> {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return false;
  ctx ??= new Ctor();
  if (ctx.state !== 'running') {
    // Autoplay rules: without a prior click `resume()` stays pending; do not wait for it.
    await Promise.race([
      ctx.resume().catch(() => undefined),
      new Promise((r) => setTimeout(r, RESUME_WAIT_MS)),
    ]);
  }
  if (ctx.state !== 'running') return false;
  const start = ctx.currentTime;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const at = start + n.atMs / 1000;
    const end = at + n.durMs / 1000;
    osc.frequency.value = n.hz;
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.linearRampToValueAtTime(Math.max(0.0001, 0.6 * gain * n.gain), at + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(amp).connect(ctx.destination);
    osc.start(at);
    osc.stop(end + 0.02);
  }
  return true;
}

function defaultDeps(): ToneDeps {
  const play = getPlatform().desktop.playTone;
  return {
    visible: () => document.visibilityState === 'visible',
    web: playWeb,
    native: play ? (notes, gain) => play(notes, gain) : undefined,
  };
}
