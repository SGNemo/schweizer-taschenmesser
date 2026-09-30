import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { tableName } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { appHasData, ensureSetupState } from './detect';
import { readSetupState, SETUP_STATE_KEY } from './state';

const first = allManifests.find((m) =>
  Object.values(m.dataSchema.collections).some((c) => !c.local),
)!;
const [collection] = Object.entries(first.dataSchema.collections).find(([, c]) => !c.local)!;
const dataTable = tableName(first.id, collection);

beforeEach(async () => {
  for (const name of ['_meta', '_modules', '_settings', '_imports', '_secrets', dataTable]) {
    await db.table(name).clear();
  }
});

describe('start migration', () => {
  it('a really empty app starts as notStarted', async () => {
    expect(await appHasData()).toBe(false);
    expect((await ensureSetupState()).status).toBe('notStarted');
  });

  it.each([
    ['module data', () => db.table(dataTable).put({ id: 'x' })],
    ['a module switched on or off', () => db.table('_modules').put({ id: 'todos', enabled: true })],
    ['settings', () => db.table('_settings').put({ id: 'dashboard' })],
    ['an import', () => db.table('_imports').put({ id: 'imp1', moduleId: 'todos', createdAt: 1 })],
    ['a sync connection', () => db.table('_secrets').put({ key: 'syncConfig', value: {} })],
    ['an AI configuration', () => db.table('_secrets').put({ key: 'aiConfig', value: {} })],
  ])('an installation with %s becomes dismissed', async (_name, seed) => {
    await seed();
    expect(await appHasData()).toBe(true);
    expect((await ensureSetupState()).status).toBe('dismissed');
  });

  it('is idempotent and never overwrites existing progress', async () => {
    await ensureSetupState();
    await db.table('_meta').put({
      key: SETUP_STATE_KEY,
      value: { ...(await readSetupState())!, status: 'inProgress', doneSteps: ['a'] },
    });
    await db.table(dataTable).put({ id: 'x' });
    expect(await ensureSetupState()).toMatchObject({ status: 'inProgress', doneSteps: ['a'] });
  });

  it('replaces an unreadable state instead of failing', async () => {
    await db.table('_meta').put({ key: SETUP_STATE_KEY, value: { status: 'nonsense' } });
    expect((await ensureSetupState()).status).toBe('notStarted');
  });
});
