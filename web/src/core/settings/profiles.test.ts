// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { DEFAULT_FOCUS, getFocusSettings, patchFocusSettings } from './focus';
import {
  activeProfile,
  applyProfile,
  builtinProfiles,
  deleteProfile,
  dueSchedule,
  loadCustomProfiles,
  matches,
  newSchedule,
  readSchedules,
  restoreProfile,
  runDueSchedule,
  saveCurrentAsProfile,
  writeSchedules,
  type Schedule,
} from './profiles';
import { ALL_VALUE_KEYS, readValues, valuesSchema, writeValues } from './values';

const builtin = (id: string) => builtinProfiles().find((p) => p.id === id)!;

beforeEach(async () => {
  localStorage.clear();
  setNow(undefined);
  useUiStore.setState({ toasts: [] });
  for (const [k, v] of Object.entries({
    theme: 'system',
    density: 'normal',
    colorMode: 'full',
    motion: 'system',
    homeView: 'all',
    readAid: false,
  })) {
    await writeValues({ [k]: v });
  }
  await patchFocusSettings({ ...DEFAULT_FOCUS });
});

describe('the allow-list', () => {
  it('lists look and reminder choices only, nothing security related', () => {
    expect([...ALL_VALUE_KEYS].sort()).toEqual(
      [
        'accent',
        'calmAttention',
        'colorMode',
        'density',
        'homeView',
        'inAppPrompt',
        'leading',
        'maxPerHour',
        'motion',
        'quietFrom',
        'quietHours',
        'quietTo',
        'readAid',
        'readCover',
        'readShare',
        'readStyle',
        'sidebar',
        'textSize',
        'theme',
      ].sort(),
    );
    for (const k of ALL_VALUE_KEYS)
      expect(k).not.toMatch(/lock|key|token|secret|vault|password|channel|api|disk|supporter/i);
  });

  it('rejects unknown keys and invalid values (a vault setting can never ride along)', () => {
    expect(valuesSchema.safeParse({ theme: 'dark' }).success).toBe(true);
    expect(valuesSchema.safeParse({ autoLockMinutes: '30' }).success).toBe(false);
    expect(valuesSchema.safeParse({ theme: 'purple' }).success).toBe(false);
    expect(valuesSchema.safeParse({ quietFrom: '25:00' }).success).toBe(false);
  });

  it('writes look through the store and focus choices through the synced scope, and returns what was there', async () => {
    const before = await writeValues({ theme: 'dark', quietHours: false, maxPerHour: 2 });
    expect(before).toEqual({
      theme: 'system',
      quietHours: DEFAULT_FOCUS.quietHours,
      maxPerHour: DEFAULT_FOCUS.maxPerHour,
    });
    expect(useUiStore.getState().theme).toBe('dark');
    expect((await getFocusSettings()).maxPerHour).toBe(2);
    await writeValues(before);
    expect(useUiStore.getState().theme).toBe('system');
  });
});

describe('profiles', () => {
  it('has three valid built-ins that never contain more than the allow-list', () => {
    expect(builtinProfiles().map((p) => p.id)).toEqual(['quiet', 'work', 'evening']);
    for (const p of builtinProfiles()) {
      expect(valuesSchema.safeParse(p.values).success, p.id).toBe(true);
      expect(Object.keys(p.values).length).toBeGreaterThan(0);
    }
  });

  it('switches many settings at once and the toast action puts them back', async () => {
    await applyProfile(builtin('evening'));
    expect(useUiStore.getState().theme).toBe('dark');
    expect(useUiStore.getState().colorMode).toBe('calm');
    expect((await getFocusSettings()).quietHours).toBe(true);
    useUiStore.getState().toasts.at(-1)!.action!.run();
    await new Promise((r) => setTimeout(r, 0));
    expect(useUiStore.getState().theme).toBe('system');
    expect(useUiStore.getState().colorMode).toBe('full');
  });

  it('is active exactly while all its values are what is set', async () => {
    const quiet = builtin('quiet');
    expect(matches(quiet, await readValues(ALL_VALUE_KEYS))).toBe(false);
    await applyProfile(quiet);
    expect(matches(quiet, await readValues(ALL_VALUE_KEYS))).toBe(true);
    useUiStore.getState().setMotion('system');
    expect(matches(quiet, await readValues(ALL_VALUE_KEYS))).toBe(false);
  });

  it('saves the current values as an own profile, deletes it and brings it back', async () => {
    useUiStore.getState().setDensity('compact');
    const saved = await saveCurrentAsProfile('  Zuhause  ');
    expect(saved?.name).toBe('Zuhause');
    expect(saved?.values.density).toBe('compact');
    expect((await loadCustomProfiles()).map((p) => p.name)).toEqual(['Zuhause']);
    const gone = await deleteProfile(saved!.id);
    expect(await loadCustomProfiles()).toEqual([]);
    await restoreProfile(gone!);
    expect(await loadCustomProfiles()).toHaveLength(1);
    expect(await saveCurrentAsProfile('   ')).toBeUndefined();
  });
});

