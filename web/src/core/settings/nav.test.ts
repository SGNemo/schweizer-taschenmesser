// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { MAX_FAVOURITES } from '@/core/modules/areas';
import { readFavourites, setFavourite, toggleFavourite } from './nav';

beforeEach(async () => {
  await db.table('_settings').clear();
});

describe('favourites setting', () => {
  it('toggles: adds at the end, removes, refuses a sixth', () => {
    expect(toggleFavourite(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleFavourite(['a', 'b'], 'a')).toEqual(['b']);
    const full = ['a', 'b', 'c', 'd', 'e'];
    expect(full).toHaveLength(MAX_FAVOURITES);
    expect(toggleFavourite(full, 'f')).toEqual(full);
  });

  it('is unset until the user changes it, then stores the visible list plus the change', async () => {
    expect(await readFavourites()).toBeUndefined();
    expect(await setFavourite('notes', ['calendar', 'todos'])).toBe(true);
    expect(await readFavourites()).toEqual(['calendar', 'todos', 'notes']);
    expect(await setFavourite('calendar', ['calendar', 'todos', 'notes'])).toBe(true);
    expect(await readFavourites()).toEqual(['todos', 'notes']);
  });

  it('a refused sixth favourite writes nothing', async () => {
    const five = ['a', 'b', 'c', 'd', 'e'];
    expect(await setFavourite('f', five)).toBe(false);
    expect(await readFavourites()).toBeUndefined();
  });

  it('an empty list is a valid choice (no favourites)', async () => {
    await setFavourite('todos', ['todos']);
    expect(await readFavourites()).toEqual([]);
  });
});
