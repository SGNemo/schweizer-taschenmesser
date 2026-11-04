// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { Profiler, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPageWidthStore, PageWidthContext, usePageWidthAtLeast } from './pageWidth';
import { SPLIT_PAGE_REM, useSplitView } from './Patterns';

afterEach(cleanup);

/** The window says wide or narrow (`matchMedia`), independent of the page. */
function windowIs(wide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function Probe({ rem = 10 }: { rem?: number }) {
  return <p data-testid="probe">{String(usePageWidthAtLeast(rem))}</p>;
}
function Split({ query }: { query?: string }) {
  return <p data-testid="split">{String(useSplitView(query))}</p>;
}
const inPage = (width: number | undefined, ui: ReactNode) => {
  const store = createPageWidthStore();
  if (width !== undefined) store.set(width);
  return {
    store,
    ...render(<PageWidthContext.Provider value={store}>{ui}</PageWidthContext.Provider>),
  };
};

describe('page width store', () => {
  it('tells listeners only when the width changed', () => {
    const store = createPageWidthStore();
    const seen = vi.fn();
    const off = store.subscribe(seen);
    store.set(800);
    store.set(800);
    store.set(900);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(store.get()).toBe(900);
    off();
    store.set(1000);
    expect(seen).toHaveBeenCalledTimes(2);
  });
});

describe('usePageWidthAtLeast', () => {
  it('is undefined outside a page container and before the first measurement', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('undefined');
    cleanup();
    inPage(undefined, <Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('undefined');
  });

  it('follows the page width in rem and re-renders only across the threshold', () => {
    const commits = vi.fn();
    const { store } = inPage(
      400,
      <Profiler id="probe" onRender={commits}>
        <Probe rem={30} />
      </Profiler>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('false');
    const after = commits.mock.calls.length;
    act(() => store.set(420));
    act(() => store.set(440));
    // 30 rem are 480 px at the 16 px root: still narrower, so nothing to render again.
    expect(commits.mock.calls.length).toBe(after);
    act(() => store.set(900));
    expect(screen.getByTestId('probe').textContent).toBe('true');
    expect(commits.mock.calls.length).toBe(after + 1);
  });
});

describe('useSplitView', () => {
  beforeEach(() => windowIs(true));
  afterEach(() => vi.unstubAllGlobals());

  it('outside a page container it follows the window', () => {
    render(<Split />);
    expect(screen.getByTestId('split').textContent).toBe('true');
    cleanup();
    windowIs(false);
    render(<Split />);
    expect(screen.getByTestId('split').textContent).toBe('false');
  });

  it('inside a page container the room of the page decides, not the window', () => {
    const rem = 16;
    const { store } = inPage(SPLIT_PAGE_REM * rem - 1, <Split />);
    expect(screen.getByTestId('split').textContent).toBe('false');
    act(() => store.set(SPLIT_PAGE_REM * rem));
    expect(screen.getByTestId('split').textContent).toBe('true');
    cleanup();
    windowIs(false);
    inPage(SPLIT_PAGE_REM * rem + 200, <Split />);
    expect(screen.getByTestId('split').textContent).toBe('true');
  });

  it('an explicit query still means the window', () => {
    windowIs(false);
    inPage(2000, <Split query="(min-width: 1500px)" />);
    expect(screen.getByTestId('split').textContent).toBe('false');
  });
});
