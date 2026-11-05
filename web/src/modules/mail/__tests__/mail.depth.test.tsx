// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { InboxStamp } from '../components/InboxHead';
import { readSearches, rememberSearch, suggestionsFor } from '../searchHistory';

describe('InboxStamp (head figure)', () => {
  it('shows the unread count as real text beside the stamp; the stamp is decoration', () => {
    render(<InboxStamp unread={3} />);
    const stamp = screen.getByTestId('mail-stamp');
    expect(stamp).toHaveTextContent('3 ungelesene Threads');
    expect(stamp).toHaveTextContent('Posteingang');
    expect(stamp.querySelector('[data-signature="stamp"][aria-hidden="true"]')).not.toBeNull();
  });

  it('says so in words when nothing is unread', () => {
    render(<InboxStamp unread={0} />);
    expect(screen.getByTestId('mail-stamp')).toHaveTextContent('Alles gelesen');
  });
});

describe('search history and suggestions', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the last five distinct searches, newest first, on this device only', () => {
    for (const q of ['a', 'b', 'c', 'd', 'e', 'f', 'B']) rememberSearch(q);
    expect(readSearches()).toEqual(['B', 'f', 'e', 'd', 'c']);
    expect(rememberSearch('  ')).toEqual(['B', 'f', 'e', 'd', 'c']);
  });

  it('survives unreadable storage', () => {
    localStorage.setItem('tm-mail-searches', '{nope');
    expect(readSearches()).toEqual([]);
  });

  it('suggests recent searches and senders that match what is typed, quoting names with spaces', () => {
    const out = suggestionsFor('ann', ['from:anna', 'rechnung'], ['Anna Beispiel', 'Max Muster']);
    expect(out).toEqual(['from:anna', 'from:"Anna Beispiel"']);
    expect(suggestionsFor('', ['x'], ['Max']).slice(0, 2)).toEqual(['x', 'from:Max']);
    expect(
      suggestionsFor(
        '',
        [],
        Array.from({ length: 20 }, (_, i) => `N${i}`),
      ),
    ).toHaveLength(8);
  });
});
