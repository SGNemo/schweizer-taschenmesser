import { describe, expect, it, vi } from 'vitest';
import type { AttentionItem } from '@/core/modules/types';
import {
  AGENDA_KEY,
  activeCovers,
  coveredIds,
  foldAttention,
  foldPhrases,
  isAgendaVisible,
  neverFolds,
} from './attentionFold';
import { DEFAULT_LAYOUT, type HomeLayout } from './layout';
import weatherAttention from '@/modules/weather/attention';

// The weather source reads its warnings from the cached forecast; here they are given directly.
vi.mock('@/modules/weather/warningsToday', () => ({
  warningsNow: async (today: string) => [
    { kind: 'storm', date: today },
    { kind: 'wind', date: '2026-10-20', value: 80 },
  ],
}));

const item = (
  id: string,
  tone: AttentionItem['tone'],
  extra: Partial<AttentionItem> = {},
): AttentionItem => ({ id, tone, icon: 'alert', title: id, to: '/x', ...extra });
const n = (count: number, make: (i: number) => AttentionItem) =>
  Array.from({ length: count }, (_, i) => make(i));
const today = { due: 'today' } as const;
const layout = (patch: Partial<HomeLayout> = {}): HomeLayout => ({ ...DEFAULT_LAYOUT, ...patch });

