import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest, visibleManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { saveCapture } from './index';
import { knownShoppingNames, nameKey } from './lookup';

// Planner hub 2, package 3: the name lookup the planner's field reads. Invented data.
const ON = { pantry: true, lists: true, todos: true };

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 30, 9, 0).getTime());
  for (const m of visibleManifests)
    for (const c of Object.keys(m.dataSchema.collections)) await db.table(`${m.id}_${c}`).clear();
});

const repo = (module: string, collection: string) =>
  createCollectionRepo(getManifest(module)!, collection);

async function seed() {
  await repo('pantry', 'item').createMany([
    { id: 'p1', data: { name: 'Milch', place: 'fridge', count: 1 } },
    { id: 'p2', data: { name: '  Batterien   AA ', place: 'other', count: 4 } },
  ]);
  await repo('lists', 'list').createMany([
    { id: 'shop', data: { name: 'Einkauf', kind: 'shopping' } },
    { id: 'pack', data: { name: 'Urlaub', kind: 'packing' } },
  ]);
  await repo('lists', 'item').createMany([
    { id: 'i1', data: { listId: 'shop', name: 'Spülmittel', done: true } },
    { id: 'i2', data: { listId: 'pack', name: 'Sonnencreme' } },
  ]);
}

describe('knownShoppingNames', () => {
  it('exact and case-blind: pantry names and shopping-list names, bought ones too', async () => {
    await seed();
    const known = await knownShoppingNames({ states: ON });
    expect(known.has(nameKey('milch'))).toBe(true);
    expect(known.has(nameKey('MILCH '))).toBe(true);
    expect(known.has(nameKey('Batterien AA'))).toBe(true);
    expect(known.has(nameKey('spülmittel'))).toBe(true);
  });

  it('a near miss is no hit: no prefix, no plural, no packing list', async () => {
    await seed();
    const known = await knownShoppingNames({ states: ON });
    for (const near of ['Milc', 'Milch kaufen', 'Batterien', 'Spülmittels', 'Sonnencreme'])
      expect(known.has(nameKey(near)), near).toBe(false);
  });

  it('nothing from a module that is off; a deleted entry is forgotten', async () => {
    await seed();
    const noPantry = await knownShoppingNames({ states: { ...ON, pantry: false } });
    expect(noPantry.has('milch')).toBe(false);
    expect(noPantry.has('spülmittel')).toBe(true);
    const noLists = await knownShoppingNames({ states: { ...ON, lists: false } });
    expect(noLists.has('spülmittel')).toBe(false);
    expect((await knownShoppingNames({ states: {} })).size).toBe(0);
    await repo('pantry', 'item').remove('p1');
    expect((await knownShoppingNames({ states: ON })).has('milch')).toBe(false);
  });

  it('imports no module', () => {
    const src = readFileSync(new URL('./lookup.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from '@\/modules\//);
  });
});

describe('the capture targets of package 3', () => {
  it('a ToDo with tick-off lines gets them as its checklist', async () => {
    const saved = await saveCapture(
      'todo',
      { title: 'Haushalt', checklist: [' Wäsche ', '', 'Bad'] },
      { states: ON },
    );
    const task = await repo('todos', 'task').get(saved.id);
    expect(task?.checklist).toEqual([
      { id: expect.any(String), text: 'Wäsche', done: false },
      { id: expect.any(String), text: 'Bad', done: false },
    ]);
    const plain = await saveCapture('todo', { title: 'Paket' }, { states: ON });
    expect((await repo('todos', 'task').get(plain.id))?.checklist).toBeUndefined();
  });

  it('a shopping-list entry names its list as the thing the planner lists', async () => {
    const saved = await saveCapture('list', { title: 'Milch' }, { states: ON });
    const item = await repo('lists', 'item').get(saved.id);
    expect(saved.planRef).toEqual({ moduleId: 'lists', id: item?.listId });
    const todo = await saveCapture('todo', { title: 'Paket' }, { states: ON });
    expect(todo.planRef).toBeUndefined();
  });
});
