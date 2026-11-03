// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Stamp } from '../components/Stamp';
import { readSearches, rememberSearch, suggestionsFor } from '../searchHistory';

describe('Stamp (signature)', () => {
  it('shows the unread count as real text; the perforated frame is decoration', () => {
    render(<Stamp count={3} label="Ungelesen" context="3 ungelesene Mails im Posteingang" />);
    const stamp = screen.getByTestId('mail-stamp');
    expect(stamp).toHaveTextContent('3');
    expect(stamp).toHaveTextContent('Ungelesen');
    expect(stamp.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(stamp.querySelector('img, svg, canvas')).toBeNull();
  });

  it('says so in words when nothing is unread', () => {
    render(<Stamp count={0} label="Ungelesen" context="Alles gelesen" />);
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
