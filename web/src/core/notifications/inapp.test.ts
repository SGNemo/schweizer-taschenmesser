import { beforeEach, describe, expect, it } from 'vitest';
import { useReminderPrompts } from './inapp';

beforeEach(() => useReminderPrompts.setState({ items: [] }));

describe('in-app reminder cards', () => {
  it('a repeat replaces the card of the same reminder instead of stacking', () => {
    const { push } = useReminderPrompts.getState();
    push({ key: 'event:a:d', title: 'A' });
    push({ key: 'event:b:d', title: 'B' });
    push({ key: 'event:a:d:r1', title: 'Noch offen: A' });
    expect(useReminderPrompts.getState().items.map((i) => i.key)).toEqual([
      'event:b:d',
      'event:a:d:r1',
    ]);
  });

  it('the same key twice is shown once', () => {
    const { push } = useReminderPrompts.getState();
    push({ key: 'x', title: 'X' });
    push({ key: 'x', title: 'X' });
    expect(useReminderPrompts.getState().items).toHaveLength(1);
  });
});
