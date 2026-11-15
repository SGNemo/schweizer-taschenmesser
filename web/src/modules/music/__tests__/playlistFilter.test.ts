// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Playlist } from '@/core/connectors/types';
import { VIEW_KEY, readView, selectPlaylists, writeView } from '../playlistFilter';

const P = (id: string, name: string, ownerId?: string, trackCount?: number): Playlist => ({
  id,
  name,
  ownerId,
  trackCount,
});
const LISTS = [P('a', 'Zürich', 'me', 5), P('b', 'äpfel', 'x', 9), P('c', 'Berg', undefined, 9)];

beforeEach(() => localStorage.clear());

describe('selectPlaylists', () => {
  it('without a known account nothing counts as own', () => {
    expect(selectPlaylists(LISTS, { filter: 'own', sort: 'spotify' }, '', undefined)).toEqual([]);
    expect(
      selectPlaylists(LISTS, { filter: 'followed', sort: 'spotify' }, '', undefined),
    ).toHaveLength(3);
  });

  it('keeps Spotify order, sorts by name (language-aware) or by count (ties by name)', () => {
    const ids = (sort: 'spotify' | 'name' | 'count') =>
      selectPlaylists(LISTS, { filter: 'all', sort }, '', 'me').map((p) => p.id);
    expect(ids('spotify')).toEqual(['a', 'b', 'c']);
    expect(ids('name')).toEqual(['b', 'c', 'a']);
    expect(ids('count')).toEqual(['b', 'c', 'a']);
  });

  it('never changes the list it was given', () => {
    const before = LISTS.map((p) => p.id);
    selectPlaylists(LISTS, { filter: 'all', sort: 'name' }, 'e', 'me');
    expect(LISTS.map((p) => p.id)).toEqual(before);
  });
});

describe('the stored view', () => {
  it('reads unknown or broken values as the default and stores nothing for the default', () => {
    localStorage.setItem(VIEW_KEY, '{"filter":"mine","sort":7}');
    expect(readView()).toEqual({ filter: 'all', sort: 'spotify' });
    localStorage.setItem(VIEW_KEY, 'not json');
    expect(readView()).toEqual({ filter: 'all', sort: 'spotify' });
    writeView({ filter: 'all', sort: 'spotify' });
    expect(localStorage.getItem(VIEW_KEY)).toBeNull();
    writeView({ filter: 'own', sort: 'name' });
    expect(readView()).toEqual({ filter: 'own', sort: 'name' });
  });
});
