import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackup, importBackup } from '@/core/backup/backup';
import type { TaschenmesserDB } from '@/core/db/db';
import { bus } from '@/core/events';
import budgets from '@/modules/budgets/manifest';
import downloads from '@/modules/downloads/manifest';
import finance from '@/modules/finance/manifest';
import lists from '@/modules/lists/manifest';
import todos from '@/modules/todos/manifest';
import { createTestDb } from '@/test-utils';
import {
  deselectInSetup,
  disableModule,
  enableModule,
  loadModuleStates,
  loadStoredModuleState,
} from './activation';
import {
  CURRENT_DEFAULTS_VERSION,
  DEFAULTS_OFF_KEY,
  DEFAULTS_VERSION_KEY,
  markFreshDefaults,
} from './defaults';

/**
 * Default set of a fresh installation (UI audit 2026-11, package V-1; spec: docs/design/ui-audit-2026-11/PACKAGE-0.md
 * „H-a“). The promise behind every case: the default never becomes a synced `_modules` row, so no other device and no
 * existing installation changes. A second database stands for a second device; "sync" is the row arriving there.
 */
const DESKTOP = [todos, finance, lists, budgets, downloads];
const PHONE = [todos, finance, lists, budgets];

let db: TaschenmesserDB;
let other: TaschenmesserDB;
beforeEach(() => {
  db = createTestDb();
  other = createTestDb();
});
afterEach(async () => {
  bus.clear();
  vi.unstubAllEnvs();
  for (const d of [db, other]) {
    d.close();
    await d.delete();
  }
});

const meta = (d: TaschenmesserDB, key: string) =>
  d
    .table<{ key: string; value: unknown }, string>('_meta')
    .get(key)
    .then((row) => row?.value);
const rows = (d: TaschenmesserDB) => d.table('_modules').toArray();
/** What sync does with a household row: it lands in the other device's table as it is. */
const arrive = async (from: TaschenmesserDB, to: TaschenmesserDB) => {
  for (const row of await rows(from)) await to.table('_modules').put(row);
};

