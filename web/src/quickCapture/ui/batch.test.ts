import { describe, expect, it } from 'vitest';
import { batchRow, batchTypes, withoutPart } from './batch';

const plain = (s: string) => s.replace(/\s/g, ' ');

describe('batchRow – a batch never books', () => {
  it('a booking becomes a ToDo with the amount and the chip', () => {
    const r = batchRow('finance', { title: 'Brot', amountMinor: 380, kind: 'expense' }, [
      'todo',
      'finance',
    ]);
    expect(r.type).toBe('todo');
    expect(plain(r.fields.title)).toBe('Brot · 3,80 €');
    expect(r.booking).toBe('expense');
  });

  it('finance off and ToDo picked by hand: the amount stays in the title, no chip', () => {
    const r = batchRow('todo', { title: 'Brot', amountMinor: 380 }, ['todo'], 'finance');
    expect(plain(r.fields.title)).toBe('Brot · 3,80 €');
    expect(r.booking).toBeUndefined();
  });

  it('the line as typed (inbox fallback) keeps its title, no doubled amount', () => {
    const r = batchRow(
      'todo',
      { title: 'Brot 3,80 €', amountMinor: 380 },
      ['todo', 'finance'],
      'finance',
      true,
    );
    expect(r.fields.title).toBe('Brot 3,80 €');
  });

  it('the batch target list has no booking target', () => {
    expect(batchTypes(['todo', 'finance', 'event'])).toEqual(['todo', 'event']);
  });
});

describe('withoutPart', () => {
  it('removes the whole line first, never a piece of another line', () => {
    expect(withoutPart('Flughafenbus 2,50 € zahlen\nBus 2,50 €', 'Bus 2,50 €')).toBe(
      'Flughafenbus 2,50 € zahlen',
    );
  });
});
