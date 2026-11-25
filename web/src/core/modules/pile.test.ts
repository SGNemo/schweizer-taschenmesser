/**
 * Collective rows (planner hub 2, package 2, hand-off 02 „Tests“): which things fold into a pile and what it counts.
 */
import { describe, expect, it } from 'vitest';
import type { PlannableEntry } from './contributions';
import { foldPiles, PILE_MAX, type PileEntry } from './pile';

const entry = (
  moduleId: string,
  id: string,
  over: Partial<PlannableEntry> = {},
): PlannableEntry => ({
  moduleId,
  id,
  kind: 'x',
  title: id,
  to: `/${moduleId}`,
  ...over,
});
const part = (moduleId: string, over: Partial<PileEntry> = {}): PileEntry => ({
  moduleId,
  area: 'money',
  id: moduleId,
  count: 0,
  label: (n) => `${n}`,
  head: moduleId,
  to: `/${moduleId}?view=open`,
  ...over,
});
const ON = { areas: new Set(['money', 'mail'] as const), held: new Set<string>() };

describe('foldPiles', () => {
  it('folds the unplaced, unlocked members and counts them', () => {
    const { groups, folded } = foldPiles(
      [part('invoices', { members: ['invoices:a', 'invoices:b'] })],
      [entry('invoices', 'a'), entry('invoices', 'b')],
      ON,
    );
    expect([...folded.keys()]).toEqual(['invoices:a', 'invoices:b']);
    expect(groups.get('money')).toMatchObject({ count: 2, alive: true });
  });

  it('a member with a day or a lock of its own stays a single row and is not counted', () => {
    const { groups, folded } = foldPiles(
      [part('invoices', { members: ['invoices:a', 'invoices:b'] })],
      [entry('invoices', 'a'), entry('invoices', 'b')],
      { ...ON, held: new Set(['invoices:b']) },
    );
    expect([...folded.keys()]).toEqual(['invoices:a']);
    expect(groups.get('money')?.count).toBe(1);
  });

  it('nothing to do: no members and no count – not alive (an unplaced pile is no row)', () => {
    const { groups } = foldPiles([part('invoices', { members: [] })], [], ON);
    expect(groups.get('money')).toMatchObject({ count: 0, alive: false });
  });

  it('read-only parts (budgets) never keep a pile alive', () => {
    const { groups } = foldPiles([part('budgets', { count: 2, readOnly: true })], [], ON);
    expect(groups.get('money')).toMatchObject({ count: 0, alive: false });
  });

  it('a count without members (the mail queue) keeps the pile alive', () => {
    const { groups } = foldPiles([part('mail', { area: 'mail', count: 4 })], [], ON);
    expect(groups.get('mail')).toMatchObject({ count: 4, alive: true });
  });

  it('drops a member key of another module, keeps a mail ToDo with an origin link to a thread', () => {
    const origin = (module: string) => ({
      links: [{ to: { module, id: 't1' }, rel: 'origin' as const, label: 'Mail' }],
    });
    const { folded } = foldPiles(
      [
        part('invoices', { members: ['todos:x', 'invoices:a'] }),
        part('mail', { area: 'mail', members: ['todos:m', 'todos:plain', 'todos:fromNote'] }),
      ],
      [
        entry('todos', 'x', origin('mail')),
        entry('invoices', 'a'),
        entry('todos', 'm', origin('mail')),
        entry('todos', 'plain'),
        entry('todos', 'fromNote', origin('notes')),
      ],
      ON,
    );
    expect([...folded.entries()]).toEqual([
      ['invoices:a', 'money'],
      ['todos:m', 'mail'],
    ]);
  });

  it('never `accounts`: neither its part nor a member key of it', () => {
    const { groups, folded } = foldPiles(
      [
        part('accounts', { members: ['accounts:a'], count: 3 }),
        part('invoices', { members: ['accounts:a'] }),
      ],
      [entry('accounts', 'a')],
      ON,
    );
    expect(folded.size).toBe(0);
    expect(groups.get('money')?.count).toBe(0);
  });

  it(`at most ${PILE_MAX} members: 45 → 5 stay single rows, the count says 40`, () => {
    const ids = Array.from({ length: 45 }, (_, i) => `i${i}`);
    const { groups, folded } = foldPiles(
      [part('invoices', { members: ids.map((i) => `invoices:${i}`) })],
      ids.map((i) => entry('invoices', i)),
      ON,
    );
    expect(folded.size).toBe(40);
    expect(groups.get('money')?.count).toBe(40);
    expect(ids.filter((i) => !folded.has(`invoices:${i}`))).toHaveLength(5);
  });

  it('an area that is switched off folds nothing; a done thing and a missing key never fold', () => {
    const off = foldPiles(
      [part('invoices', { members: ['invoices:a'] })],
      [entry('invoices', 'a')],
      {
        ...ON,
        areas: new Set(['mail'] as const),
      },
    );
    expect(off.folded.size).toBe(0);
    expect(off.groups.has('money')).toBe(false);
    const { folded } = foldPiles(
      [part('invoices', { members: ['invoices:a', 'invoices:gone'] })],
      [entry('invoices', 'a', { done: true })],
      ON,
    );
    expect(folded.size).toBe(0);
  });

  it('the earliest hard deadline of the folded members and the parts', () => {
    const { groups } = foldPiles(
      [
        part('invoices', { members: ['invoices:a', 'invoices:b'] }),
        part('subscriptions', { members: [], due: '2026-12-09' }),
      ],
      [
        entry('invoices', 'a', { due: { date: '2026-12-10', hard: true } }),
        entry('invoices', 'b', { due: { date: '2026-12-04', hard: true } }),
      ],
      ON,
    );
    expect(groups.get('money')?.due).toBe('2026-12-04');
  });
});
