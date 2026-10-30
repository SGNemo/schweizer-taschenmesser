// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backDepth, pushBack, releaseBack, resetBackStack } from './backStack';

const popped = () =>
  new Promise<void>((r) => window.addEventListener('popstate', () => r(), { once: true }));
const settle = () => new Promise((r) => setTimeout(r, 20));

beforeEach(async () => {
  resetBackStack();
  history.replaceState(null, '', '/');
});
afterEach(() => resetBackStack());

describe('backStack', () => {
  it('a synthetic popstate (a URL re-announced for the router) is not a Back', () => {
    const close = vi.fn();
    pushBack('a', close);
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    expect(close).not.toHaveBeenCalled();
    expect(backDepth()).toBe(1);
  });

  it('adds one history entry per element, none for a second registration', () => {
    const before = history.length;
    pushBack('a', () => undefined);
    pushBack('a', () => undefined);
    expect(history.length).toBe(before + 1);
    expect(backDepth()).toBe(1);
  });

  it('Back closes the topmost element first, then the next', async () => {
    const closed: string[] = [];
    pushBack('a', () => void closed.push('a'));
    pushBack('b', () => void closed.push('b'));
    const p1 = popped();
    history.back();
    await p1;
    expect(closed).toEqual(['b']);
    const p2 = popped();
    history.back();
    await p2;
    expect(closed).toEqual(['b', 'a']);
    expect(backDepth()).toBe(0);
  });

  it('closing by button removes the entry again and does not close anything else', async () => {
    const other = vi.fn();
    pushBack('a', other);
    expect(history.state?.tmBack).toBe('a');
    releaseBack('a');
    await settle();
    expect(history.state?.tmBack).toBeUndefined();
    expect(other).not.toHaveBeenCalled();
    expect(backDepth()).toBe(0);
  });

  it("a handler answering 'keep' stays open and keeps its entry", async () => {
    const close = vi.fn(() => 'keep' as const);
    pushBack('a', close);
    const p = popped();
    history.back();
    await p;
    expect(close).toHaveBeenCalledTimes(1);
    expect(backDepth()).toBe(1);
    expect(history.state?.tmBack).toBe('a');
  });

  it('a push right after a release waits until the release has settled', async () => {
    pushBack('a', () => undefined);
    releaseBack('a');
    pushBack('b', () => undefined);
    await settle();
    expect(history.state?.tmBack).toBe('b');
    expect(backDepth()).toBe(1);
  });

  it('steps over a marker nobody owns any more', async () => {
    pushBack('a', () => undefined);
    // The router moved on while "a" was open, then "a" closed: marker below, not on top.
    history.pushState({ idx: 5 }, '', '/next');
    releaseBack('a');
    expect(history.state?.tmBack).toBeUndefined();
    history.back(); // lands on the stale marker
    await settle();
    expect(history.state?.tmBack).toBeUndefined();
    expect(location.pathname).toBe('/');
  });
});

describe('backStack and the router', () => {
  it('an entry the router replaced in place (same idx) is still removed on release', async () => {
    history.replaceState({ idx: 3 }, '', '/bookmarks?new=1');
    pushBack('a', () => undefined);
    history.replaceState({ idx: 3 }, '', '/bookmarks'); // setParams({}, { replace: true })
    releaseBack('a');
    await settle();
    expect(history.state?.idx).toBe(3);
    expect(history.state?.tmBack).toBeUndefined();
    expect(backDepth()).toBe(0);
    // The entry below showed `?new=1`; it now shows what the router had made of ours.
    expect(location.pathname + location.search).toBe('/bookmarks');
  });

  it('a page the router pushed after the entry is left alone', async () => {
    history.replaceState({ idx: 3 }, '', '/a');
    pushBack('a', () => undefined);
    history.pushState({ idx: 4 }, '', '/b');
    releaseBack('a');
    await settle();
    expect(location.pathname).toBe('/b');
  });
});
