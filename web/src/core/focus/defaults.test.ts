// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { DEFAULT_FOCUS, getFocusSettings, patchFocusSettings } from '@/core/settings/focus';
import { applyDefaultsEra, DEFAULTS_ERA_KEY } from './defaults';

beforeEach(async () => {
  await db.table('_meta').clear();
  await db.table('_settings').clear();
  localStorage.clear();
});

describe('calm defaults', () => {
  it('are the new defaults for a fresh installation', async () => {
    expect(DEFAULT_FOCUS).toMatchObject({ streaks: false, weekReview: false, moduleNow: false });
    const setHomeView = vi.fn();
    await applyDefaultsEra(true, setHomeView);
    expect(setHomeView).not.toHaveBeenCalled();
    expect(await getFocusSettings()).toMatchObject({
      streaks: false,
      weekReview: false,
      moduleNow: false,
    });
  });

  it('keep an existing installation as it was (old values written explicitly, view "all")', async () => {
    const setHomeView = vi.fn();
    await applyDefaultsEra(false, setHomeView);
    expect(setHomeView).toHaveBeenCalledWith('all');
    expect(await getFocusSettings()).toMatchObject({
      streaks: true,
      weekReview: true,
      moduleNow: true,
    });
  });

  it('never overwrite a value the user already chose, and leave a stored home view alone', async () => {
    await patchFocusSettings({ streaks: false, planLimit: 5 });
    localStorage.setItem('tm-home-view', 'calm');
    const setHomeView = vi.fn();
    await applyDefaultsEra(false, setHomeView);
    expect(setHomeView).not.toHaveBeenCalled();
    expect(await getFocusSettings()).toMatchObject({
      streaks: false,
      planLimit: 5,
      weekReview: true,
      moduleNow: true,
    });
  });

  it('run once: a second start changes nothing', async () => {
    await applyDefaultsEra(false, vi.fn());
    await patchFocusSettings({ streaks: false });
    const setHomeView = vi.fn();
    await applyDefaultsEra(false, setHomeView);
    expect(setHomeView).not.toHaveBeenCalled();
    expect((await getFocusSettings()).streaks).toBe(false);
    expect(await db.table('_meta').get(DEFAULTS_ERA_KEY)).toBeTruthy();
  });
});
