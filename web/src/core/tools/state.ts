import { useSettings } from '@/core/settings/settings';
import { useUiStore } from '@/stores/ui';
import { allTools } from './registry';
import {
  activeTools,
  DEFAULT_TOOLS,
  migrateToolIds,
  moveTool,
  orderTools,
  toolsSettingsSchema,
  TOOLS_SCOPE,
  type ToolsSettings,
} from './layout';
import type { ToolManifest } from './types';

/** What the maturity filter for tools looks at. */
export interface ToolMaturityContext {
  /** "In Arbeit anzeigen" (`stores/ui.ts`). */
  showPreview: boolean;
  /** The saved choices: an explicit "on" keeps a preview tool listed. */
  saved: ToolsSettings;
}

/**
 * The one maturity rule for tools: a `preview` tool is listed only while "In Arbeit anzeigen" is
 * on or the user switched it on explicitly (`saved.enabled[id] === true`; `defaultEnabled` alone
 * is not a user choice). Hides in the toolbox, library, palette and settings; `allTools` and the
 * saved choices are never touched.
 */
export function isVisible(tool: ToolManifest, ctx: ToolMaturityContext): boolean {
  return tool.maturity !== 'preview' || ctx.showPreview || ctx.saved.enabled[tool.id] === true;
}

/** `allTools` without the preview tools the context hides, in manifest order. */
export const visibleTools = (ctx: ToolMaturityContext): ToolManifest[] =>
  allTools.filter((tool) => isVisible(tool, ctx));

export interface ToolsState {
  /** Everything listed right now (preview tools only with "In Arbeit anzeigen" or when on), in the saved order. */
  all: ToolManifest[];
  /** Only the enabled ones among `all`, in order (the toolbar). */
  active: ToolManifest[];
  saved: ToolsSettings;
  setEnabled(id: string, on: boolean): Promise<void>;
  move(id: string, dir: -1 | 1): Promise<void>;
  /** Saves a complete new order (drag and drop). */
  reorder(order: string[]): Promise<void>;
}

export function useTools(): ToolsState | undefined {
  const [stored, patch] = useSettings(TOOLS_SCOPE, toolsSettingsSchema, DEFAULT_TOOLS);
  const showPreview = useUiStore((s) => s.showPreview);
  if (!stored) return undefined;
  const values = migrateToolIds(stored);
  const listed = visibleTools({ showPreview, saved: values });
  const all = orderTools(listed, values);
  return {
    all,
    active: activeTools(listed, values),
    saved: values,
    setEnabled: (id, on) => patch({ enabled: { ...values.enabled, [id]: on } }),
    reorder: (order) => patch({ order }),
    move: (id, dir) =>
      patch({
        order: moveTool(
          all.map((t) => t.id),
          id,
          dir,
        ),
      }),
  };
}
