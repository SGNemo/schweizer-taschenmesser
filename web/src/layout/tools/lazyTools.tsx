import { createElement, lazy } from 'react';
import { allTools } from '@/core/tools/registry';
import type { ToolManifest } from '@/core/tools/types';

/** Tool components are code-split and created once, outside of render. */
const lazyTools = new Map(allTools.map((tool) => [tool.id, lazy(tool.component)] as const));

export function ToolBody({ tool }: { tool: ToolManifest }) {
  return createElement(lazyTools.get(tool.id)!);
}
