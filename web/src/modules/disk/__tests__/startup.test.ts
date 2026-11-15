import { describe, expect, it } from 'vitest';
import type { StartupItem } from '@/core/platform/optimize';
import { createFakeDisk } from '@/core/platform/fakeDisk';
import { noOptimize } from '@/core/platform/optimize';
import { detailOf, enabledCount, groupStartup, shortCommand, withEnabled } from '../logic/startup';

const item = (over: Partial<StartupItem>): StartupItem => ({
  id: `run:${over.name ?? 'x'}`,
  name: 'x',
  command: 'x.exe',
  program: 'x',
  scope: 'user',
  source: 'run',
  enabled: true,
  switchable: true,
  ...over,
});

describe('autostart list', () => {
  it('groups by scope and sorts by name without regard to case', () => {
    const groups = groupStartup([
      item({ name: 'zeta' }),
      item({ name: 'Druck', scope: 'machine', switchable: false }),
      item({ name: 'Alpha' }),
      item({ name: 'beta', id: 'folder:beta.lnk', source: 'folder' }),
      item({ name: 'Audio', scope: 'machine', switchable: false }),
    ]);
    expect(groups.user.map((i) => i.name)).toEqual(['Alpha', 'beta', 'zeta']);
    expect(groups.machine.map((i) => i.name)).toEqual(['Audio', 'Druck']);
  });

  it('keeps equal names in a fixed order and leaves the input alone', () => {
    const input = [item({ name: 'A', id: 'run:A' }), item({ name: 'a', id: 'folder:a.lnk' })];
    const groups = groupStartup(input);
    expect(groups.user.map((i) => i.id)).toEqual(['folder:a.lnk', 'run:A']);
    expect(input.map((i) => i.id)).toEqual(['run:A', 'folder:a.lnk']);
    expect(groupStartup([])).toEqual({ user: [], machine: [] });
  });

  it('counts what is switched on', () => {
    expect(enabledCount([])).toBe(0);
    expect(enabledCount([item({}), item({ enabled: false }), item({ scope: 'machine' })])).toBe(2);
  });

  it('shortens a long command in the middle', () => {
    expect(shortCommand('  app.exe /x  ')).toBe('app.exe /x');
    const long = `"C:\\Program Files\\${'a'.repeat(120)}\\app.exe" --minimized`;
    const short = shortCommand(long, 40);
    expect(short.length).toBeLessThanOrEqual(40);
    expect(short.startsWith('"C:\\Program Files\\')).toBe(true);
    expect(short).toContain('…');
    expect(short.endsWith('--minimized')).toBe(true);
    expect(shortCommand('x'.repeat(72))).toBe('x'.repeat(72));
  });

  it('names the program only when the entry does not', () => {
    expect(detailOf(item({ name: 'Musik', program: 'musik', command: 'musik.exe -a' }), 'F')).toBe(
      'musik.exe -a',
    );
    expect(detailOf(item({ name: 'Chat', program: 'Update', command: 'Update.exe' }), 'F')).toBe(
      'Update · Update.exe',
    );
    expect(detailOf(item({ name: 'Chat', program: '', command: 'run me' }), 'F')).toBe('run me');
    expect(
      detailOf(
        item({ name: 'Notiz', program: 'Notiz', command: 'Notiz.lnk', source: 'folder' }),
        'Ordner',
      ),
    ).toBe('Ordner · Notiz.lnk');
  });

  it('switches one entry in a copy of the list', () => {
    const list = [item({ name: 'a' }), item({ name: 'b' })];
    const next = withEnabled(list, 'run:b', false);
    expect(next.map((i) => i.enabled)).toEqual([true, false]);
    expect(list[1]!.enabled).toBe(true);
    expect(withEnabled(list, 'run:none', false)).toEqual(list);
  });
});

describe('autostart in the fake platform', () => {
  it('lists own and machine-wide entries, one of them off', async () => {
    const { optimize } = createFakeDisk();
    const items = await optimize.startupList();
    const groups = groupStartup(items);
    expect(groups.user.length).toBeGreaterThanOrEqual(3);
    expect(groups.machine).toHaveLength(1);
    expect(groups.machine[0]!.switchable).toBe(false);
    expect(items.some((i) => !i.enabled)).toBe(true);
    expect(items.some((i) => i.source === 'folder')).toBe(true);
  });

  it('notes a switch in the history and undo flips it back', async () => {
    const { optimize } = createFakeDisk();
    const state = async (id: string) =>
      (await optimize.startupList()).find((i) => i.id === id)!.enabled;
    const off = await optimize.setStartup('run:Musikbox', false);
    expect(off).not.toBeNull();
    expect(await state('run:Musikbox')).toBe(false);
    // Already off: nothing happens, nothing is noted.
    expect(await optimize.setStartup('run:Musikbox', false)).toBeNull();
    const on = await optimize.setStartup('run:Musikbox', true);
    let entries = (await optimize.history()).entries;
    expect(entries.map((e) => [e.kind, e.label, e.on, e.canUndo])).toEqual([
      ['startup', 'Musikbox', true, true],
      // The older change waits for the newer one.
      ['startup', 'Musikbox', false, false],
    ]);
    await optimize.undo(on!);
    expect(await state('run:Musikbox')).toBe(false);
    entries = (await optimize.history()).entries;
    expect(entries.map((e) => [e.undone, e.canUndo])).toEqual([
      [true, false],
      [false, true],
    ]);
    await optimize.undo(off!);
    expect(await state('run:Musikbox')).toBe(true);
    await expect(optimize.undo(off!)).rejects.toThrow('already-undone');
  });

  it('refuses machine-wide and unknown entries', async () => {
    const { optimize } = createFakeDisk();
    await expect(optimize.setStartup('machine:Druckerhelfer', false)).rejects.toThrow('read-only');
    await expect(optimize.setStartup('run:nichts', false)).rejects.toThrow('unknown-entry');
    expect((await optimize.history()).entries).toEqual([]);
  });

  it('does not exist where there is no PC care', async () => {
    await expect(noOptimize.startupList()).rejects.toThrow('unsupported');
    await expect(noOptimize.setStartup('run:x', false)).rejects.toThrow('unsupported');
  });
});
