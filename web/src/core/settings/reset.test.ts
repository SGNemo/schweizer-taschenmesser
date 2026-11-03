// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CORE_SECTIONS } from '@/pages/settings/sections';
import { useUiStore } from '@/stores/ui';
import { DEFAULT_FOCUS, getFocusSettings, patchFocusSettings } from './focus';
import { isChanged, sameValue } from './changed';
import { FOCUS_RESET_KEYS, REMINDER_RESET_KEYS, resetSection } from './reset';

const plan = (id: string) => CORE_SECTIONS.find((s) => s.id === id)!.reset!;

beforeEach(() => {
  localStorage.clear();
  useUiStore.setState({ toasts: [] });
});

describe('reset a section', () => {
  it('is offered by the look-and-feel and focus sections only, never by anything security related', () => {
    const withReset = CORE_SECTIONS.filter((s) => s.reset).map((s) => s.id);
    expect(withReset.sort()).toEqual(['appearance', 'calm-reminders', 'focus', 'reading']);
    for (const s of CORE_SECTIONS.filter((x) => x.category === 'sicherheit')) {
      expect(s.reset).toBeUndefined();
    }
  });

  it('resets the look to the defaults and the toast action brings the old values back', async () => {
    const ui = useUiStore.getState();
    ui.setTheme('dark');
    ui.setDensity('compact');
    await resetSection(plan('appearance'), 'Darstellung');
    expect(useUiStore.getState().theme).toBe('system');
    expect(useUiStore.getState().density).toBe('normal');
    useUiStore.getState().toasts.at(-1)!.action!.run();
    await Promise.resolve();
    expect(useUiStore.getState().theme).toBe('dark');
    expect(useUiStore.getState().density).toBe('compact');
  });

  it('resets only the keys of its own section in the focus settings', async () => {
    await patchFocusSettings({ planLimit: 5, maxPerHour: 0, searchHistory: false });
    await resetSection(plan('focus'), 'Fokus');
    const after = await getFocusSettings();
    expect(after.planLimit).toBe(DEFAULT_FOCUS.planLimit);
    expect(after.searchHistory).toBe(DEFAULT_FOCUS.searchHistory);
    expect(after.maxPerHour).toBe(0); // belongs to the reminders section
  });

  it('keys of the two focus resets do not overlap and exist in the focus settings', () => {
    const all = [...FOCUS_RESET_KEYS, ...REMINDER_RESET_KEYS];
    expect(new Set(all).size).toBe(all.length);
    for (const k of all) expect(k in DEFAULT_FOCUS).toBe(true);
  });
});

describe('changed from default', () => {
  // Earlier tests leave values in the store and the focus settings: start from the defaults.
  beforeEach(async () => {
    for (const id of ['appearance', 'reading']) await plan(id).toDefaults();
    await patchFocusSettings({ ...DEFAULT_FOCUS });
  });

  it('compares values whatever the key order, and undefined only equals undefined', () => {
    expect(sameValue({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameValue(undefined, undefined)).toBe(true);
    expect(sameValue(undefined, 0)).toBe(false);
  });

  it('reports a section as changed after a value moves and as unchanged after the reset', async () => {
    expect(await isChanged(plan('appearance'))).toBe(false);
    useUiStore.getState().setTheme('dark');
    expect(await isChanged(plan('appearance'))).toBe(true);
    await resetSection(plan('appearance'), 'Darstellung');
    expect(await isChanged(plan('appearance'))).toBe(false);
  });

  it('covers reading aid and the focus sections too, each only by its own keys', async () => {
    expect(await isChanged(plan('reading'))).toBe(false);
    useUiStore.getState().setReadAid(true);
    expect(await isChanged(plan('reading'))).toBe(true);
    expect(await isChanged(plan('focus'))).toBe(false);
    await patchFocusSettings({ planLimit: 5 });
    expect(await isChanged(plan('focus'))).toBe(true);
    expect(await isChanged(plan('calm-reminders'))).toBe(false);
  });
});