describe('which profile is active', () => {
  it('prefers the one switched on last, else the one with the most values', async () => {
    const all = builtinProfiles();
    await applyProfile(builtin('evening')); // dark + calm + reduced motion + quiet hours: "Ruhig" fits too
    const cur = await readValues(ALL_VALUE_KEYS);
    await writeValues({ homeView: 'calm' });
    const now = await readValues(ALL_VALUE_KEYS);
    expect(activeProfile(all, now, 'evening')?.id).toBe('evening');
    expect(activeProfile(all, now, 'quiet')?.id).toBe('quiet');
    expect(activeProfile(all, now, undefined)?.id).toBe('quiet'); // 4 values beat 4: first of the equals
    expect(activeProfile(all, cur, 'work')?.id).not.toBe('work');
    expect(activeProfile(all, { theme: 'light' }, 'quiet')).toBeUndefined();
  });
});

describe('schedules', () => {
  const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m); // 2026-11-02 is a Monday
  const evening: Schedule = {
    id: 's1',
    profileId: 'evening',
    days: [1, 2, 3, 4, 5],
    time: '20:00',
  };
  const morning: Schedule = { id: 's2', profileId: 'work', days: [1, 2, 3, 4, 5], time: '07:00' };

  it('is due from its time on, on its days only, and once', () => {
    expect(dueSchedule(at(2, 19, 59), [evening])).toBeUndefined();
    const due = dueSchedule(at(2, 20, 0), [evening]);
    expect(due?.schedule.id).toBe('s1');
    expect(dueSchedule(at(2, 22, 30), [evening], due!.key)).toBeUndefined(); // already ran: a switch by hand stays
    expect(dueSchedule(at(7, 21, 0), [evening])).toBeUndefined(); // Saturday
    expect(dueSchedule(at(3, 20, 0), [evening], due!.key)?.schedule.id).toBe('s1'); // next day: again
  });

  it('picks the latest passed time of the day', () => {
    expect(dueSchedule(at(2, 8, 0), [evening, morning])?.schedule.id).toBe('s2');
    expect(dueSchedule(at(2, 21, 0), [evening, morning])?.schedule.id).toBe('s1');
    expect(dueSchedule(at(2, 6, 0), [evening, morning])).toBeUndefined();
  });

  it('applies the due profile with a toast, once, and skips a deleted profile', async () => {
    writeSchedules([evening]);
    setNow(() => at(2, 20, 5).getTime());
    await runDueSchedule();
    expect(useUiStore.getState().theme).toBe('dark');
    expect(useUiStore.getState().toasts.at(-1)!.message).toContain('Zeitplan');
    useUiStore.getState().setTheme('light'); // by hand after the schedule
    await runDueSchedule();
    expect(useUiStore.getState().theme).toBe('light');
    localStorage.removeItem('tm-profile-last');
    writeSchedules([{ ...evening, profileId: 'gone' }]);
    useUiStore.setState({ toasts: [] });
    await runDueSchedule();
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });

  it('keeps schedules in local storage and ignores broken content', () => {
    const s = newSchedule('quiet');
    writeSchedules([s]);
    expect(readSchedules()).toEqual([s]);
    localStorage.setItem('tm-profile-schedules', '{broken');
    expect(readSchedules()).toEqual([]);
    localStorage.setItem(
      'tm-profile-schedules',
      JSON.stringify([{ id: 'x', profileId: 'y', days: [9], time: '99:99' }]),
    );
    expect(readSchedules()).toEqual([]);
  });
});
