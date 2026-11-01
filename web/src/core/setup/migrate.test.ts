// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { allSetupSteps, applicableSteps } from './registry';
import { buildChecklist } from './checklist';
import { initialState } from './state';
import {
  chooseOrigin,
  EMPTY_MIGRATE,
  hasMigrateChoice,
  migrateItems,
  migrateOutcome,
  readMigrateOverview,
  readMigrateState,
  setManualDone,
} from './migrate';

const batch = (moduleId: string, at: number, extra = {}) => ({
  moduleId,
  createdAt: at,
  committedAt: at,
  ...extra,
});

beforeEach(async () => {
  await db.table('_meta').clear();
  await db.table('_imports').clear();
  await Promise.all(db.tables.filter((t) => t.name.startsWith('notes_')).map((t) => t.clear()));
});

describe('migrateItems (pure)', () => {
  it('lists only the points of chosen origins', () => {
    expect(migrateItems(EMPTY_MIGRATE, [])).toEqual([]);
    const state = { origins: { todoist: 10 }, manualDone: [] };
    expect(migrateItems(state, []).map((i) => [i.id, i.done])).toEqual([['todoist.tasks', false]]);
  });

  it('ticks an import point when a committed batch of its module exists after choosing', () => {
    const state = { origins: { google: 100 }, manualDone: [] };
    const items = migrateItems(state, [
      batch('todos', 150),
      batch('calendar', 50), // before the choice
      batch('notes', 200, { status: 'undone' }), // undone
    ]);
    expect(items.map((i) => [i.id, i.done])).toEqual([
      ['google.calendar', false],
      ['google.tasks', true],
      ['google.keep', false],
      ['google.subscription', false],
    ]);
  });

  it('ticks manual points only by hand', () => {
    const state = { origins: { bitwarden: 1, google: 1 }, manualDone: ['bitwarden.vault'] };
    const done = Object.fromEntries(migrateItems(state, []).map((i) => [i.id, i.done]));
    expect(done['bitwarden.vault']).toBe(true);
    expect(done['google.subscription']).toBe(false);
  });

  it('outcome: nothing chosen = later, import run = done, paper alone = done', () => {
    expect(migrateOutcome(EMPTY_MIGRATE, [])).toBe('skipped');
    const chosen = { origins: { bank: 1 }, manualDone: [] };
    expect(migrateOutcome(chosen, migrateItems(chosen, []))).toBe('skipped');
    expect(migrateOutcome(chosen, migrateItems(chosen, [batch('finance', 5)]))).toBe('done');
    const paper = { origins: { paper: 1 }, manualDone: [] };
    expect(hasMigrateChoice(paper)).toBe(true);
    expect(migrateOutcome(paper, migrateItems(paper, []))).toBe('done');
  });
});

describe('checklist rows with points', () => {
  const steps = [{ id: 'core.migrate', title: 'Umzug', since: 1 }];
  const state = { ...initialState('inProgress'), doneSteps: ['core.migrate'] };

  it('keeps a settled row on the list while a point is open', () => {
    const sub = [
      { id: 'google.tasks', done: true, manual: false },
      { id: 'google.subscription', done: false, manual: true },
    ];
    const list = buildChecklist(steps, state, new Set(), { 'core.migrate': sub });
    expect(list.open).toHaveLength(1);
    expect(list.open[0]).toMatchObject({ progress: 'open', sub });
  });

  it('is done when every point is done', () => {
    const sub = [{ id: 'google.tasks', done: true, manual: false }];
    expect(buildChecklist(steps, state, new Set(), { 'core.migrate': sub }).open).toEqual([]);
  });
});

describe('storage', () => {
  it('stores origin ids and times only, first choice wins', async () => {
    await chooseOrigin('google');
    const first = (await readMigrateState()).origins.google;
    await chooseOrigin('google');
    expect((await readMigrateState()).origins.google).toBe(first);
    await setManualDone('google.subscription', true);
    const row = await db.table('_meta').get('migrate.state');
    expect(Object.keys(row.value).sort()).toEqual(['manualDone', 'origins']);
    expect(
      (await readMigrateOverview()).items.find((i) => i.id === 'google.subscription')?.done,
    ).toBe(true);
  });

  it('ignores unknown ids in stored data', async () => {
    await db
      .table('_meta')
      .put({ key: 'migrate.state', value: { origins: { evil: 1, bank: 2 }, manualDone: ['x'] } });
    expect(await readMigrateState()).toEqual({ origins: { bank: 2 }, manualDone: [] });
  });
});

describe('step registration', () => {
  const ctx = { modules: { todos: true }, platform: 'web', isNative: false } as const;

  it('sits directly before the start data and is not a first-run question', () => {
    const ids = allSetupSteps.map((s) => s.id);
    expect(ids.indexOf('core.migrate')).toBe(ids.indexOf('core.startdata') - 1);
    expect(ids.indexOf('core.migrate')).toBeGreaterThan(ids.indexOf('core.ai'));
  });

  it('appears on an empty installation only, but stays once an origin was chosen', async () => {
    const has = async () =>
      (await applicableSteps(allSetupSteps, ctx)).map((s) => s.id).includes('core.migrate');
    expect(await has()).toBe(true);
    const { allManifests } = await import('@/core/modules/registry');
    const { createCollectionRepo } = await import('@/core/db/repo');
    const notes = allManifests.find((m) => m.id === 'notes')!;
    await createCollectionRepo(notes, 'note', db).create({
      title: 'Echt',
      body: '',
      pinned: false,
    });
    expect(await has()).toBe(false);
    await chooseOrigin('bank');
    expect(await has()).toBe(true);
  });
});
