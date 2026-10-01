import { describe, expect, it } from 'vitest';
import { allTools } from './registry';
import {
  activeTools,
  DEFAULT_TOOLS,
  isEnabled,
  LEGACY_TOOL_IDS,
  migrateToolIds,
  moveTool,
  orderTools,
  toolsSettingsSchema,
} from './layout';

describe('tool registry', () => {
  it('discovers all tools with unique ids and orders', () => {
    const ids = allTools.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(allTools.map((x) => x.order)).size).toBe(allTools.length);
    expect(ids).toHaveLength(12);
    expect(ids).toEqual(expect.arrayContaining(['calc', 'dev', 'currency', 'timer', 'qr']));
    for (const gone of Object.keys(LEGACY_TOOL_IDS)) expect(ids).not.toContain(gone);
    for (const tool of allTools) {
      expect(tool.id, tool.id).toMatch(/^[a-z0-9]+$/);
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('turns on the everyday tools and leaves the rest to the library', () => {
    const on = activeTools(allTools, DEFAULT_TOOLS).map((x) => x.id);
    expect(on).toEqual(['calc', 'currency', 'timer', 'qr']);
    expect(allTools.filter((x) => x.group === 'dev').every((x) => !x.defaultEnabled)).toBe(true);
  });

  it('only the currency tool needs the network', () => {
    expect(allTools.filter((x) => !x.offline).map((x) => x.id)).toEqual(['currency']);
  });
});

describe('tool layout', () => {
  const settings = (enabled: Record<string, boolean>, order: string[] = []) =>
    toolsSettingsSchema.parse({ enabled, order });

  it('explicit choices beat the default', () => {
    const calc = allTools.find((x) => x.id === 'calc')!;
    const dice = allTools.find((x) => x.id === 'dice')!;
    expect(isEnabled(calc, settings({ calc: false }))).toBe(false);
    expect(isEnabled(dice, settings({ dice: true }))).toBe(true);
  });

  it('saved order first, unknown ids ignored, new tools at the end', () => {
    const ids = orderTools(allTools, settings({}, ['qr', 'gone', 'calc'])).map((x) => x.id);
    expect(ids.slice(0, 2)).toEqual(['qr', 'calc']);
    expect(ids).toHaveLength(allTools.length);
    expect(ids).not.toContain('gone');
  });

  it('moves one step and stays inside the list', () => {
    expect(moveTool(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveTool(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveTool(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(moveTool(['a', 'b', 'c'], 'x', 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('tool id migration', () => {
  const settings = (enabled: Record<string, boolean>, order: string[] = []) =>
    toolsSettingsSchema.parse({ enabled, order });

  it('leaves current settings untouched', () => {
    const saved = settings({ qr: false }, ['qr', 'calc']);
    expect(migrateToolIds(saved)).toBe(saved);
  });

  it('maps removed ids to their successors, drops scratch, dedupes the order', () => {
    const out = migrateToolIds(
      settings({ percent: true, split: false, base64: true, scratch: true, qr: false }, [
        'calc',
        'scratch',
        'percent',
        'hash',
        'qr',
        'base64',
        'split',
      ]),
    );
    expect(out.enabled).toEqual({ qr: false, calc: true, dev: true });
    expect(out.order).toEqual(['calc', 'dev', 'qr']);
  });

  it('an explicit choice for the new id wins; an old "off" stays off', () => {
    expect(migrateToolIds(settings({ calc: false, percent: true })).enabled).toEqual({
      calc: false,
    });
    expect(migrateToolIds(settings({ hash: false })).enabled).toEqual({ dev: false });
  });
});
