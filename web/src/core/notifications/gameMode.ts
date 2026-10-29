/**
 * "Zock-Modus": while a full-screen game (or presentation) runs, a reminder arrives without the
 * system sound and with a short tone of the app instead. Device-local (localStorage, like "Stumm"):
 * the mode, the tone and the volume belong to this machine. Nothing leaves the device, and the app
 * never learns what runs – the desktop shell only answers yes/no (`desktop.gameActive`).
 *
 * `auto` follows the detection (desktop only), `on` is the manual switch for when the detection
 * does not catch a game, `off` leaves reminders as they are. Where there is no tone (Android, PWA)
 * `on` makes reminders arrive on the quiet channel (see `policy.ts` `applyQuietAll`).
 */
import { useSyncExternalStore } from 'react';
import { getPlatform } from '@/core/platform';
import type { PlatformKind } from '@/core/platform/types';
import { REMINDER_SOUNDS, type ReminderSound } from './sound';

const KEY = 'tm-game-mode';
const EVENT = 'tm-game-mode-changed';

export const GAME_MODES = ['off', 'auto', 'on'] as const;
export type GameMode = (typeof GAME_MODES)[number];

export interface GameSettings {
  mode: GameMode;
  sound: ReminderSound;
  /** 0–100. */
  volume: number;
}

export const DEFAULT_VOLUME = 40;

/** Desktop detects games, so it starts on `auto`; elsewhere there is nothing to detect. */
export const defaultMode = (kind: PlatformKind): GameMode => (kind === 'desktop' ? 'auto' : 'off');

function parse(raw: string | null, kind: PlatformKind): GameSettings {
  const fallback: GameSettings = {
    mode: defaultMode(kind),
    sound: 'soft',
    volume: DEFAULT_VOLUME,
  };
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as Partial<GameSettings>;
    return {
      // `auto` has no meaning without detection; it behaves like `off` there (see `isGamingNow`).
      mode: GAME_MODES.includes(v.mode as GameMode) ? (v.mode as GameMode) : fallback.mode,
      sound: REMINDER_SOUNDS.includes(v.sound as ReminderSound)
        ? (v.sound as ReminderSound)
        : fallback.sound,
      volume:
        typeof v.volume === 'number' && Number.isFinite(v.volume)
          ? Math.min(100, Math.max(0, Math.round(v.volume)))
          : fallback.volume,
    };
  } catch {
    return fallback;
  }
}

const read = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export function getGameSettings(kind: PlatformKind = getPlatform().kind): GameSettings {
  return parse(read(), kind);
}

export function setGameSettings(
  patch: Partial<GameSettings>,
  kind: PlatformKind = getPlatform().kind,
): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...getGameSettings(kind), ...patch }));
  } catch {
    // Storage may be blocked; then the setting simply does not change.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Calls `fn` when the settings change (the OS schedules are rebuilt then). Returns a stop function. */
export function onGameModeChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

const subscribe = (cb: () => void) => onGameModeChange(cb);
const snapshot = (): string => read() ?? '';

/** The settings for components; re-renders when they change. */
export function useGameSettings(): GameSettings {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '');
  return parse(raw || null, getPlatform().kind);
}

export interface GamingDeps {
  kind: PlatformKind;
  settings: GameSettings;
  /** The desktop shell's yes/no; absent where it cannot tell. */
  detect?: () => Promise<boolean>;
}

/** Whether a reminder should take the game path right now. Asks the shell only in `auto`. */
export async function isGamingNow(deps: GamingDeps): Promise<boolean> {
  const { mode } = deps.settings;
  if (mode === 'on') return true;
  if (mode !== 'auto' || deps.kind !== 'desktop' || !deps.detect) return false;
  try {
    return await deps.detect();
  } catch {
    return false;
  }
}

/**
 * Where no tone exists (Android app, PWA) the manual switch is the only trigger and it works at
 * schedule time: `true` = collect the reminders as quiet ones (channel `nemo-quiet` on Android,
 * `silent` in the browser).
 */
export function quietChannelWanted(kind: PlatformKind, settings: GameSettings): boolean {
  return kind !== 'desktop' && settings.mode === 'on';
}
