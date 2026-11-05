// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const withBuilds: ChangelogData = {
  areas: data.areas,
  versions: [
    {
      version: 'unreleased',
      date: '',
      entries: [
        { ...e('three', 'drei'), build: 686 },
        { ...e('two', 'zwei'), build: 685 },
        { ...e('one', 'eins'), build: 683 },
        e('local', 'lokal'),
      ],
    },
    data.versions[2]!,
  ],
};

describe('ChangelogHistory every build number', () => {
  it('has a row for every build, a quiet line where there is no note, and loads 30 more on request', async () => {
    const builds = Array.from({ length: 45 }, (_, i) => 745 - i); // 745 … 701
    const many: ChangelogData = {
      areas: data.areas,
      versions: [
        {
          version: 'unreleased',
          date: '',
          builds,
          entries: [
            { ...e('even', 'gerade'), build: 744 },
            { ...e('low', 'tief'), build: 702 },
          ],
        },
        data.versions[2]!,
      ],
    };
    vi.resetModules();
    vi.doMock('@/core/changelog/load', () => ({ loadChangelog: async () => many }));
    const { ChangelogHistory: History } = await import('./ChangelogHistory');
    render(<History version="1.0.0-dev.744+abc" />);
    await waitFor(() => expect(screen.getByTestId('changelog-history')).toBeTruthy());
    const box = screen.getByTestId('changelog-history');
    // 30 rows at first: a card for 744, quiet lines for the others; the installed build carries its mark.
    expect(within(box).getAllByTestId(/^history-(build|empty)/)).toHaveLength(30);
    expect(within(box).getByTestId('history-build-744')).toBeTruthy();
    expect(within(box).getByTestId('history-empty-745')).toBeTruthy();
    expect(within(box).queryByTestId('history-build-702')).toBeNull(); // not loaded yet
    const more = within(box).getByRole('button', { name: /anzeigen \(15\)/ });
    await userEvent.click(more);
    expect(within(box).getAllByTestId(/^history-(build|empty)/)).toHaveLength(45);
    expect(within(box).getByTestId('history-build-702')).toBeTruthy();
    expect(within(box).getAllByTestId(/^history-(build|empty)/)).toHaveLength(45);
    vi.doUnmock('@/core/changelog/load');
  });
});

describe('ChangelogHistory per build', () => {
  it('shows one card per Dev-Preview build, newest first, marks the installed one, local notes last', async () => {
    vi.doMock('@/core/changelog/load', () => ({ loadChangelog: async () => withBuilds }));
    vi.resetModules();
    const { ChangelogHistory: History } = await import('./ChangelogHistory');
    render(<History version="1.0.0-dev.683+abc1234" />);
    await waitFor(() => expect(screen.getByTestId('changelog-history')).toBeTruthy());
    const ids = within(screen.getByTestId('changelog-history'))
      .getAllByTestId(/^history-/)
      .map((c) => c.getAttribute('data-testid'));
    expect(ids).toEqual([
      'history-build-686',
      'history-build-685',
      'history-build-683',
      'history-unreleased',
      'history-1.0.0',
    ]);
    expect(within(screen.getByTestId('history-build-683')).getByText(/installiert/)).toBeTruthy();
    expect(within(screen.getByTestId('history-build-686')).queryByText(/installiert/)).toBeNull();
    expect(within(screen.getByTestId('history-build-686')).getByText(/drei/)).toBeTruthy();
    vi.doUnmock('@/core/changelog/load');
  });
});

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
