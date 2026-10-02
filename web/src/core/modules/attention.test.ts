import { describe, expect, it, vi } from 'vitest';
import { ATTENTION_LIMIT, collectAttention, rankAttention } from './contributions';
import type { AttentionItem, ModuleManifest } from './types';

const item = (id: string, tone: AttentionItem['tone'], rank?: number): AttentionItem => ({
  id,
  tone,
  icon: 'alert',
  title: id,
  to: '/x',
  rank,
});

describe('rankAttention', () => {
  it('orders danger before accent before warning, then by rank and title', () => {
    const out = rankAttention([
      item('w', 'warning', 1),
      item('a2', 'accent', 2),
      item('d', 'danger', 9),
      item('a1', 'accent', 1),
    ]);
    expect(out.map((i) => i.id)).toEqual(['d', 'a1', 'a2', 'w']);
  });
  it('caps the list', () => {
    const many = Array.from({ length: 20 }, (_, i) => item(`i${i}`, 'warning', i));
    expect(rankAttention(many)).toHaveLength(ATTENTION_LIMIT);
  });
  it('is empty for nothing', () => {
    expect(rankAttention([])).toEqual([]);
  });
});

describe('collectAttention', () => {
  const manifest = (
    id: string,
    load?: () => Promise<{ default: () => Promise<AttentionItem[]> }>,
  ) => ({ id, contributions: load ? { attention: load } : {} }) as unknown as ModuleManifest;

  it('merges modules, skips those without a source and survives a failing one', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await collectAttention('2026-09-29', [
      manifest('a', async () => ({ default: async () => [item('late', 'danger')] })),
      manifest('b'),
      manifest('c', async () => ({
        default: async () => {
          throw new Error('boom');
        },
      })),
    ]);
    expect(out.map((i) => i.id)).toEqual(['late']);
    spy.mockRestore();
  });
  it('hands the day to the source', async () => {
    const source = vi.fn(async () => []);
    await collectAttention('2026-09-29', [manifest('a', async () => ({ default: source }))]);
    expect(source).toHaveBeenCalledWith({ today: '2026-09-29' });
  });
});
