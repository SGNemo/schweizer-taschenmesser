// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearRecent } from '@/core/search/recent';
import { clearFrequent, frequentSections, MIN_VISITS, recordSectionVisit } from './frequent';

const visit = (id: string, times: number) => {
  for (let i = 0; i < times; i++) recordSectionVisit(id);
};

beforeEach(() => localStorage.clear());

describe('frequently used settings', () => {
  it('lists nothing after a single visit', () => {
    visit('backup', MIN_VISITS - 1);
    expect(frequentSections(['backup'])).toEqual([]);
  });

  it('orders by visits, then by most recent, and only lists known sections', () => {
    visit('backup', 3);
    visit('updates', 3);
    visit('appearance', 5);
    visit('gone', 9);
    expect(frequentSections(['backup', 'updates', 'appearance'])).toEqual([
      'appearance',
      'updates',
      'backup',
    ]);
  });

  it('caps the list', () => {
    for (let i = 0; i < 8; i++) visit(`s${i}`, 2);
    expect(frequentSections(Array.from({ length: 8 }, (_, i) => `s${i}`))).toHaveLength(5);
  });

  it('stays on the device: only localStorage under its own key is touched', () => {
    visit('backup', 2);
    expect(Object.keys(localStorage)).toEqual(['tm-frequent-settings']);
  });

  it('is emptied by clearing the history, and survives broken storage content', () => {
    visit('backup', 2);
    clearRecent();
    expect(frequentSections(['backup'])).toEqual([]);
    localStorage.setItem('tm-frequent-settings', '{not json');
    expect(frequentSections(['backup'])).toEqual([]);
    clearFrequent();
  });
});
