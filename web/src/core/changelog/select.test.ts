import { describe, expect, it } from 'vitest';
import { entryText, groupForDisplay, newToken, selectChangelog, stripBuild } from './select';
import { isUnread } from './seen';
import type { ChangelogData, ChangelogEntry } from './types';

const entry = (p: Partial<ChangelogEntry>): ChangelogEntry => ({
  type: 'added',
  area: 'calendar',
  breaking: false,
  highlight: false,
  de: 'de',
  en: 'en',
  ...p,
});
const data: ChangelogData = {
  areas: { calendar: { de: 'Kalender', en: 'Calendar' }, ai: { de: 'KI', en: 'AI' } },
  versions: [
    { version: 'unreleased', date: '', entries: [entry({ en: 'open' })] },
    { version: '1.1.0', date: '2026-11-10', entries: [entry({ en: 'one-one' })] },
    { version: '1.0.0', date: '2026-10-07', entries: [entry({ en: 'one-zero' })] },
    { version: '0.3.1', date: '2026-10-01', entries: [entry({ en: 'zero' })] },
  ],
};

describe('selectChangelog', () => {
  it('stable: the running version is current, older ones follow, newer ones are hidden', () => {
    const v = selectChangelog(data, '1.0.0');
    expect(v.current?.entries.map((e) => e.en)).toEqual(['one-zero']);
    expect(v.older.map((x) => x.version)).toEqual(['0.3.1']);
  });
  it('stable build holding 1.1.0', () => {
    const v = selectChangelog(data, '1.1.0');
    expect(v.current?.version).toBe('1.1.0');
    expect(v.older.map((x) => x.version)).toEqual(['1.0.0', '0.3.1']);
  });
  it('dev build 1.1.1-dev.7+sha: unreleased on top, no wrong current, newest release in older', () => {
    const v = selectChangelog(data, '1.1.1-dev.7+abc1234');
    expect(v.unreleased?.entries.map((e) => e.en)).toEqual(['open']);
    expect(v.current).toBeUndefined();
    expect(v.older.map((x) => x.version)).toEqual(['1.1.0', '1.0.0', '0.3.1']);
  });
  it('a dev build of an already released base (1.0.0-dev.637) still lists 1.0.0 as older', () => {
    const v = selectChangelog(data, '1.0.0-dev.637+73da10c');
    expect(v.current).toBeUndefined();
    expect(v.older.map((x) => x.version)).toEqual(['1.0.0', '0.3.1']);
  });
  it('beta build 1.2.0-beta.1 is not 1.2.0', () => {
    const v = selectChangelog(data, '1.2.0-beta.1');
    expect(v.current).toBeUndefined();
    expect(v.older[0]?.version).toBe('1.1.0');
  });
  it('a version without entries has no current; empty unreleased is hidden', () => {
    const v = selectChangelog(
      { ...data, versions: [{ version: 'unreleased', date: '', entries: [] }] },
      '1.0.0',
    );
    expect(v.unreleased).toBeUndefined();
    expect(v.current).toBeUndefined();
  });
  it('strips build metadata and a leading v', () => {
    expect(stripBuild('v1.2.0-dev.1+abc')).toBe('1.2.0-dev.1');
  });
});

describe('display', () => {
  it('shows highlights first, groups the rest by area label', () => {
    const version = {
      version: '2.0.0',
      date: '',
      entries: [
        entry({ area: 'calendar', en: 'b' }),
        entry({ area: 'ai', highlight: true, en: 'hl' }),
        entry({ area: 'ai', breaking: false, en: 'a1' }),
        entry({ area: 'ai', breaking: true, en: 'a2' }),
      ],
    };
    const { highlights, groups } = groupForDisplay(version, data, 'en');
    expect(highlights.map((e) => e.en)).toEqual(['hl']);
    expect(groups.map((g) => g.label)).toEqual(['AI', 'Calendar']);
    expect(groups[0]!.entries.map((e) => e.en)).toEqual(['a2', 'a1']);
  });
  it('German in German, every other language falls back to English', () => {
    const e = entry({ de: 'Deutsch', en: 'English' });
    expect(entryText(e, 'de')).toBe('Deutsch');
    for (const l of ['en', 'es', 'fr', 'pt-BR']) expect(entryText(e, l)).toBe('English');
  });
});

describe('unread', () => {
  it('is unread until seen; unreleased and missing versions never are', () => {
    expect(isUnread([], '1.0.0')).toBe(true);
    expect(isUnread(['1.0.0'], '1.0.0')).toBe(false);
    expect(isUnread([], 'unreleased')).toBe(false);
    expect(isUnread([], undefined)).toBe(false);
  });
});

describe('newToken', () => {
  it('is the running version on a release build', () => {
    const released: ChangelogData = { ...data, versions: data.versions.slice(1) };
    expect(newToken(selectChangelog(released, '1.0.0'))).toBe('1.0.0');
  });
  it('is a hash of the open notes in a preview, and changes with every new note', () => {
    const a = newToken(selectChangelog(data, '1.1.1-dev.7'));
    expect(a).toMatch(/^unreleased:[0-9a-z]+$/);
    const more: ChangelogData = {
      ...data,
      versions: [
        {
          version: 'unreleased',
          date: '',
          entries: [entry({ en: 'open' }), entry({ en: 'another' })],
        },
        ...data.versions.slice(1),
      ],
    };
    expect(newToken(selectChangelog(more, '1.1.1-dev.7'))).not.toBe(a);
    expect(newToken(selectChangelog(data, '1.1.1-dev.7'))).toBe(a);
  });
  it('is undefined when there is nothing to show', () => {
    expect(newToken(selectChangelog({ areas: {}, versions: [] }, '1.0.0'))).toBeUndefined();
  });
});
