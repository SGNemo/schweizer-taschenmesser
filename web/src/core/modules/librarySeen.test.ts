// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { libraryBadges, markLibrarySeen } from './librarySeen';

const m = (id: string, version = 1) => ({ id, version });

beforeEach(() => localStorage.clear());

describe('library marks', () => {
  it('marks nothing on the very first look (an existing installation has seen everything)', () => {
    expect(libraryBadges([m('a'), m('b')])).toEqual({});
  });

  it('marks a module that appeared and one whose version went up, until the library was looked at', () => {
    markLibrarySeen([m('a'), m('b')]);
    expect(libraryBadges([m('a'), m('b', 2), m('c')])).toEqual({ b: 'updated', c: 'new' });
    markLibrarySeen([m('a'), m('b', 2), m('c')]);
    expect(libraryBadges([m('a'), m('b', 2), m('c')])).toEqual({});
  });

  it('stays on the device and survives broken storage content', () => {
    markLibrarySeen([m('a')]);
    expect(Object.keys(localStorage)).toEqual(['tm-library-seen']);
    localStorage.setItem('tm-library-seen', '[1,2');
    expect(libraryBadges([m('a')])).toEqual({});
  });
});
