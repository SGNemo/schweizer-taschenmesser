// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FOCUS, FOCUS_SCOPE, getFocusSettings, patchFocusSettings } from './focus';
import { setChangeListener, settingsRepo, updateSettings } from './settings';

beforeEach(async () => {
  await patchFocusSettings({ ...DEFAULT_FOCUS });
});
afterEach(() => {
  setChangeListener(undefined);
  vi.restoreAllMocks();
});

describe('setSettings', () => {
  it('keeps both changes when two patches of one scope run at the same time', async () => {
    await Promise.all([
      patchFocusSettings({ quietFrom: '21:30' }),
      patchFocusSettings({ repeatMax: 5 }),
    ]);
    const s = await getFocusSettings();
    expect(s.quietFrom).toBe('21:30');
    expect(s.repeatMax).toBe(5);
  });

  it('reports each change with the value the patch before it left behind', async () => {
    const seen: [string, unknown, unknown][] = [];
    setChangeListener((scope, key, before, after) => {
      if (scope === FOCUS_SCOPE) seen.push([key, before, after]);
    });
    await Promise.all([
      patchFocusSettings({ quietFrom: '21:30' }),
      patchFocusSettings({ quietFrom: '20:00' }),
    ]);
    expect(seen).toEqual([
      ['quietFrom', DEFAULT_FOCUS.quietFrom, '21:30'],
      ['quietFrom', '21:30', '20:00'],
    ]);
    expect((await getFocusSettings()).quietFrom).toBe('20:00');
  });

  it('runs the next patch even when the one before failed', async () => {
    vi.spyOn(settingsRepo, 'get').mockRejectedValueOnce(new Error('disk full'));
    const bad = patchFocusSettings({ quietFrom: '21:30' });
    const good = patchFocusSettings({ repeatMax: 6 });
    await expect(bad).rejects.toThrow('disk full');
    await good;
    expect((await getFocusSettings()).repeatMax).toBe(6);
  });

  it('computes an update from what the patch before it wrote', async () => {
    const add = (n: number) =>
      updateSettings('test.list', (v) => ({ items: [...((v.items as number[]) ?? []), n] }));
    await Promise.all([add(1), add(2), updateSettings('test.list', () => undefined), add(3)]);
    expect((await settingsRepo.get('test.list'))?.items).toEqual([1, 2, 3]);
  });
});
