import { describe, expect, it } from 'vitest';
import { t } from '@/strings';
import { CATEGORY_COUNT, categoryColor, categoryIndex, MEANINGS } from './semantics';

describe('colour semantics', () => {
  it('every coloured meaning has a text label, and urgent ones also an icon', () => {
    for (const [id, spec] of Object.entries(MEANINGS)) {
      expect(t.meanings[spec.label], id).toBeTruthy();
      if (spec.calm) expect(spec.icon, `${id} needs an icon`).toBeTruthy();
    }
  });

  it('only overdue and today keep colour in the calm mode', () => {
    expect(
      Object.entries(MEANINGS)
        .filter(([, s]) => s.calm)
        .map(([id]) => id),
    ).toEqual(['overdue', 'today']);
  });

  it('red is reserved for overdue and expenses', () => {
    const red = Object.entries(MEANINGS).filter(([, s]) => s.color === 'var(--danger)');
    expect(red.map(([id]) => id).sort()).toEqual(['expense', 'overdue']);
  });

  it('category colours come from the fixed palette and are stable per name', () => {
    expect(categoryColor(0)).toBe('var(--cat-1)');
    expect(categoryColor(CATEGORY_COUNT)).toBe('var(--cat-1)');
    expect(categoryIndex('Wohnen')).toBe(categoryIndex('Wohnen'));
    for (const n of ['Wohnen', 'Essen', 'Freizeit', 'Gehalt'])
      expect(categoryIndex(n)).toBeLessThan(CATEGORY_COUNT);
  });
});
