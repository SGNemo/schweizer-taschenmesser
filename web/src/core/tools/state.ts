import { useSettings } from '@/core/settings/settings';
import { allTools } from './registry';
import {
  activeTools,
  DEFAULT_TOOLS,
  moveTool,
  orderTools,
  toolsSettingsSchema,
  TOOLS_SCOPE,
  type ToolsSettings,
} from './layout';
import type { ToolManifest } from './types';

export interface ToolsState {
  /** Everything, in the saved order. */
  all: ToolManifest[];
  /** Only the enabled ones, in order (the toolbar). */
  active: ToolManifest[];
  saved: ToolsSettings;
  setEnabled(id: string, on: boolean): Promise<void>;
  move(id: string, dir: -1 | 1): Promise<void>;
}

export function useTools(): ToolsState | undefined {
  const [values, patch] = useSettings(TOOLS_SCOPE, toolsSettingsSchema, DEFAULT_TOOLS);
  if (!values) return undefined;
  const all = orderTools(allTools, values);
  return {
    all,
    active: activeTools(allTools, values),
    saved: values,
    setEnabled: (id, on) => patch({ enabled: { ...values.enabled, [id]: on } }),
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
