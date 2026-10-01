// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useUiStore } from './ui';

describe('reading comfort settings', () => {
  afterEach(() => {
    useUiStore.getState().setTextSize('normal');
    useUiStore.getState().setDensity('normal');
  });

  it('text size and density set an attribute on <html> and persist; the defaults remove it', () => {
    const { setTextSize, setDensity } = useUiStore.getState();
    setTextSize('large');
    setDensity('compact');
    expect(document.documentElement.dataset.textSize).toBe('large');
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(localStorage.getItem('tm-text-size')).toBe('large');
    expect(localStorage.getItem('tm-density')).toBe('compact');
    setTextSize('normal');
    setDensity('normal');
    expect(document.documentElement.dataset.textSize).toBeUndefined();
    expect(document.documentElement.dataset.density).toBeUndefined();
    expect(localStorage.getItem('tm-text-size')).toBeNull();
  });
});
