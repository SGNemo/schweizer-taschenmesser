// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREVIEW_MS, applyPalette, effectivePalette, usePaletteStore } from './palette';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  usePaletteStore.setState({ chosen: null, preview: null, logoThemed: false });
  applyPalette(null);
});
afterEach(() => vi.useRealTimers());

describe('palette state', () => {
  it('a non-supporter only ever sees a theme through the preview', () => {
    expect(effectivePalette(false, 'sand', null)).toBeNull();
    expect(effectivePalette(false, 'sand', 'tiefsee')).toBe('tiefsee');
    expect(effectivePalette(true, 'sand', null)).toBe('sand');
    expect(effectivePalette(true, null, null)).toBeNull();
  });

  it('the preview ends by itself after 30 seconds and is never stored', () => {
    usePaletteStore.getState().startPreview('nordlicht');
    expect(usePaletteStore.getState().preview).toBe('nordlicht');
    expect(localStorage.getItem('tm-palette')).toBeNull();
    vi.advanceTimersByTime(PREVIEW_MS - 1);
    expect(usePaletteStore.getState().preview).toBe('nordlicht');
    vi.advanceTimersByTime(1);
    expect(usePaletteStore.getState().preview).toBeNull();
  });

  it('starting another preview restarts the 30 seconds; stopping cancels it', () => {
    const s = usePaletteStore.getState();
    s.startPreview('sand');
    vi.advanceTimersByTime(20_000);
    s.startPreview('tiefsee');
    vi.advanceTimersByTime(20_000);
    expect(usePaletteStore.getState().preview).toBe('tiefsee');
    s.stopPreview();
    expect(usePaletteStore.getState().preview).toBeNull();
    vi.advanceTimersByTime(PREVIEW_MS);
    expect(usePaletteStore.getState().preview).toBeNull();
  });

  it('choose stores the id (and removes it again), logo variant is a plain flag', () => {
    const s = usePaletteStore.getState();
    s.choose('monochrom');
    expect(localStorage.getItem('tm-palette')).toBe('monochrom');
    s.choose(null);
    expect(localStorage.getItem('tm-palette')).toBeNull();
    s.setLogoThemed(true);
    expect(localStorage.getItem('tm-logo')).toBe('themed');
    s.setLogoThemed(false);
    expect(localStorage.getItem('tm-logo')).toBeNull();
  });

  it('applyPalette sets and clears data-palette and data-logo on <html>', () => {
    applyPalette('sand', true);
    expect(document.documentElement.dataset.palette).toBe('sand');
    expect(document.documentElement.dataset.logo).toBe('themed');
    applyPalette(null, true);
    expect(document.documentElement.dataset.palette).toBeUndefined();
    expect(document.documentElement.dataset.logo).toBeUndefined();
  });
});
