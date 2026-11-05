/**
 * Pure rules of the toolbox panel: which tool opens first, how the list is searched and grouped,
 * what Alt+1…9 picks. No React, no storage: `ToolsPanel` feeds it and `panelLogic.test.ts` pins it.
 */
import { TOOL_CATEGORIES, type ToolCategory, type ToolManifest } from '@/core/tools/types';

/** Lower-case, umlauts as digraphs, other accents dropped: "waehrung", "Währung" and "WÄHRUNG" meet. */
export function fold(text: string): string {
  return text
    .replace(/ä/gi, 'ae')
    .replace(/ö/gi, 'oe')
    .replace(/ü/gi, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export interface ToolGroupOfPanel {
  category: ToolCategory;
  tools: ToolManifest[];
}

/** Tools in panel order: by category (`TOOL_CATEGORIES`), inside a category by manifest order. */
export function orderForPanel(tools: readonly ToolManifest[]): ToolManifest[] {
  const rank = (x: ToolManifest) => TOOL_CATEGORIES.indexOf(x.category);
  return tools
    .map((tool, i) => ({ tool, i }))
    .sort((a, b) => rank(a.tool) - rank(b.tool) || a.i - b.i)
    .map((x) => x.tool);
}

export function groupByCategory(tools: readonly ToolManifest[]): ToolGroupOfPanel[] {
  const groups: ToolGroupOfPanel[] = [];
  for (const tool of orderForPanel(tools)) {
    const last = groups[groups.length - 1];
    if (last?.category === tool.category) last.tools.push(tool);
    else groups.push({ category: tool.category, tools: [tool] });
  }
  return groups;
}

/** Name, keywords and description; every word of the query must be found somewhere. */
export function filterTools(tools: readonly ToolManifest[], query: string): ToolManifest[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...tools];
  return tools.filter((tool) => {
    const hay = fold([tool.name, ...tool.keywords, tool.description].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

/**
 * The tool the panel shows when it opens: the one asked for (palette, `/tools/:id`, chord), else the
 * one used last that is still on (only with "Verlauf in der Suche"), else the first one in the list.
 */
export function pickInitialTool(
  ordered: readonly ToolManifest[],
  requestedId: string | null,
  recentIds: readonly string[],
): ToolManifest | undefined {
  const byId = (id: string | undefined) => ordered.find((x) => x.id === id);
  return byId(requestedId ?? undefined) ?? byId(recentIds[0]) ?? ordered[0];
}

/** Alt+1 … Alt+9 → the n-th tool of the (unfiltered) panel order; `KeyboardEvent.code` of the digit row (the numpad types Windows Alt codes), so layouts do not matter. */
export function toolForDigit(
  ordered: readonly ToolManifest[],
  code: string,
): ToolManifest | undefined {
  const m = /^Digit([1-9])$/.exec(code);
  return m ? ordered[Number(m[1]) - 1] : undefined;
}

/** The step of the arrow keys in the list: wraps, `-1` up, `1` down. */
export function stepIndex(index: number, count: number, dir: -1 | 1): number {
  if (count === 0) return -1;
  return (index + dir + count) % count;
}

/** Where focus goes in the panel: the search field, the tool's own field (`data-autofocus`) or the pane shown. */
export type PanelFocus = 'search' | 'tool' | 'pane';

/**
 * Focus when the panel opens or a tool is picked. Desktop: with no tool asked for, the search (type to find); a tool
 * asked for (palette, chord, `/tool/:id`, Alt+1…9, Enter in the search, a tile from the keyboard) → its own field.
 * Phone: the pane shown (tool or list), never a field, so no on-screen keyboard pops up. A mouse pick on the desktop
 * keeps focus on the tile (`null`: leave it where it is).
 */
export function panelFocus(i: {
  phone: boolean;
  toolAsked: boolean;
  byKeyboard: boolean;
}): PanelFocus | null {
  if (i.phone) return 'pane';
  if (!i.toolAsked) return 'search';
  return i.byKeyboard ? 'tool' : null;
}
