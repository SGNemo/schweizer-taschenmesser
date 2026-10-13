/**
 * "Stumm": a pause of reminders for an hour or until tomorrow morning. Device-local (localStorage):
 * every channel of this device (in-app card, Android schedule, Web Push upload) reads it through
 * `collectDue`, so the pause holds in all three. It switches itself off; nothing to remember.
 * What it does exactly is in `policy.ts` (`applyMute`): explicit reminders arrive without sound,
 * automatic extras wait for the end.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { dateTimeFormat } from '@/core/i18n/format';
import { now } from '@/core/time/now';
import type { Mute } from './policy';

const KEY = 'tm-mute';
const EVENT = 'tm-mute-changed';
const HOUR_MS = 3_600_000;
/** "Bis morgen" ends at this hour the next day (local time). */
const TOMORROW_HOUR = 8;

export const MUTE_PRESETS = ['1h', 'tomorrow'] as const;
export type MutePreset = (typeof MUTE_PRESETS)[number];

export interface MuteState extends Mute {
  preset: MutePreset;
}

/** When a preset ends, given the current time. */
export function muteUntil(preset: MutePreset, at: number): number {
  if (preset === '1h') return at + HOUR_MS;
  const d = new Date(at);
  d.setDate(d.getDate() + 1);
  d.setHours(TOMORROW_HOUR, 0, 0, 0);
  return d.getTime();
}

function parse(raw: string | null): MuteState | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw) as Partial<MuteState>;
    return typeof v.from === 'number' &&
      typeof v.until === 'number' &&
      (v.preset === '1h' || v.preset === 'tomorrow')
      ? { from: v.from, until: v.until, preset: v.preset }
      : undefined;
  } catch {
    return undefined;
  }
}

/** The running pause, or `undefined` when there is none or it is over. */
export function getMute(at: number = now()): MuteState | undefined {
  let state: MuteState | undefined;
  try {
    state = parse(localStorage.getItem(KEY));
  } catch {
    return undefined;
  }
  return state && state.until > at ? state : undefined;
}

/** Starts a pause (`preset`) or ends it (`undefined`). Asks the channels to reschedule. */
export function setMute(preset: MutePreset | undefined, at: number = now()): void {
  try {
    if (preset) {
      const state: MuteState = { from: at, until: muteUntil(preset, at), preset };
      localStorage.setItem(KEY, JSON.stringify(state));
    } else localStorage.removeItem(KEY);
  } catch {
    // Storage may be blocked; then the pause simply does not start.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Calls `fn` when a pause starts or ends (the schedules are rebuilt then). Returns a stop function. */
export function onMuteChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

const subscribe = (cb: () => void) => onMuteChange(cb);
const snapshot = (): string => {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};

/** The running pause for components; re-renders when it starts, is ended by hand or runs out. */
export function useMute(): MuteState | undefined {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '');
  const [, setTick] = useState(0);
  const state = parse(raw || null);
  const until = state?.until;
  useEffect(() => {
    if (until === undefined) return;
    const wait = until - now();
    if (wait <= 0) return;
    // setTimeout caps at ~24.8 days; a pause never gets near that.
    const timer = setTimeout(() => setTick((n) => n + 1), Math.min(wait, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [until]);
  return state && state.until > now() ? state : undefined;
}

/** "17:30", or "Do. 08:00" when the pause ends on another day. */
export function formatMuteEnd(until: number, at: number = now()): string {
  const sameDay = new Date(until).toDateString() === new Date(at).toDateString();
  return dateTimeFormat(
    sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { weekday: 'short', hour: '2-digit', minute: '2-digit' },
  ).format(until);
}