describe('default set of a fresh installation', () => {
  it('1: a fresh installation notes set 4 and shows lists, budgets and (desktop) downloads without any row', async () => {
    await markFreshDefaults(true, db);
    expect(await meta(db, DEFAULTS_VERSION_KEY)).toBe(CURRENT_DEFAULTS_VERSION);
    expect(await loadModuleStates(DESKTOP, db)).toMatchObject({
      lists: true,
      budgets: true,
      downloads: true,
    });
    // The phone and the browser have no downloads module at all: the set simply has nothing to switch on there.
    expect(await loadModuleStates(PHONE, db)).toEqual({
      todos: true,
      finance: true,
      lists: true,
      budgets: true,
    });
    expect(await rows(db)).toEqual([]);
    // Running again changes nothing.
    await markFreshDefaults(true, db);
    expect(await meta(db, DEFAULTS_VERSION_KEY)).toBe(CURRENT_DEFAULTS_VERSION);
  });

  it('1b: budgets follow what they require: without finance the set does not switch them on', async () => {
    await markFreshDefaults(true, db);
    await disableModule(finance, 'keep', db);
    expect(await loadModuleStates(DESKTOP, db)).toMatchObject({ finance: false, budgets: false });
  });

  it('2: an existing installation has no set: nothing changes, and a choice writes a row as before', async () => {
    await markFreshDefaults(false, db);
    expect(await meta(db, DEFAULTS_VERSION_KEY)).toBeUndefined();
    expect(await loadModuleStates(DESKTOP, db)).toMatchObject({
      lists: false,
      budgets: false,
      downloads: false,
    });
    await enableModule(lists, db);
    expect(await loadStoredModuleState('lists', db)).toMatchObject({ enabled: true });
    await enableModule(budgets, db);
    expect(await loadModuleStates(DESKTOP, db)).toMatchObject({ lists: true, budgets: true });
  });

  it('3: a new device joins a household: the old device is unchanged, a household row wins, without one the module stays on', async () => {
    // `other` is the old device (no set), `db` the new one.
    await markFreshDefaults(true, db);
    await arrive(db, other);
    expect(await rows(other)).toEqual([]);
    expect(await loadModuleStates(DESKTOP, other)).toMatchObject({ lists: false, budgets: false });
    // No household row: on, on the new device only (deliberate).
    expect(await loadModuleStates(DESKTOP, db)).toMatchObject({ lists: true, budgets: true });
    // The household said no to lists and yes to budgets at some point: both rows win over the set.
    await disableModule(lists, 'keep', other);
    await enableModule(budgets, other);
    await arrive(other, db);
    expect(await loadModuleStates(DESKTOP, db)).toMatchObject({ lists: false, budgets: true });
  });

  it('4: restoring a backup keeps the set, and the rows of the backup win', async () => {
    await disableModule(lists, 'keep', other);
    const backup = await createBackup(other);
    expect(JSON.stringify(backup)).not.toContain(DEFAULTS_VERSION_KEY);

    await markFreshDefaults(true, db);
    await importBackup(backup, 'replace', db);
    expect(await meta(db, DEFAULTS_VERSION_KEY)).toBe(CURRENT_DEFAULTS_VERSION);
    expect(await loadModuleStates(DESKTOP, db)).toMatchObject({ lists: false, budgets: true });
  });

  it('5: the profile step takes a set module out device-locally, never as a row', async () => {
    await markFreshDefaults(true, db);
    // A profile without lists.
    await deselectInSetup(lists, db);
    expect(await meta(db, DEFAULTS_OFF_KEY)).toEqual(['lists']);
    expect(await rows(db)).toEqual([]);
    expect(await loadModuleStates(DESKTOP, db)).toMatchObject({ lists: false, budgets: true });

    // Later the device joins a household that uses lists: the row wins, lists are on.
    await enableModule(lists, other);
    await arrive(other, db);
    expect(await loadModuleStates(DESKTOP, db)).toMatchObject({ lists: true });
  });

  it('5b: with a household row already there the profile step writes a row as before', async () => {
    await markFreshDefaults(true, db);
    await enableModule(lists, other);
    await arrive(other, db);
    await deselectInSetup(lists, db);
    expect(await loadStoredModuleState('lists', db)).toMatchObject({ enabled: false });
    expect(await meta(db, DEFAULTS_OFF_KEY)).toBeUndefined();
  });

  it('5c: a module that is not on through the set is deselected as a household choice', async () => {
    await markFreshDefaults(true, db);
    await deselectInSetup(todos, db);
    expect(await loadStoredModuleState('todos', db)).toMatchObject({ enabled: false });
  });

  it('5d: "lists on" in the library after the device-local off removes the entry and writes the row', async () => {
    await markFreshDefaults(true, db);
    await deselectInSetup(lists, db);
    await enableModule(lists, db);
    expect(await meta(db, DEFAULTS_OFF_KEY)).toEqual([]);
    expect(await loadStoredModuleState('lists', db)).toMatchObject({ enabled: true });
  });

  it('6: switching a set module off in the library is a household choice: the row syncs and the module events run', async () => {
    await markFreshDefaults(true, db);
    await markFreshDefaults(true, other);
    const disabling = vi.fn();
    bus.on('module.disabling', disabling);
    await disableModule(lists, 'keep', db);
    expect(disabling).toHaveBeenCalledWith({ moduleId: 'lists', policy: 'keep' });
    expect(await loadStoredModuleState('lists', db)).toMatchObject({ enabled: false });
    // Device B has the set too; the household's "off" still wins there.
    await arrive(db, other);
    expect(await loadModuleStates(DESKTOP, other)).toMatchObject({ lists: false, budgets: true });
  });

  it('the test builds keep the set off unless a context switches it on', async () => {
    vi.stubEnv('VITE_DEFAULTS_OFF', '1');
    await markFreshDefaults(true, db);
    expect(await meta(db, DEFAULTS_VERSION_KEY)).toBeUndefined();
  });
});
