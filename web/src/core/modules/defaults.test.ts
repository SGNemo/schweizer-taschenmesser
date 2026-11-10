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
import { diffSelection, PROFILES, resolveProfile } from '@/core/setup/profiles';
import {
  deselectInSetup,
  disableModule,
  enableModule,
  enableModuleIfUnset,
  isOnByDefaultSetOnly,
  loadModuleStates,
  loadStoredModuleState,
  undoDisable,
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
/**
 * Stands in for sync: every row is copied into the other device's table as it is. A raw `put`, no HLC and no
 * last-write-wins (that is `core/sync/ops.ts`, pinned by `contract/lww-cases.json`). The cases here show what a
 * device does once a household row is there, in the order the test writes them, not which of two rows wins.
 */
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

  it('5e: the profile step as it runs: a profile with lists writes nothing, the modules it leaves out go to defaults.off', async () => {
    await markFreshDefaults(true, db);
    const infos = DESKTOP.map((m) => ({ id: m.id, requires: m.requires }));
    // What the step works with: the resolved states (the set included), not the rows.
    const states = await loadModuleStates(DESKTOP, db);
    const current = new Set(DESKTOP.filter((m) => states[m.id]).map((m) => m.id));
    const everyday = PROFILES.find((p) => p.id === 'everyday')!;
    const diff = diffSelection(current, resolveProfile(everyday, infos, []).modules);
    // Lists and downloads are in the profile and already on through the set: nothing to switch on.
    expect(diff.enable).toEqual([]);
    expect(diff.disable.sort()).toEqual(['budgets', 'finance']);
    for (const id of diff.disable)
      await deselectInSetup(
        DESKTOP.find((m) => m.id === id)!,
        db,
      );
    // Budgets were on through the set only: device-local. Finance is a manifest default: a household row as before.
    expect(await meta(db, DEFAULTS_OFF_KEY)).toEqual(['budgets']);
    expect((await rows(db)).map((r) => [r.id, r.enabled])).toEqual([['finance', false]]);
    expect(await loadModuleStates(DESKTOP, db)).toMatchObject({
      lists: true,
      downloads: true,
      budgets: false,
      finance: false,
    });
  });

  it('5f: the finance profile finds budgets on through the set and writes no row for them', async () => {
    await markFreshDefaults(true, db);
    const infos = DESKTOP.map((m) => ({ id: m.id, requires: m.requires }));
    const states = await loadModuleStates(DESKTOP, db);
    const current = new Set(DESKTOP.filter((m) => states[m.id]).map((m) => m.id));
    const finances = PROFILES.find((p) => p.id === 'finance')!;
    const diff = diffSelection(current, resolveProfile(finances, infos, []).modules);
    expect(diff.enable).toEqual([]);
    expect(diff.disable.sort()).toEqual(['lists', 'todos']);
  });

  it('6b: "Rückgängig" after switching a set module off takes the row away again: no other device gets a `true`', async () => {
    await markFreshDefaults(true, db);
    const viaSet = await isOnByDefaultSetOnly('lists', db);
    expect(viaSet).toBe(true);
    await disableModule(lists, 'keep', db);
    await undoDisable(lists, viaSet, db);
    expect(await loadStoredModuleState('lists', db)).toBeUndefined();
    expect(await loadModuleStates(DESKTOP, db)).toMatchObject({ lists: true });
    // What reaches an old device is a deleted row, which counts as no row: lists stay off there.
    await arrive(db, other);
    expect(await loadModuleStates(DESKTOP, other)).toMatchObject({ lists: false });
  });

  it('6c: "Rückgängig" for a module with a row of its own switches it on again as before', async () => {
    await enableModule(lists, db);
    const viaSet = await isOnByDefaultSetOnly('lists', db);
    expect(viaSet).toBe(false);
    await disableModule(lists, 'keep', db);
    await undoDisable(lists, viaSet, db);
    expect(await loadStoredModuleState('lists', db)).toMatchObject({ enabled: true });
  });

  it('7a: "switch on if never chosen" (a connector) leaves a module alone that is on through the set: no row, nothing for other devices', async () => {
    await markFreshDefaults(true, db);
    expect(await enableModuleIfUnset(lists, db)).toBe(false);
    expect(await rows(db)).toEqual([]);
    expect(await loadModuleStates(DESKTOP, db)).toMatchObject({ lists: true });
    await arrive(db, other);
    expect(await loadModuleStates(DESKTOP, other)).toMatchObject({ lists: false });
  });

  it('7b: it still switches on what the set does not carry: taken out on this device, or missing what it requires', async () => {
    await markFreshDefaults(true, db);
    // Taken out in the setup: off and without a row, so the connector may switch it on (a household choice from then on).
    await deselectInSetup(lists, db);
    expect(await enableModuleIfUnset(lists, db)).toBe(true);
    expect(await loadStoredModuleState('lists', db)).toMatchObject({ enabled: true });
    // In the set, but off because finance is off: the set does not count, so this is "never chosen" as well.
    await disableModule(finance, 'keep', db);
    expect(await loadModuleStates(DESKTOP, db)).toMatchObject({ budgets: false });
    expect(await enableModuleIfUnset(budgets, db)).toBe(true);
    expect(await loadStoredModuleState('budgets', db)).toMatchObject({ enabled: true });
  });

  it('7c: without a set (existing installation) it switches on once, as before', async () => {
    await markFreshDefaults(false, db);
    expect(await enableModuleIfUnset(lists, db)).toBe(true);
    expect(await enableModuleIfUnset(lists, db)).toBe(false);
    expect(await loadStoredModuleState('lists', db)).toMatchObject({ enabled: true });
  });

  it('the test builds keep the set off unless a context switches it on', async () => {
    vi.stubEnv('MODE', 'e2e-seed');
    await markFreshDefaults(true, db);
    expect(await meta(db, DEFAULTS_VERSION_KEY)).toBeUndefined();
  });
});
