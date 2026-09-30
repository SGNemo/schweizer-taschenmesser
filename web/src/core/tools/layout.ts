import { z } from 'zod';
import type { ToolManifest } from './types';

/** Synced `_settings` scope "tools": explicit on/off choices and the order of the tiles. */
export const toolsSettingsSchema = z.object({
  /** Tool id → on/off. Tools without an entry follow `defaultEnabled`. */
  enabled: z.record(z.string(), z.boolean()),
  /** Tool ids in display order (unknown ids are ignored, new tools go to the end). */
  order: z.array(z.string()),
});

export type ToolsSettings = z.output<typeof toolsSettingsSchema>;
export const TOOLS_SCOPE = 'tools';
export const DEFAULT_TOOLS: ToolsSettings = { enabled: {}, order: [] };

export const isEnabled = (tool: ToolManifest, saved: ToolsSettings): boolean =>
  saved.enabled[tool.id] ?? tool.defaultEnabled;

/** Saved order first (for tools that still exist), everything else by manifest order. */
export function orderTools(tools: readonly ToolManifest[], saved: ToolsSettings): ToolManifest[] {
  const index = new Map(saved.order.map((id, i) => [id, i]));
  return tools
    .map((tool, i) => ({ tool, i }))
    .sort((a, b) => {
      const ia = index.get(a.tool.id);
      const ib = index.get(b.tool.id);
      if (ia !== undefined && ib !== undefined) return ia - ib;
      if (ia !== undefined) return -1;
      if (ib !== undefined) return 1;
      return a.i - b.i;
    })
    .map((x) => x.tool);
}

export const activeTools = (tools: readonly ToolManifest[], saved: ToolsSettings): ToolManifest[] =>
  orderTools(tools, saved).filter((t) => isEnabled(t, saved));

/** Moves `id` one step up or down within the given (ordered) ids; returns the new full order. */
export function moveTool(orderedIds: readonly string[], id: string, dir: -1 | 1): string[] {
  const i = orderedIds.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= orderedIds.length) return [...orderedIds];
  const next = [...orderedIds];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}
