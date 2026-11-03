/**
 * Where a module's notifications may show up. Two channels read the same sources: the bell list in
 * the app (`center`) and the notice at the due time, as a system notification or the in-app card
 * (`alert`). A module can be switched off per channel; absent means on. Only ever a switch-off, so a
 * missing entry never silences anything. Pure; the settings live in the synced `focus` scope.
 */
import type { ModuleManifest } from '@/core/modules/types';

export type Channel = 'center' | 'alert';
export const CHANNELS: readonly Channel[] = ['center', 'alert'];
export type ChannelPrefs = Readonly<Record<string, Partial<Record<Channel, boolean>>>>;

export const channelOn = (prefs: ChannelPrefs, moduleId: string, channel: Channel): boolean =>
  prefs[moduleId]?.[channel] !== false;

/** The modules that may notify on `channel`. */
export function manifestsForChannel(
  manifests: readonly ModuleManifest[],
  prefs: ChannelPrefs,
  channel: Channel | undefined,
): ModuleManifest[] {
  return channel ? manifests.filter((m) => channelOn(prefs, m.id, channel)) : [...manifests];
}

/** The prefs after switching one module and channel on or off; an all-on module leaves no entry behind. */
export function withChannel(
  prefs: ChannelPrefs,
  moduleId: string,
  channel: Channel,
  on: boolean,
): Record<string, Partial<Record<Channel, boolean>>> {
  const next = { ...prefs[moduleId], [channel]: on ? undefined : false };
  const entry = Object.fromEntries(Object.entries(next).filter(([, v]) => v === false));
  const { [moduleId]: _old, ...rest } = prefs;
  return Object.keys(entry).length > 0 ? { ...rest, [moduleId]: entry } : { ...rest };
}
