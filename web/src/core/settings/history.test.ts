// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/stores/ui';
import { DEFAULT_FOCUS, getFocusSettings, patchFocusSettings } from './focus';
import {
  clearHistory,
  isHistoryOn,
  isRecorded,
  MAX_ENTRIES,
  readHistory,
  recordGroup,
  setHistoryOn,
  startHistory,
  undoEntry,
  withoutHistory,
} from './history';
import { applyProfile, builtinProfiles } from './profiles';
import { setSettings } from './settings';

let stop: () => void;
beforeEach(async () => {
  stop?.();
  localStorage.clear();
  useUiStore.setState({ toasts: [] });
  useUiStore.getState().setTheme('system');
  useUiStore.getState().setDensity('normal');
  await patchFocusSettings({ ...DEFAULT_FOCUS });
  clearHistory();
  stop = startHistory();
});

describe('change history', () => {
  it('writes down a change of the look with what puts it back, newest first', () => {
    useUiStore.getState().setTheme('dark');
    useUiStore.getState().setDensity('compact');
    const h = readHistory();
    expect(h).toHaveLength(2);
    expect(h[1]!.undo.values).toEqual({ theme: 'system' });
    expect(h[0]!.undo.values).toEqual({ density: 'normal' });
  });

  it('records a synced change with the default as the previous value, and not a no-op', async () => {
    await patchFocusSettings({ maxPerHour: 5 });
    await patchFocusSettings({ maxPerHour: 5 });
    const h = readHistory();
    expect(h).toHaveLength(1);
    expect(h[0]!.undo.scopes).toEqual({ focus: { maxPerHour: DEFAULT_FOCUS.maxPerHour } });
  });

  it('never records the vault, the supporter code, the AI switch or secrets', async () => {
    for (const scope of ['module.accounts', 'supporter', 'ai.switch', '_secrets', 'api.token']) {
      expect(isRecorded(scope), scope).toBe(false);
    }
    await setSettings('module.accounts', { autoLockMinutes: '30' }, { autoLockMinutes: '5' });
    await setSettings('supporter', { code: 'X' }, { code: '' });
    expect(readHistory()).toHaveLength(0);
  });

  it('takes a change back without writing a new entry, and removes the entry', async () => {
    await patchFocusSettings({ maxPerHour: 5 });
    useUiStore.getState().setTheme('dark');
    for (const e of readHistory()) await undoEntry(e.id);
    expect(useUiStore.getState().theme).toBe('system');
    expect((await getFocusSettings()).maxPerHour).toBe(DEFAULT_FOCUS.maxPerHour);
    expect(readHistory()).toHaveLength(0);
  });

  it('shows a profile switch as one entry that undoes all of it', async () => {
    await applyProfile(builtinProfiles().find((p) => p.id === 'evening')!);
    const h = readHistory();
    expect(h).toHaveLength(1);
    expect(useUiStore.getState().theme).toBe('dark');
    await undoEntry(h[0]!.id);
    expect(useUiStore.getState().theme).toBe('system');
    expect(readHistory()).toHaveLength(0);
  });

  it('keeps the last 30, can be switched off and cleared, and can pause for a group', async () => {
    for (let i = 0; i < MAX_ENTRIES + 5; i++) recordGroup(`e${i}`, {});
    expect(readHistory()).toHaveLength(MAX_ENTRIES);
    expect(readHistory()[0]!.label).toBe(`e${MAX_ENTRIES + 4}`);
    setHistoryOn(false);
    expect(isHistoryOn()).toBe(false);
    useUiStore.getState().setTheme('dark');
    expect(readHistory()).toHaveLength(MAX_ENTRIES);
    setHistoryOn(true);
    await withoutHistory(async () => useUiStore.getState().setTheme('light'));
    expect(readHistory()).toHaveLength(MAX_ENTRIES);
    clearHistory();
    expect(readHistory()).toEqual([]);
  });

  it('survives broken storage content', () => {
    localStorage.setItem('tm-settings-history', '{broken');
    expect(readHistory()).toEqual([]);
    localStorage.setItem(
      'tm-settings-history',
      JSON.stringify([{ id: 1 }, { id: 'a', at: 1, label: 'x', undo: {} }]),
    );
    expect(readHistory()).toHaveLength(1);
  });
});
