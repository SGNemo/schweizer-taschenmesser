// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CORE_SECTIONS } from '@/pages/settings/sections';
import { useUiStore } from '@/stores/ui';
import { DEFAULT_FOCUS, getFocusSettings, patchFocusSettings } from './focus';
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
