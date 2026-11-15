import type { StartupItem } from '@/core/platform/optimize';

/** The autostart list as the tab shows it: the account's own entries, then the PC's. */
export interface StartupGroups {
  user: StartupItem[];
  machine: StartupItem[];
}

const byName = (a: StartupItem, b: StartupItem): number =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id);

/** Splits by scope and sorts each group by name (stable for equal names). */
export function groupStartup(items: readonly StartupItem[]): StartupGroups {
  return {
    user: items.filter((i) => i.scope === 'user').sort(byName),
    machine: items.filter((i) => i.scope === 'machine').sort(byName),
  };
}

/** How many of these entries start with Windows. */
export function enabledCount(items: readonly StartupItem[]): number {
  return items.filter((i) => i.enabled).length;
}

/** A long command line with its middle left out, so the program and the last arguments stay. */
export function shortCommand(command: string, max = 72): string {
  const text = command.trim();
  if (text.length <= max) return text;
  const head = Math.ceil((max - 1) * 0.6);
  const tail = max - 1 - head;
  return `${text.slice(0, head).trimEnd()}…${text.slice(text.length - tail).trimStart()}`;
}

/**
 * The quiet second line of a row: the shortened command, led by the program's name when the
 * entry's own name does not already say it; a shortcut says that it lies in the startup folder.
 */
export function detailOf(item: StartupItem, folderLabel: string): string {
  const command = shortCommand(item.command);
  if (item.source === 'folder') return `${folderLabel} · ${command}`;
  const known = item.program === '' || item.program.toLowerCase() === item.name.toLowerCase();
  return known ? command : `${item.program} · ${command}`;
}

/** The list after a switch, before the fresh one arrives. */
export function withEnabled(
  items: readonly StartupItem[],
  id: string,
  enabled: boolean,
): StartupItem[] {
  return items.map((i) => (i.id === id ? { ...i, enabled } : i));
}
