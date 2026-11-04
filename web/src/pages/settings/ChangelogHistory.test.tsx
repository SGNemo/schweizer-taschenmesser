// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChangelogData } from '@/core/changelog/types';
import { ChangelogHistory } from './ChangelogHistory';

const e = (en: string, de: string) => ({
  type: 'added' as const,
  area: 'calendar',
  breaking: false,
  highlight: false,
  de,
  en,
});
const data: ChangelogData = {
  areas: { calendar: { de: 'Kalender', en: 'Calendar' } },
  versions: [
    { version: 'unreleased', date: '', entries: [e('open note', 'offene Notiz')] },
    {
      version: '1.1.0',
      date: '2026-11-10',
      entries: [e('newer than running', 'neuer als laufend')],
    },
    { version: '1.0.0', date: '2026-10-07', entries: [e('running note', 'laufende Notiz')] },
    { version: '0.3.1', date: '2026-10-01', entries: [e('old note', 'alte Notiz')] },
  ],
};
vi.mock('@/core/changelog/load', () => ({ loadChangelog: async () => data }));

describe('ChangelogHistory', () => {
  it('lists the latest versions newest first, all open, without versions newer than the build', async () => {
    render(<ChangelogHistory version="1.0.0" />);
    await waitFor(() => expect(screen.getByTestId('changelog-history')).toBeTruthy());
    const cards = within(screen.getByTestId('changelog-history')).getAllByTestId(/^history-/);
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual([
      'history-unreleased',
      'history-1.0.0',
      'history-0.3.1',
    ]);
    // Everything is on the page (no folded details): the notes of every shown version are visible text.
    expect(screen.getByText(/offene Notiz/)).toBeTruthy();
    expect(screen.getByText(/laufende Notiz/)).toBeTruthy();
    expect(screen.getByText(/alte Notiz/)).toBeTruthy();
    expect(screen.queryByText(/neuer als laufend/)).toBeNull();
    expect(document.querySelector('details')).toBeNull();
  });
});
