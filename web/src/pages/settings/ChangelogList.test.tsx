// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ChangelogData } from '@/core/changelog/types';
import { loadSeen } from '@/core/changelog/seen';
import { ChangelogList } from './ChangelogList';

const entry = (en: string, area = 'calendar') => ({
  type: 'added' as const,
  area,
  breaking: false,
  highlight: false,
  de: `de ${en}`,
  en,
});
const data: ChangelogData = {
  areas: { calendar: { de: 'Kalender', en: 'Calendar' } },
  versions: [
    { version: 'unreleased', date: '', entries: [entry('open note')] },
    { version: '1.1.0', date: '2026-11-10', entries: [entry('newer than running')] },
    { version: '1.0.0', date: '2026-10-07', entries: [entry('running note')] },
    { version: '0.3.1', date: '2026-10-01', entries: [entry('old note')] },
  ],
};
const gate = vi.hoisted(() => ({ wait: undefined as Promise<void> | undefined }));
vi.mock('@/core/changelog/load', () => ({
  loadChangelog: async () => {
    await gate.wait;
    return data;
  },
}));

describe('ChangelogList', () => {
  it('shows exactly the running version, unreleased on top, older folded, newer hidden', async () => {
    render(<ChangelogList version="1.0.0" />);
    await waitFor(() => expect(screen.getByTestId('changelog-1.0.0')).toBeTruthy());
    expect(screen.getByTestId('changelog-1.0.0').textContent).toContain('running note');
    expect(screen.getByTestId('changelog-unreleased').textContent).toContain('open note');
    expect(screen.getByTestId('changelog-0.3.1').textContent).toContain('old note');
    expect(screen.queryByText(/newer than running/)).toBeNull();
  });
  it('marks the newest notes new until you leave or open a version, and remembers it', async () => {
    const { unmount } = render(<ChangelogList version="1.0.0" />);
    await waitFor(() => expect(screen.getByTestId('changelog-new')).toBeTruthy());
    // The unreleased notes are the newest and open; the mark sits on them.
    expect(
      screen.getByTestId('changelog-unreleased').contains(screen.getByTestId('changelog-new')),
    ).toBe(true);
    await userEvent.click(screen.getByText(/Version 1\.0\.0/));
    await waitFor(async () => expect(await loadSeen()).toContain('1.0.0'));
    unmount();
    await waitFor(async () =>
      expect((await loadSeen()).some((x) => x.startsWith('unreleased:'))).toBe(true),
    );
    render(<ChangelogList version="1.0.0" />);
    await waitFor(() => expect(screen.getByTestId('changelog-1.0.0')).toBeTruthy());
    expect(screen.queryByTestId('changelog-new')).toBeNull();
  });
});

describe('ChangelogList teardown', () => {
  it('does not update state after it was unmounted (a late result must not reach a torn-down DOM)', async () => {
    const errors: unknown[] = [];
    const onRejection = (e: unknown) => errors.push(e);
    process.on('unhandledRejection', onRejection);
    let release!: () => void;
    gate.wait = new Promise<void>((r) => (release = r));
    const { unmount } = render(<ChangelogList version="1.0.0" />);
    unmount(); // the data load is still in flight
    // The environment is torn down at the end of a test file: `window` is gone when the result arrives.
    vi.stubGlobal('window', undefined);
    release();
    // Only the promise callbacks run in this window-less span (React's own scheduler tasks come later).
    for (let i = 0; i < 20; i++) await Promise.resolve();
    vi.unstubAllGlobals();
    await new Promise((r) => setTimeout(r, 100));
    gate.wait = undefined;
    process.off('unhandledRejection', onRejection);
    expect(errors).toEqual([]);
  });
});
