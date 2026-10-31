import { describe, expect, it } from 'vitest';
import { DEFAULT_TOOLS, toolsSettingsSchema, type ToolsSettings } from './layout';
import { allTools } from './registry';
import { isVisible, visibleTools } from './state';
import type { ToolManifest } from './types';

const tool = (over: Partial<ToolManifest>): ToolManifest => ({
  id: 'x',
  name: 'X',
  icon: 'wrench',
  description: 'A tool for the tests',
  group: 'extra',
  offline: true,
  defaultEnabled: false,
  maturity: 'stable',
  order: 999,
  component: () => Promise.resolve({ default: () => null }),
  ...over,
});
const saved = (enabled: Record<string, boolean>): ToolsSettings =>
  toolsSettingsSchema.parse({ enabled, order: [] });

describe('tool visibility filter', () => {
  it('stable tools are always listed; preview tools only with the switch or an explicit "on"', () => {
    const stable = tool({});
    const preview = tool({ maturity: 'preview' });
    for (const showPreview of [false, true])
      for (const on of [undefined, false, true]) {
        const ctx = { showPreview, saved: saved(on === undefined ? {} : { x: on }) };
        expect(isVisible(stable, ctx)).toBe(true);
        expect(isVisible(preview, ctx), JSON.stringify({ showPreview, on })).toBe(
          showPreview || on === true,
        );
      }
  });

  it('defaultEnabled alone is not a user choice: a preview tool that is on by default stays hidden', () => {
    const preview = tool({ maturity: 'preview', defaultEnabled: true });
    expect(isVisible(preview, { showPreview: false, saved: DEFAULT_TOOLS })).toBe(false);
    expect(isVisible(preview, { showPreview: true, saved: DEFAULT_TOOLS })).toBe(true);
  });

  it('visibleTools narrows allTools without touching it', () => {
    const before = allTools.map((x) => x.id);
    const listed = visibleTools({ showPreview: false, saved: DEFAULT_TOOLS });
    expect(listed.every((x) => allTools.includes(x))).toBe(true);
    expect(visibleTools({ showPreview: true, saved: DEFAULT_TOOLS })).toEqual([...allTools]);
    expect(allTools.map((x) => x.id)).toEqual(before);
  });

  it('every tool names a maturity', () => {
    for (const x of allTools) expect(['stable', 'preview'], x.id).toContain(x.maturity);
  });
});