describe('foldAttention: danger and due never fold, everything else does', () => {
  it('5 danger + 2 accent without due → 5 cards + "Kann warten · 2"', () => {
    const out = foldAttention(
      [...n(5, (i) => item(`d${i}`, 'danger')), ...n(2, (i) => item(`a${i}`, 'accent'))],
      true,
    );
    expect(out.visible.map((i) => i.id)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4']);
    expect(out.waiting.map((i) => i.id)).toEqual(['a0', 'a1']);
  });
  it('1 danger + 3 accent → 1 card + "Kann warten · 3" (nothing is filled up)', () => {
    const out = foldAttention([item('d', 'danger'), ...n(3, (i) => item(`a${i}`, 'accent'))], true);
    expect(out.visible).toHaveLength(1);
    expect(out.waiting).toHaveLength(3);
  });
  it('5 danger + 2 due → 7 cards, no fold line', () => {
    const out = foldAttention(
      [...n(5, (i) => item(`d${i}`, 'danger')), ...n(2, (i) => item(`t${i}`, 'accent', today))],
      true,
    );
    expect(out.visible).toHaveLength(7);
    expect(out.waiting).toEqual([]);
  });
  it('vault:act-today is a card and never folds; vault:act (1–7 days) folds', () => {
    const out = foldAttention(
      [item('vault:act-today', 'accent', today), item('vault:act', 'warning')],
      true,
    );
    expect(out.visible.map((i) => i.id)).toEqual(['vault:act-today']);
    expect(out.waiting.map((i) => i.id)).toEqual(['vault:act']);
  });
  it('a weather warning for today is a card; the warning for tomorrow folds', async () => {
    const out = foldAttention(await weatherAttention({ today: '2026-10-19' }), true);
    expect(out.visible.map((i) => i.id)).toEqual(['weather:storm:2026-10-19']);
    expect(out.waiting.map((i) => i.id)).toEqual(['weather:wind:2026-10-20']);
  });
  it('the setting "ruhiges Jetzt wichtig" off → every entry is a card', () => {
    const all = [item('d', 'danger'), item('a', 'accent'), item('w', 'warning')];
    expect(foldAttention(all, false)).toEqual({ visible: all, waiting: [] });
  });
  it('the tone alone decides nothing: accent without due folds, warning with due does not', () => {
    expect(neverFolds(item('a', 'accent'))).toBe(false);
    expect(neverFolds(item('w', 'warning', today))).toBe(true);
    expect(neverFolds(item('core:update', 'accent', today))).toBe(true);
  });
  it('counts entries, not things: an entry about 3 documents is one', () => {
    const out = foldAttention([item('vault:expired', 'warning', { title: '3 Dokumente' })], true);
    expect(out.waiting).toHaveLength(1);
  });
  it('shows more than four and more than six cards when that many are overdue or due', () => {
    const out = foldAttention(
      n(9, (i) => item(`d${i}`, 'danger')),
      true,
    );
    expect(out.visible).toHaveLength(9);
  });
});

describe('foldPhrases: at most two phrases in the folded line', () => {
  const budget = (id: string) =>
    item(`budgets:warn:${id}`, 'warning', {
      title: `${id}: 96 % des Budgets verbraucht`,
      foldSummary: (count) => `${count} Budgets fast aufgebraucht`,
    });
  it('counts entries of one kind through their summary, others speak with their title', () => {
    const out = foldPhrases([
      budget('a'),
      budget('b'),
      item('pantry:expired', 'warning', { title: '1 Vorrat abgelaufen' }),
    ]);
    expect(out).toEqual({
      phrases: ['2 Budgets fast aufgebraucht', '1 Vorrat abgelaufen'],
      more: false,
    });
  });
  it('says that more wait than the line names', () => {
    const out = foldPhrases([
      budget('a'),
      item('pantry:expired', 'warning'),
      item('pantry:low', 'warning'),
    ]);
    expect(out.phrases).toHaveLength(2);
    expect(out.more).toBe(true);
  });
  it('counts one summary once, also across two modules ("Abo mit neuem Preis")', () => {
    const price = (id: string) =>
      item(id, 'warning', { foldSummary: (count) => `${count} Abos mit neuem Preis` });
    const out = foldPhrases([
      price('subscriptions:price:1'),
      price('finance:subscription-price:2'),
    ]);
    expect(out.phrases).toEqual(['2 Abos mit neuem Preis']);
  });
  it('is empty for nothing', () => {
    expect(foldPhrases([])).toEqual({ phrases: [], more: false });
  });
});

describe('activeCovers + coveredIds: the strip leaves out what a block on the page lists itself', () => {
  const next = item('calendar:next', 'accent', { ...today, coveredBy: ['agenda', 'today'] });
  const todos = item('todos:today', 'accent', today);
  const invoice = item('invoices:today', 'accent', today);
  const items = [next, todos, invoice];
  const left = (covers: ReturnType<typeof activeCovers>) => [...coveredIds(covers, items)];

  it('calendar:next + agenda on (detailed) → not in the strip', () => {
    expect(activeCovers(layout(), 'all', true)).toEqual(['agenda']);
    expect(left(activeCovers(layout(), 'all', true))).toEqual(['calendar:next']);
  });
  it('calendar:next + agenda off and no "Heute" card → in the strip', () => {
    expect(left(activeCovers(layout({ hidden: [AGENDA_KEY] }), 'all', false))).toEqual([]);
  });
  it('agenda off but the "Heute" card on the page: the card names the appointment, so the strip does not', () => {
    expect(activeCovers(layout({ hidden: [AGENDA_KEY] }), 'all', true)).toEqual(['today']);
    expect(left(activeCovers(layout(), 'calm', true))).toEqual(['calendar:next']);
  });
  it('calm without the "Heute" card (the month card stands in, or the card shows its "off" hint) → nothing covered', () => {
    expect(activeCovers(layout(), 'calm', false)).toEqual([]);
  });
  it('the agenda pinned into the calm view lists the day: the card does not', () => {
    expect(activeCovers(layout({ pinned: [AGENDA_KEY] }), 'calm', true)).toEqual(['agenda']);
  });
  it('an entry without coveredBy is never left out: ToDos due today and invoices stay', () => {
    for (const covers of [['agenda'], ['today']] as const)
      expect(
        coveredIds(covers, items).has('todos:today') ||
          coveredIds(covers, items).has('invoices:today'),
      ).toBe(false);
  });
  it('named price: only visibility is known, not what a block cuts off its list', () => {
    // The "Heute" card may list fewer appointments than the day has; the entry is left out all the same.
    expect(coveredIds(['today'], [next]).has('calendar:next')).toBe(true);
  });
});

describe('isAgendaVisible: "Ruhig" hides the agenda unless it is pinned', () => {
  it('detailed: on unless hidden', () => {
    expect(isAgendaVisible(layout(), 'all')).toBe(true);
    expect(isAgendaVisible(layout({ hidden: [AGENDA_KEY] }), 'all')).toBe(false);
  });
  it('calm: off by default, on when pinned, off again when hidden', () => {
    expect(isAgendaVisible(layout(), 'calm')).toBe(false);
    expect(isAgendaVisible(layout({ pinned: [AGENDA_KEY] }), 'calm')).toBe(true);
    expect(isAgendaVisible(layout({ pinned: [AGENDA_KEY], hidden: [AGENDA_KEY] }), 'calm')).toBe(
      false,
    );
  });
});
