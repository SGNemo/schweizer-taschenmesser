import { describe, expect, it } from 'vitest';
import type { ToolManifest } from '@/core/tools/types';
import {
  filterTools,
  fold,
  groupByCategory,
  orderForPanel,
  panelFocus,
  pickInitialTool,
  stepIndex,
  toolForDigit,
} from './panelLogic';

const mk = (id: string, category: ToolManifest['category'], extra: Partial<ToolManifest> = {}) =>
  ({
    id,
    name: id.toUpperCase(),
    description: `desc of ${id}`,
    keywords: [],
    category,
    ...extra,
  }) as ToolManifest;

const tools = [
  mk('timer', 'zeit'),
  mk('calc', 'rechnen', { name: 'Rechner', keywords: ['Taschenrechner', 'Prozent'] }),
  mk('currency', 'rechnen', { name: 'Währung', keywords: ['Wechselkurs'] }),
  mk('dev', 'entwickler'),
];

describe('panel order and groups', () => {
  it('sorts by category, keeps manifest order inside it', () => {
    expect(orderForPanel(tools).map((x) => x.id)).toEqual(['calc', 'currency', 'timer', 'dev']);
    expect(groupByCategory(tools).map((g) => [g.category, g.tools.length])).toEqual([
      ['rechnen', 2],
      ['zeit', 1],
      ['entwickler', 1],
    ]);
  });
});

describe('filterTools', () => {
  it('matches name, keyword and description, ignoring case and accents', () => {
    expect(filterTools(tools, 'waehrung').map((x) => x.id)).toEqual(['currency']);
    expect(filterTools(tools, 'WÄHRUNG').map((x) => x.id)).toEqual(['currency']);
    expect(filterTools(tools, 'prozent').map((x) => x.id)).toEqual(['calc']);
    expect(filterTools(tools, 'desc of timer').map((x) => x.id)).toEqual(['timer']);
  });
  it('needs every word, and an empty query keeps everything', () => {
    expect(filterTools(tools, 'rechner prozent')).toHaveLength(1);
    expect(filterTools(tools, 'rechner wechselkurs')).toHaveLength(0);
    expect(filterTools(tools, '  ')).toHaveLength(4);
  });
  it('folds', () => {
    expect(fold('Größe Ärger')).toBe('groesse aerger');
  });
});

describe('pickInitialTool', () => {
  const ordered = orderForPanel(tools);
  it('prefers the request, then the last used, then the first', () => {
    expect(pickInitialTool(ordered, 'timer', ['dev'])?.id).toBe('timer');
    expect(pickInitialTool(ordered, null, ['dev', 'timer'])?.id).toBe('dev');
    expect(pickInitialTool(ordered, null, [])?.id).toBe('calc');
  });
  it('ignores ids that are not on and survives an empty list', () => {
    expect(pickInitialTool(ordered, 'gone', ['gone2'])?.id).toBe('calc');
    expect(pickInitialTool([], null, ['dev'])).toBeUndefined();
  });
});

describe('toolForDigit and stepIndex', () => {
  const ordered = orderForPanel(tools);
  it('maps Alt+1…9 to the n-th tool', () => {
    expect(toolForDigit(ordered, 'Digit1')?.id).toBe('calc');
    expect(toolForDigit(ordered, 'Numpad3')).toBeUndefined();
    expect(toolForDigit(ordered, 'Digit3')?.id).toBe('timer');
    expect(toolForDigit(ordered, 'Digit9')).toBeUndefined();
    expect(toolForDigit(ordered, 'Digit0')).toBeUndefined();
    expect(toolForDigit(ordered, 'KeyA')).toBeUndefined();
  });
  it('wraps the arrow keys', () => {
    expect(stepIndex(0, 3, -1)).toBe(2);
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 0, 1)).toBe(-1);
  });
});

describe('focus in the panel', () => {
  it('desktop: the search when no tool was asked for, else the tool from the keyboard', () => {
    expect(panelFocus({ phone: false, toolAsked: false, byKeyboard: true })).toBe('search');
    expect(panelFocus({ phone: false, toolAsked: false, byKeyboard: false })).toBe('search');
    expect(panelFocus({ phone: false, toolAsked: true, byKeyboard: true })).toBe('tool');
  });
  it('desktop: a mouse pick leaves focus on the tile', () => {
    expect(panelFocus({ phone: false, toolAsked: true, byKeyboard: false })).toBeNull();
  });
  it('phone: always the pane shown, never a field (no on-screen keyboard)', () => {
    for (const toolAsked of [false, true])
      for (const byKeyboard of [false, true])
        expect(panelFocus({ phone: true, toolAsked, byKeyboard })).toBe('pane');
  });
});
