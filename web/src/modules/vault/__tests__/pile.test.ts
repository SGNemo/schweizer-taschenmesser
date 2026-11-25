/**
 * Document deadlines as a part of „Finanzen checken“ (planner hub 2, package 2): the same rows the module hands the
 * plan, within 14 days, by key only – never a document's title or content; never the password vault (`accounts`).
 */
import { describe, expect, it, vi } from 'vitest';
import source, { PILE_DAYS } from '../pile';

const listed = vi.hoisted(() => ({ until: '' }));
vi.mock('../plannable', () => ({
  default: {
    list: async (ctx: { until: string }) => {
      listed.until = ctx.until;
      return [
        { id: 'd1:cancel:2026-12-05', kind: 'cancel', title: 'Vertrag kündigen', to: '/vault' },
      ];
    },
  },
}));

describe('the document deadlines part', () => {
  it(`asks for ${PILE_DAYS} days at most and names the rows by key`, async () => {
    const [part] = await source({ today: '2026-11-30', until: '2027-01-30' });
    expect(listed.until).toBe('2026-12-14');
    expect(part).toMatchObject({ area: 'money', count: 0, to: '/vault' });
    expect(part?.members).toEqual(['vault:d1:cancel:2026-12-05']);
    expect(JSON.stringify(part)).not.toMatch(/Vertrag/);
  });
});
