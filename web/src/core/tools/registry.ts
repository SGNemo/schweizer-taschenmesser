import type { ToolManifest } from './types';

// Tools are discovered like modules: `src/tools/<id>/manifest.ts` default-exports the manifest.
const found = import.meta.glob<{ default: ToolManifest }>('../../tools/*/manifest.ts', {
  eager: true,
});

export const allTools: readonly ToolManifest[] = Object.values(found)
  .map((m) => m.default)
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
