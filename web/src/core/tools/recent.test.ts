// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearRecent } from '@/core/search/recent';
import { MAX_RECENT_TOOLS, readRecentTools, recordToolUse } from './recent';

beforeEach(() => localStorage.clear());

describe('recently used tools', () => {
  it('keeps the newest first without duplicates and caps the list', () => {
    for (const id of ['a', 'b', 'c', 'a', 'd']) recordToolUse(id);
    expect(readRecentTools()).toEqual(['d', 'a', 'c']);
    expect(readRecentTools()).toHaveLength(MAX_RECENT_TOOLS);
  });

  it('stays on the device, is emptied with the search history and survives broken storage', () => {
    recordToolUse('a');
    expect(Object.keys(localStorage)).toEqual(['tm-tools-recent']);
    clearRecent();
    expect(readRecentTools()).toEqual([]);
    localStorage.setItem('tm-tools-recent', '{nope');
    expect(readRecentTools()).toEqual([]);
  });
});
