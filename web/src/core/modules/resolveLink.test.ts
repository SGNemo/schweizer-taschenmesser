import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { resolveLink } from './contributions';
import { allManifests, getManifest } from './registry';
import type { LinkState, ModuleManifest } from './types';

/** A manifest with only what `resolveLink` and the module states read. */
function fake(
  id: string,
  resolve?: (id: string) => Promise<LinkState>,
  defaultEnabled = true,
): ModuleManifest {
  return {
    id,
    defaultEnabled,
    contributions: resolve ? { linkTarget: async () => ({ default: { resolve } }) } : {},
  } as unknown as ModuleManifest;
}

const alive: LinkState = { state: 'alive', title: 'Hallo', to: '/x?open=1' };

beforeEach(async () => {
  for (const t of ['_modules', '_meta']) await db.table(t).clear();
});
afterEach(() => vi.restoreAllMocks());

describe('resolveLink', () => {
  it('hands the id to the target module and returns its answer', async () => {
    const resolve = vi.fn(async () => alive);
    expect(await resolveLink({ module: 'x', id: '1' }, [fake('x', resolve)])).toEqual(alive);
    expect(resolve).toHaveBeenCalledWith('1');
  });

  it('never reaches a module for the vault – not even one that offered a resolver', async () => {
    const resolve = vi.fn(async () => alive);
    const manifests = [fake('accounts', resolve)];
    expect(await resolveLink({ module: 'accounts', id: '1' }, manifests)).toEqual({
      state: 'gone',
    });
    expect(resolve).not.toHaveBeenCalled();
    // The real registry: the same answer, whatever the module's state.
    expect(await resolveLink({ module: 'accounts', id: 'entry-1' })).toEqual({ state: 'gone' });
  });

  it('the vault offers no resolver, and the modules that do are exactly the linkable ones', () => {
    expect(getManifest('accounts')!.contributions).not.toHaveProperty('linkTarget');
    const targets = allManifests.filter((m) => m.contributions?.linkTarget).map((m) => m.id);
    expect(targets.sort()).toEqual([
      'bookmarks',
      'calendar',
      'invoices',
      'lists',
      'mail',
      'notes',
      'pantry',
      // Its topics only (planner hub 2, package 11).
      'planner',
      'routines',
      'subscriptions',
      'todos',
      'vault',
    ]);
  });

  it('a failing resolver is logged by the registry id only, never by the stored module string', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = fake('x', async () => {
      throw new Error('boom');
    });
    await resolveLink({ module: 'x', id: 'secret-id' }, [broken]);
    expect(String(error.mock.calls[0]![0])).toBe('[linkTarget] "x" failed');
    expect(String(error.mock.calls[0]![0])).not.toContain('secret-id');
  });

  it('answers `unavailable` itself while the module is off, unknown or not on this platform', async () => {
    const resolve = vi.fn(async () => alive);
    const off = [fake('x', resolve, false)];
    expect(await resolveLink({ module: 'x', id: '1' }, off)).toEqual({ state: 'unavailable' });
    expect(await resolveLink({ module: 'nowhere', id: '1' }, off)).toEqual({
      state: 'unavailable',
    });
    expect(resolve).not.toHaveBeenCalled();
    // Mail is desktop only: on the web platform of the tests it is not among the available manifests.
    expect((await resolveLink({ module: 'mail', id: 'thread-1' })).state).toBe('unavailable');
  });

  it('a mail link with a malformed id gets no web address', async () => {
    const res = await resolveLink({ module: 'mail', id: 'x/../../?q=1' }, []);
    expect(res).toEqual({ state: 'unavailable' });
  });

  it('an id that cannot be a record id is `gone` without asking', async () => {
    const resolve = vi.fn(async () => alive);
    const manifests = [fake('x', resolve)];
    expect(await resolveLink({ module: 'x', id: '' }, manifests)).toEqual({ state: 'gone' });
    expect(await resolveLink({ module: 'x', id: 'a'.repeat(129) }, manifests)).toEqual({
      state: 'gone',
    });
    expect(await resolveLink({ module: 'x', id: 7 as unknown as string }, manifests)).toEqual({
      state: 'gone',
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('a module without a resolver is `gone`', async () => {
    expect(await resolveLink({ module: 'x', id: '1' }, [fake('x')])).toEqual({ state: 'gone' });
  });

  it('never throws: a failing resolver reads as `elsewhere`, not as `gone`', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = fake('x', async () => {
      throw new Error('boom');
    });
    expect(await resolveLink({ module: 'x', id: '1' }, [broken])).toEqual({ state: 'elsewhere' });
    expect(error).toHaveBeenCalled();
  });
});
