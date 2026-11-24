import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import target from '../linkTarget';
import { itemRepo } from '../repo';

/** Planner hub 2, 10a (CONCEPT §1.3): a Merkliste entry is a link target – its title, never its URL. */
const URL = 'https://example.org/geheimer-pfad?token=abc';
const add = (over: Record<string, unknown> = {}) =>
  itemRepo.create({
    title: 'Dune',
    kind: 'watch',
    url: URL,
    tags: [],
    done: false,
    started: false,
    ...over,
  } as never);

beforeEach(async () => {
  await db.table('bookmarks_item').clear();
});

describe('bookmarks as a link target', () => {
  it('alive: the title and its route, never the URL; `done` is its own „Erledigt“', async () => {
    const open = await add();
    const state = await target.resolve(open.id);
    expect(state).toEqual({
      state: 'alive',
      title: 'Dune',
      to: `/bookmarks?open=${open.id}`,
      done: false,
    });
    expect(JSON.stringify(state)).not.toContain('example.org');
    const done = await add({ done: true });
    expect(await target.resolve(done.id)).toMatchObject({ state: 'alive', done: true });
  });

  it('an untitled import (its title is the URL) reads as its kind, never the address', async () => {
    const i = await add({ title: URL });
    expect(await target.resolve(i.id)).toMatchObject({ state: 'alive', title: 'Film/Serie' });
  });

  it('a hostile id of a stored row is encoded in the route', async () => {
    const i = await itemRepo.create(
      { title: 'Dune', kind: 'watch', tags: [], done: false, started: false } as never,
      { id: 'a&do=x/../c' },
    );
    expect(await target.resolve(i.id)).toMatchObject({
      to: `/bookmarks?open=${encodeURIComponent('a&do=x/../c')}`,
    });
  });

  it('gone: soft-deleted, never here, malformed', async () => {
    const i = await add();
    await itemRepo.remove(i.id);
    expect(await target.resolve(i.id)).toEqual({ state: 'gone' });
    for (const id of ['nope', '', '1&x=y'])
      expect(await target.resolve(id)).toEqual({ state: 'gone' });
  });
});
