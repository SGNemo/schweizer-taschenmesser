// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { anyLoading, useBackupLine, useRead, useSettled, type StatusLine } from './lines';

function Backup({ seen }: { seen: StatusLine[] }) {
  const line = useBackupLine();
  seen.push(line);
  return <p data-testid="backup">{line.loading ? 'loading' : line.status}</p>;
}

afterEach(async () => {
  vi.useRealTimers();
  await db.table('_meta').delete('backup.file.last');
});

describe('status lines while they load', () => {
  it('the backup line has no words before the last backup is read: never "Kein Backup" first', async () => {
    await db.table('_meta').put({ key: 'backup.file.last', value: { at: 1_800_000_000_000 } });
    const seen: StatusLine[] = [];
    render(<Backup seen={seen} />);
    expect(screen.getByTestId('backup')).toHaveTextContent('loading');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(screen.getByTestId('backup')).toHaveTextContent('Gesichert');
    expect(seen[0]).toMatchObject({ loading: true, status: '', context: '', attention: false });
    expect(seen.map((l) => l.status)).not.toContain('Kein Backup');
  });

  it('"Kein Backup" once the read found none', async () => {
    render(<Backup seen={[]} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(screen.getByTestId('backup')).toHaveTextContent('Kein Backup');
  });

  it('a failed read is done as well (it never holds a list back); no read at all is done at once', async () => {
    const results: { done: boolean; value: unknown }[] = [];
    function Probe({ read }: { read: (() => Promise<number>) | undefined }) {
      results.push(useRead(read));
      return null;
    }
    render(<Probe read={() => Promise.reject(new Error('no'))} />);
    expect(results.at(-1)).toEqual({ value: undefined, done: false });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(results.at(-1)).toEqual({ value: undefined, done: true });
    results.length = 0;
    render(<Probe read={undefined} />);
    expect(results[0]).toEqual({ value: undefined, done: true });
  });

  it('a list settles when nothing loads, or after the wait; then it stays settled', () => {
    vi.useFakeTimers();
    const states: boolean[] = [];
    function Probe({ ready }: { ready: boolean }) {
      states.push(useSettled(ready, 1000));
      return null;
    }
    const view = render(<Probe ready={false} />);
    expect(states.at(-1)).toBe(false);
    act(() => vi.advanceTimersByTime(999));
    expect(states.at(-1)).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(states.at(-1)).toBe(true);
    view.unmount();
    states.length = 0;
    const again = render(<Probe ready={false} />);
    again.rerender(<Probe ready />);
    expect(states.at(-1)).toBe(true);
    again.rerender(<Probe ready={false} />);
    expect(states.at(-1)).toBe(true);
  });

  it('anyLoading looks at the lines that exist', () => {
    const line = { loading: true } as StatusLine;
    expect(anyLoading([undefined, { ...line, loading: undefined }])).toBe(false);
    expect(anyLoading([undefined, line])).toBe(true);
  });
});
