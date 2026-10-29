/**
 * Optional music for a focus round (Spotify, off by default): `onFocusStart` / `onFocusEnd` are the only
 * two moments Nemo touches the player – never in between. A failure never interrupts the round; it only
 * sets a quiet "Musik: nicht erreichbar" line on the focus screen. The choice lives device-local in
 * `localStorage` (`tm-spotify-focus`, Zod-checked): only the mode, the id of the chosen playlist and the
 * end switch – no names, no titles. Rules: docs/design/FOCUS-GUIDELINES.md, docs/features/spotify.md.
 */
import { create } from 'zustand';
import { z } from 'zod';
import { createContext } from '@/core/connectors/context';
import { noPremiumSince, NO_PREMIUM_MS, setNoPremium } from '@/core/connectors/nowPlaying';
import { connectors } from '@/core/connectors/registry';
import { loadStatus, useConnectorStatus } from '@/core/connectors/state';
import { ConnectorError, type ConnectorDef } from '@/core/connectors/types';
import { now } from '@/core/time/now';

export const MUSIC_KEY = 'tm-spotify-focus';

export const MUSIC_MODES = ['off', 'resume', 'playlist'] as const;

const musicSchema = z.object({
  mode: z.enum(MUSIC_MODES),
  /** Spotify playlist id (base 62). */
  playlistId: z
    .string()
    .regex(/^[A-Za-z0-9]{1,40}$/)
    .optional(),
  pauseAtEnd: z.boolean(),
});
export type FocusMusic = z.infer<typeof musicSchema>;

export const DEFAULT_MUSIC: FocusMusic = { mode: 'off', pauseAtEnd: true };

export function readMusic(): FocusMusic {
  try {
    const raw = localStorage.getItem(MUSIC_KEY);
    if (!raw) return DEFAULT_MUSIC;
    try {
      const parsed = musicSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // Not JSON: treated like any damaged value.
    }
    localStorage.removeItem(MUSIC_KEY);
  } catch {
    // Storage blocked: music stays off.
  }
  return DEFAULT_MUSIC;
}

const useStore = create<{ music: FocusMusic; unreachable: boolean }>(() => ({
  music: readMusic(),
  unreachable: false,
}));

/** Live choice; changes are written to this device only. */
export function useFocusMusic(): readonly [FocusMusic, (patch: Partial<FocusMusic>) => void] {
  const music = useStore((s) => s.music);
  return [music, setMusic] as const;
}

export function setMusic(patch: Partial<FocusMusic>): void {
  const next = musicSchema.safeParse({ ...useStore.getState().music, ...patch });
  if (!next.success) return;
  try {
    localStorage.setItem(MUSIC_KEY, JSON.stringify(next.data));
  } catch {
    // Storage blocked: the choice holds for this session only.
  }
  useStore.setState({ music: next.data });
}

/** Re-reads the stored choice (tests, other tabs). */
export function reloadMusic(): void {
  useStore.setState({ music: readMusic(), unreachable: false });
}

/** Spotify was disconnected: mode and playlist belonged to that account, back to "Aus". */
export function clearMusic(): void {
  localStorage.removeItem(MUSIC_KEY);
  reloadMusic();
}

/** True after a start that did not work, until the round ends or the next one starts. */
export const isMusicUnreachable = (): boolean => useStore.getState().unreachable;
export const useMusicUnreachable = (): boolean => useStore((s) => s.unreachable);

const media = (): ConnectorDef | undefined => connectors.find((c) => c.nowPlaying?.startPlaylist);

const premiumBlocked = (): boolean => {
  const since = noPremiumSince();
  return since !== undefined && now() - since < NO_PREMIUM_MS;
};

const usable = (state: string, features: string[]): boolean =>
  state !== 'disconnected' && state !== 'expired' && features.includes('control');

/** The row is offered only while Spotify is connected with "Steuern" and Premium has not been ruled out. */
export function useMusicAvailable(): boolean {
  const def = media();
  const status = useConnectorStatus(def?.id ?? '');
  return !!def && !!status && usable(status.state, status.features) && !premiumBlocked();
}

/** Can the player be controlled right now? (Same test as the row, for non-React callers.) */
async function ready(): Promise<ConnectorDef | undefined> {
  const def = media();
  if (!def || premiumBlocked()) return undefined;
  const status = await loadStatus(def.id);
  return usable(status.state, status.features) ? def : undefined;
}

/** A failed start: say it calmly on the focus screen; a missing Premium also hides the row. */
function failed(e: unknown): void {
  if (e instanceof ConnectorError && e.code === 'premium-required') setNoPremium(now());
  useStore.setState({ unreachable: true });
}

/** The round begins: continue playback or start the chosen playlist. Never throws. */
export async function onFocusStart(): Promise<void> {
  useStore.setState({ unreachable: false });
  const music = useStore.getState().music;
  if (music.mode === 'off') return;
  if (music.mode === 'playlist' && !music.playlistId) return;
  try {
    const def = await ready();
    const source = def?.nowPlaying;
    if (!def || !source) return;
    const ctx = createContext(def);
    if (music.mode === 'resume') await source.control(ctx, 'play');
    else await source.startPlaylist?.(ctx, music.playlistId!);
  } catch (e) {
    failed(e);
  }
}

const ended = new Set<number>();

/** The round is over (time up, finished or ended early): pause once, if the user asked for it. Never throws. */
export async function onFocusEnd(startedAt: number): Promise<void> {
  useStore.setState({ unreachable: false });
  const music = useStore.getState().music;
  if (music.mode === 'off' || !music.pauseAtEnd || ended.has(startedAt)) return;
  ended.add(startedAt);
  try {
    const def = await ready();
    if (def?.nowPlaying) await def.nowPlaying.control(createContext(def), 'pause');
  } catch {
    // Nothing to tell at the end of a round; the music just keeps playing.
  }
}
