import { describe, expect, it, vi } from 'vitest';
import { collectAttention, rankAttention } from './contributions';
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
  it('does not cap the list: the overview counts what waits, a cut would make that number wrong', () => {
    const many = Array.from({ length: 20 }, (_, i) => item(`i${i}`, 'warning', i));
    expect(rankAttention(many)).toHaveLength(20);
    // A caller with little room passes its own limit (the "Jetzt" row of a module page).
    expect(rankAttention(many, 2).map((i) => i.id)).toEqual(['i0', 'i1']);
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

describe('AttentionItem contract: due, coveredBy, foldSummary', () => {
  it('takes the three optional fields and keeps them through ranking', () => {
    const today: AttentionItem = {
      ...item('calendar:next', 'accent'),
      due: 'today',
      coveredBy: ['agenda', 'today'],
    };
    const later: AttentionItem = {
      ...item('budgets:warn:b1', 'warning'),
      foldSummary: (n) => `${n} budgets almost used up`,
    };
    const [first, second] = rankAttention([later, today]);
    expect(first).toBe(today);
    expect(first!.due).toBe('today');
    expect(first!.coveredBy).toEqual(['agenda', 'today']);
    expect(second!.foldSummary?.(2)).toBe('2 budgets almost used up');
  });
  it('knows no other value: "due" is today or absent, a cover is the agenda or the "Heute" card', () => {
    // @ts-expect-error – a day other than today is not "due" on the strip
    const tomorrow: AttentionItem = { ...item('x', 'accent'), due: 'tomorrow' };
    // @ts-expect-error – only the two blocks of the overview cover an entry
    const widget: AttentionItem = { ...item('y', 'accent'), coveredBy: ['widget'] };
    // @ts-expect-error – the summary is a function of the count
    const text: AttentionItem = { ...item('z', 'warning'), foldSummary: '2 budgets' };
    expect([tomorrow.id, widget.id, text.id]).toEqual(['x', 'y', 'z']);
  });
  it('the tone does not say "today": an accent entry without due is not due', () => {
    expect(item('vault:act', 'accent').due).toBeUndefined();
  });
});
