import { allTools } from '@/core/tools/registry';
import { t } from '@/strings';
import { tKeys } from '@/strings.keys';
import {
  chordLetterOf,
  FKEY_ACTIONS,
  resolveKeys,
  toolOfAction,
  type FKeyAction,
  type ShortcutPrefs,
} from './map';

/** Name of an F-key action in the current language (read at call time). */
export function actionLabel(action: FKeyAction): string {
  const toolId = toolOfAction(action);
  if (toolId) return t.tools.paletteCommand(allTools.find((x) => x.id === toolId)?.name ?? toolId);
  return tKeys.get().actions[action as keyof ReturnType<typeof tKeys.get>['actions']];
}

/** Actions that can have a key here: tool actions only while the tool exists in this build. */
export const shortcutActions = (): FKeyAction[] =>
  FKEY_ACTIONS.filter((a) => {
    const id = toolOfAction(a);
    return !id || allTools.some((x) => x.id === id);
  });

/** Row id / field key of an action (`tool:timer` → `tool-timer`). */
export const shortcutRowKey = (action: FKeyAction): string => action.replace(':', '-');

/**
 * Keys behind palette commands, by command id (`dashboard`, `settings`, `tool-<id>`): the F-key as
 * set and, for a tool that is on, its `T` chord. Commands without a key are absent.
 */
export function paletteKeys(
  prefs: ShortcutPrefs,
  voiceKey: string,
  activeToolIds: readonly string[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const keys = resolveKeys(prefs, voiceKey);
  const commandOf = (a: FKeyAction): string | undefined =>
    a === 'today'
      ? 'dashboard'
      : a === 'settings'
        ? 'settings'
        : a === 'cockpit'
          ? 'cockpit'
          : toolOfAction(a)
            ? `tool-${toolOfAction(a)}`
            : undefined;
  for (const id of activeToolIds) {
    const letter = chordLetterOf(id);
    if (letter) out[`tool-${id}`] = [`T ${letter.toUpperCase()}`];
  }
  for (const action of FKEY_ACTIONS) {
    const id = commandOf(action);
    if (id && keys[action]) out[id] = [...(out[id] ?? []), keys[action]];
  }
  return out;
}
