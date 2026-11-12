// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { InboxFigure } from '../components/InboxHead';
import { readSearches, rememberSearch, suggestionsFor } from '../searchHistory';

describe('InboxFigure (head figure)', () => {
  it('shows the unread count with its unit and the inbox as context, as real text', () => {
    render(<InboxFigure unread={3} />);
    const figure = screen.getByTestId('mail-stamp');
    expect(figure).toHaveTextContent('3');
    expect(figure).toHaveTextContent('ungelesen');
    expect(figure).toHaveTextContent('Posteingang');
  });

  it('draws no figure and no zero when nothing is unread', () => {
    render(<InboxFigure unread={0} />);
    expect(screen.queryByTestId('mail-stamp')).toBeNull();
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
