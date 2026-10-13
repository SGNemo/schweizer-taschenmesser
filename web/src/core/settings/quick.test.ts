// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/stores/ui';
import { applyQuick, optionLabel, QUICK_SETTINGS } from './quick';

const byId = (id: string) => QUICK_SETTINGS.find((q) => q.id === id)!;

beforeEach(() => {
  localStorage.clear();
  useUiStore.setState({ toasts: [] });
  useUiStore.getState().setTheme('system');
  useUiStore.getState().setDensity('normal');
  useUiStore.getState().setReadAid(false);
});

describe('quick switches', () => {
  it('only offers the appearance allow-list, never anything security related', () => {
    expect(QUICK_SETTINGS.map((q) => q.id).sort()).toEqual(
      ['color', 'density', 'homeView', 'readAid', 'theme'].sort(),
    );
    for (const q of QUICK_SETTINGS) expect(q.path).toMatch(/^\/settings\/darstellung#/);
  });

  it('each option is readable back after writing it', () => {
    for (const q of QUICK_SETTINGS) {
      for (const o of q.options()) {
        q.write(o.value);
        expect(q.read()).toBe(o.value);
      }
    }
  });

  it('applies a value, confirms with a toast and the toast action restores the old value', () => {
    applyQuick(byId('theme'), 'dark');
    expect(useUiStore.getState().theme).toBe('dark');
    const toast = useUiStore.getState().toasts.at(-1)!;
    expect(toast.message).toContain(optionLabel(byId('theme'), 'dark'));
    toast.action!.run();
    expect(useUiStore.getState().theme).toBe('system');
  });

  it('does nothing (and shows no toast) when the value is already set', () => {
    applyQuick(byId('density'), 'normal');
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });

  it('switches the reading aid on and off', () => {
    applyQuick(byId('readAid'), 'on');
    expect(useUiStore.getState().readAid).toBe(true);
    applyQuick(byId('readAid'), 'off');
    expect(useUiStore.getState().readAid).toBe(false);
  });
});
