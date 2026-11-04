// @vitest-environment jsdom
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { sharedQueryCount, useSharedLiveQuery } from './sharedQuery';

// Dexie runs the very first live query after the database was opened twice; start warm to count runs.
beforeAll(async () => {
  await db.open();
  await db.table('example_entry').get('warm');
});

afterEach(async () => {
  cleanup();
  await db.table('example_entry').clear();
  await waitFor(() => expect(sharedQueryCount()).toBe(0));
});

const read = (key: string) => async () =>
  (await db.table('example_entry').get(key))?.value as number | undefined;

describe('useSharedLiveQuery', () => {
  it('runs one query for several hook instances with the same key', async () => {
    const querier = vi.fn(async () => (await db.table('example_entry').get('a'))?.value ?? 0);
    const views = [1, 2, 3].map(() => renderHook(() => useSharedLiveQuery('same', querier)));
    await waitFor(() => views.forEach((v) => expect(v.result.current).toBe(0)));
    expect(querier).toHaveBeenCalledTimes(1);
    expect(sharedQueryCount()).toBe(1);

    await act(async () => {
      await db.table('example_entry').put({ id: 'a', value: 5 });
    });
    await waitFor(() => views.forEach((v) => expect(v.result.current).toBe(5)));
    expect(querier).toHaveBeenCalledTimes(2); // one re-run for all three, not three
  });

  it('re-runs on a write even when the query awaits a non-Dexie promise first', async () => {
    // Contribution sources `await import(...)` before they read the tables. Dexie only tracks those
    // reads when it is given a native async function (a plain wrapper loses the tracking). Node keeps
    // the tracking either way, so this is a behaviour guard; the browser run that fails without the
    // `async` wrapper is e2e/now-strip.spec.ts.
    const querier = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return (await db.table('example_entry').get('late-read'))?.value ?? 0;
    };
    const { result } = renderHook(() => useSharedLiveQuery('after-await', querier));
    await waitFor(() => expect(result.current).toBe(0));
    await act(async () => {
      await db.table('example_entry').put({ id: 'late-read', value: 9 });
    });
    await waitFor(() => expect(result.current).toBe(9));
  });

  it('is undefined until the first result and gives a late subscriber the current value', async () => {
    await db.table('example_entry').put({ id: 'b', value: 7 });
    const first = renderHook(() => useSharedLiveQuery('late', read('b')));
    expect(first.result.current).toBeUndefined();
    await waitFor(() => expect(first.result.current).toBe(7));
    const second = renderHook(() => useSharedLiveQuery('late', read('b')));
    await waitFor(() => expect(second.result.current).toBe(7));
  });

  it('keeps the previous result while another key loads, like useLiveQuery', async () => {
    await db.table('example_entry').put({ id: 'x', value: 1 });
    await db.table('example_entry').put({ id: 'y', value: 2 });
    const { result, rerender } = renderHook(({ k }) => useSharedLiveQuery(k, read(k)), {
      initialProps: { k: 'x' },
    });
    await waitFor(() => expect(result.current).toBe(1));
    rerender({ k: 'y' });
    expect(result.current).toBe(1); // not undefined in between
    await waitFor(() => expect(result.current).toBe(2));
  });

  it('stops the query shortly after the last subscriber left', async () => {
    const view = render(<Probe k="gone" />);
    await waitFor(() => expect(sharedQueryCount()).toBe(1));
    view.unmount();
    await waitFor(() => expect(sharedQueryCount()).toBe(0));
  });

  it('throws a failing query into the error boundary', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = render(
      <Boundary>
        <Failing />
      </Boundary>,
    );
    await waitFor(() => expect(view.getByText('caught: boom')).toBeTruthy());
    spy.mockRestore();
  });
});

class Boundary extends Component<{ children: ReactNode }, { message?: string }> {
  override state: { message?: string } = {};
  static getDerivedStateFromError(e: Error) {
    return { message: e.message };
  }
  override render() {
    return this.state.message ? `caught: ${this.state.message}` : this.props.children;
  }
}

function Failing() {
  useSharedLiveQuery('fails', async () => {
    throw new Error('boom');
  });
  return null;
}

function Probe({ k }: { k: string }) {
  useSharedLiveQuery(k, async () => 1);
  return null;
}
