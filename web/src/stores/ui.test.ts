// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useUiStore } from './ui';

describe('reading comfort settings', () => {
  afterEach(() => {
    useUiStore.getState().setTextSize('normal');
    useUiStore.getState().setDensity('normal');
    useUiStore.getState().setLeading('normal');
    useUiStore.getState().setMotion('system');
    useUiStore.getState().setHomeView('all');
  });

  it('has a third text size, line spacing and an in-app motion switch (device-local, defaults remove the key)', () => {
    const ui = useUiStore.getState();
    ui.setTextSize('xlarge');
    ui.setLeading('airy');
    ui.setMotion('reduce');
    ui.setHomeView('calm');
    expect(document.documentElement.dataset.textSize).toBe('xlarge');
    expect(document.documentElement.dataset.leading).toBe('airy');
    expect(document.documentElement.dataset.motion).toBe('reduce');
    expect(localStorage.getItem('tm-text-size')).toBe('xlarge');
    expect(localStorage.getItem('tm-leading')).toBe('airy');
    expect(localStorage.getItem('tm-motion')).toBe('reduce');
    expect(localStorage.getItem('tm-home-view')).toBe('calm');
    ui.setTextSize('normal');
    ui.setLeading('normal');
    ui.setMotion('system');
    ui.setHomeView('all');
    expect(document.documentElement.dataset.leading).toBeUndefined();
    expect(document.documentElement.dataset.motion).toBeUndefined();
    for (const k of ['tm-text-size', 'tm-leading', 'tm-motion', 'tm-home-view'])
      expect(localStorage.getItem(k)).toBeNull();
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

describe('sidebar state', () => {
  afterEach(() => {
    useUiStore.getState().setSidebar('wide');
    useUiStore.setState({ closedAreas: [] });
    localStorage.clear();
  });

  it('the rail choice persists and the default removes the key', () => {
    useUiStore.getState().setSidebar('narrow');
    expect(useUiStore.getState().sidebar).toBe('narrow');
    expect(localStorage.getItem('tm-sidebar')).toBe('narrow');
    useUiStore.getState().setSidebar('wide');
    expect(localStorage.getItem('tm-sidebar')).toBeNull();
  });

  it('folded areas toggle and persist', () => {
    useUiStore.getState().toggleAreaOpen('money');
    expect(useUiStore.getState().closedAreas).toEqual(['money']);
    expect(JSON.parse(localStorage.getItem('tm-nav-closed')!)).toEqual(['money']);
    useUiStore.getState().toggleAreaOpen('money');
    expect(useUiStore.getState().closedAreas).toEqual([]);
    expect(localStorage.getItem('tm-nav-closed')).toBeNull();
  });
});
