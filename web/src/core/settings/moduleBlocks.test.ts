import { describe, expect, it } from 'vitest';
import type { SettingField } from '@/core/modules/types';
import { blockOf, changedKeys, fieldBlocks } from './moduleBlocks';

const f = (key: string, over: Partial<SettingField> = {}): SettingField => ({
  key,
  label: key,
  type: 'boolean',
  ...over,
});

describe('module settings blocks', () => {
  it('puts fields without a group into General and advanced ones into Advanced', () => {
    expect(blockOf(f('a'))).toBe('general');
    expect(blockOf(f('a', { group: 'display' }))).toBe('display');
    expect(blockOf(f('a', { level: 'advanced' }))).toBe('advanced');
    expect(blockOf(f('a', { group: 'display', level: 'advanced' }))).toBe('advanced');
  });

  it('keeps the fixed block order and the field order, and skips empty blocks', () => {
    const blocks = fieldBlocks([
      f('n', { group: 'notifications' }),
      f('g1'),
      f('d', { group: 'display' }),
      f('g2'),
      f('x', { level: 'advanced' }),
    ]);
    expect(blocks.map((b) => [b.group, b.fields.map((x) => x.key)])).toEqual([
      ['general', ['g1', 'g2']],
      ['display', ['d']],
      ['notifications', ['n']],
      ['advanced', ['x']],
    ]);
  });

  it('shows the Data block without fields only when there is start data', () => {
    expect(fieldBlocks([], false)).toEqual([]);
    expect(fieldBlocks([], true).map((b) => b.group)).toEqual(['data']);
  });

  it('lists the fields that differ from their default', () => {
    const fields = [f('a'), f('b'), f('c'), f('d')];
    expect(
      changedKeys(
        fields,
        { a: true, b: 'x', c: [1, 2], d: undefined },
        { a: true, b: 'y', c: [1, 2], d: 0 },
      ),
    ).toEqual(['b', 'd']);
  });
});
