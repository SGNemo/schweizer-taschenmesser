import type { TweakGroup, TweakReset, TweakState } from '@/core/platform/optimize';

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

/**
 * What the page knows about a switch: `default` = no value is stored, Windows decides itself;
 * `custom` = a value is stored that is neither this catalogue's on nor its off (never called
 * Windows' default); `unreadable` = the value cannot be read, so there is no way back and no
 * control.
 */
export type SwitchState = 'on' | 'off' | 'default' | 'custom' | 'unreadable';

export const switchState = (x: TweakState): SwitchState =>
  !x.readable
    ? 'unreadable'
    : x.on !== null
      ? x.on
        ? 'on'
        : 'off'
      : x.custom
        ? 'custom'
        : 'default';

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

/**
 * Names in a row, joined with commas only: the app has no list formatter that follows the UI
 * language, and a fixed "und"/"and" would be wrong in one of them.
 */
export const joinNames = (names: readonly string[]): string => names.join(', ');

/** The sentences "Alle zurücksetzen" answers with (from `t.disk.tweaks`). */
export interface ResetTexts {
  resetDone: (names: string) => string;
  resetKept: (names: string) => string;
  resetLeft: (name: string) => string;
  resetFailed: (name: string) => string;
  resetNothing: string;
}

/**
 * One notice for "Alle zurücksetzen": what was put back, then what stayed as it is, each of
 * those with its reason (changed in Windows since, or could not be written). Two sentences at
 * most.
 */
export function resetMessage(
  r: TweakReset,
  title: (id: string) => string,
  texts: ResetTexts,
): string {
  const kept = [
    ...r.left.map((id) => texts.resetLeft(title(id))),
    ...r.failed.map((id) => texts.resetFailed(title(id))),
  ];
  const parts: string[] = [];
  if (r.restored.length > 0) parts.push(texts.resetDone(joinNames(r.restored.map(title))));
  if (kept.length > 0) parts.push(texts.resetKept(joinNames(kept)));
  return parts.length > 0 ? parts.join(' ') : texts.resetNothing;
}
