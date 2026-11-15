import type { TweakGroup, TweakState } from '@/core/platform/optimize';

/** The order of the groups on the page (calm first, the machine-wide power plan last). */
export const GROUP_ORDER: readonly TweakGroup[] = ['appearance', 'explorer', 'privacy', 'power'];

export interface TweakGroupList {
  group: TweakGroup;
  items: TweakState[];
}

/** Settings that exist on this Windows, by group; a group without any is left out. */
export function groupTweaks(list: readonly TweakState[]): TweakGroupList[] {
  return GROUP_ORDER.map((group) => ({
    group,
    items: list.filter((x) => x.applicable && x.group === group),
  })).filter((g) => g.items.length > 0);
}

/** Settings whose state from before is stored ("Alle zurücksetzen" would put them back). */
export const changedHere = (list: readonly TweakState[]): TweakState[] =>
  list.filter((x) => x.changedHere);

/** `default`: Windows' own default applies, nothing is set yet. */
export type SwitchState = 'on' | 'off' | 'default';

export const switchState = (x: TweakState): SwitchState =>
  x.on === null ? 'default' : x.on ? 'on' : 'off';

/** The label of the active option of a choice (empty when none is active). */
export const choiceLabel = (x: TweakState): string =>
  x.options.find((o) => o.id === x.choice)?.label ?? '';

/** A source is only ever opened when it is a Microsoft documentation page. */
export function isMicrosoftSource(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      (u.hostname === 'learn.microsoft.com' || u.hostname === 'support.microsoft.com')
    );
  } catch {
    return false;
  }
}

/** Names for a sentence: "A, B und C" is the caller's business; this joins with commas. */
export const joinNames = (names: readonly string[]): string => names.join(', ');
