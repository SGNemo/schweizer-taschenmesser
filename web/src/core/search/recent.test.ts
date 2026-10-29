// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { addRecent, clearRecent, MAX_RECENT, readRecent } from './recent';

beforeEach(() => localStorage.clear());

describe('recent searches', () => {
  it('keeps the newest first without duplicates and caps the list', () => {
    for (let i = 0; i < MAX_RECENT + 3; i++)
      addRecent({ kind: 'hit', key: `q-${i}`, label: `Treffer ${i}` });
    addRecent({ kind: 'hit', key: 'q-5', label: 'Treffer 5' });
    const list = readRecent();
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]!.key).toBe('q-5');
    expect(list.filter((e) => e.key === 'q-5')).toHaveLength(1);
  });

  it('drops typed questions of older versions from storage on read', () => {
    localStorage.setItem(
      'tm-recent-search',
      JSON.stringify([
        { kind: 'query', key: 'q-x', label: 'mein passwort ist hunter2' },
        { kind: 'command', key: 'settings', label: 'Einstellungen' },
      ]),
    );
    expect(readRecent().map((e) => e.key)).toEqual(['settings']);
    expect(localStorage.getItem('tm-recent-search')).not.toContain('hunter2');
  });

  it('can be cleared and survives broken storage', () => {
    addRecent({ kind: 'command', key: 'settings', label: 'Einstellungen' });
    clearRecent();
    expect(readRecent()).toEqual([]);
    localStorage.setItem('tm-recent-search', '{"nope":true}');
    expect(readRecent()).toEqual([]);
    localStorage.setItem('tm-recent-search', '[{"kind":"x","key":1}]');
    expect(readRecent()).toEqual([]);
  });
});
