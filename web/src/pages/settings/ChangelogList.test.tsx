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
vi.mock('@/core/changelog/load', () => ({ loadChangelog: async () => data }));

describe('ChangelogList', () => {
  it('shows exactly the running version, unreleased on top, older folded, newer hidden', async () => {
    render(<ChangelogList version="1.0.0" />);
    await waitFor(() => expect(screen.getByTestId('changelog-1.0.0')).toBeTruthy());
    expect(screen.getByTestId('changelog-1.0.0').textContent).toContain('running note');
    expect(screen.getByTestId('changelog-unreleased').textContent).toContain('open note');
    expect(screen.getByTestId('changelog-0.3.1').textContent).toContain('old note');
    expect(screen.queryByText(/newer than running/)).toBeNull();
  });
  it('marks the running version new until it was opened, then remembers it', async () => {
    render(<ChangelogList version="1.0.0" />);
    await waitFor(() => expect(screen.getByTestId('changelog-new')).toBeTruthy());
    await userEvent.click(screen.getByText(/1\.0\.0 ·|\(1\.0\.0/));
    await waitFor(async () => expect(await loadSeen()).toContain('1.0.0'));
    await waitFor(() => expect(screen.queryByTestId('changelog-new')).toBeNull());
  });
});
