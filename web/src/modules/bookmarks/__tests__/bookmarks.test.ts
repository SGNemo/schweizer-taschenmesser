import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { validateManifest } from '@/core/modules/registry';
import {
  filterItems,
  groupItems,
  groupLinks,
  hostOf,
  normalizeUrl,
  parseTags,
  recentBucket,
  tagCounts,
  type Filter,
} from '../logic';
import manifest from '../manifest';
import { itemRepo } from '../repo';
import { itemSchema } from '../schema';

beforeEach(async () => {
  await db.table('bookmarks_item').clear();
});

const item = (over: Record<string, unknown> = {}) => itemSchema.parse({ title: 'x', ...over });
const stored = (over: Record<string, unknown>, createdAt = 1) => ({
  ...item(over),
  id: 'i',
  createdAt,
});
const all: Filter = { view: 'all', kind: 'all', query: '' };

describe('bookmarks logic', () => {
  it('normalizes addresses', () => {
    expect(normalizeUrl('example.com/a b')).toBe('https://example.com/a%20b');
    expect(normalizeUrl(' http://x.org ')).toBe('http://x.org/');
    expect(normalizeUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeUrl('ftp://x.org')).toBeUndefined();
    expect(normalizeUrl('')).toBeUndefined();
    expect(hostOf('https://www.example.com/x')).toBe('example.com');
    expect(hostOf(undefined)).toBeUndefined();
  });

  it('parses tags', () => {
    expect(parseTags('Rezept, #Kochen  urlaub;rezept')).toEqual(['Rezept', 'Kochen', 'urlaub']);
    expect(parseTags('  ')).toEqual([]);
  });

  it('counts tags case-insensitively, most used first', () => {
    const items = [
      item({ tags: ['Kochen', 'Rezept'] }),
      item({ tags: ['kochen'] }),
      item({ tags: ['Auto'] }),
    ];
    expect(tagCounts(items)).toEqual([
      ['Kochen', 2],
      ['Auto', 1],
      ['Rezept', 1],
    ]);
  });

  it('filters by status, kind, tag and text, newest first', () => {
    const items = [
      stored({ title: 'Pasta Rezept', kind: 'read', tags: ['Kochen'], url: 'https://koch.de' }, 1),
      stored({ title: 'Dune', kind: 'watch', done: true }, 2),
      stored({ title: 'Café Über', kind: 'place', tags: ['kochen'] }, 3),
    ];
    expect(filterItems(items, { ...all, view: 'open' }).map((i) => i.title)).toEqual([
      'Café Über',
      'Pasta Rezept',
    ]);
    expect(filterItems(items, { ...all, view: 'done' }).map((i) => i.title)).toEqual(['Dune']);
    expect(filterItems(items, { ...all, kind: 'watch' })).toHaveLength(1);
    expect(filterItems(items, { ...all, tag: 'KOCHEN' })).toHaveLength(2);
    expect(filterItems(items, { ...all, query: 'uber' }).map((i) => i.title)).toEqual([
      'Café Über',
    ]);
    expect(filterItems(items, { ...all, query: 'koch.de' })).toHaveLength(1);
  });
});

describe('bookmarks module', () => {
  it('has a valid manifest and is off by default', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
  });

  it('validates and stores items', async () => {
    expect(itemSchema.safeParse({ title: '' }).success).toBe(false);
    expect(item()).toMatchObject({ kind: 'link', tags: [], done: false });
    const created = await itemRepo.create(item({ title: 'Wanderweg', tags: ['Urlaub'] }));
    expect((await itemRepo.get(created.id))?.tags).toEqual(['Urlaub']);
  });
});

describe('Lesezeichen (links as tiles)', () => {
  it('groups by the first tag, groups alphabetical, links without a tag last', () => {
    const l = (title: string, tags: string[]) => ({ title, tags });
    const groups = groupLinks([
      l('Wetter', []),
      l('Bahn', ['Reisen']),
      l('DHL', ['pakete']),
      l('Karten', ['Reisen', 'x']),
      l('Hermes', ['Pakete']),
    ]);
    expect(groups.map(([g]) => g)).toEqual(['pakete', 'Reisen', '']);
    expect(groups[0]![1].map((i) => i.title)).toEqual(['DHL', 'Hermes']);
    expect(groups[1]![1].map((i) => i.title)).toEqual(['Bahn', 'Karten']);
  });
});

describe('grouping of the list', () => {
  const at = (day: string, hour = 12) =>
    new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).getTime();
  const g = (title: string, createdAt: number, over: Record<string, unknown> = {}) =>
    stored({ title, ...over }, createdAt);
  const day = '2026-09-29';

  it('puts an entry into today, the last 7 days or earlier', () => {
    expect(recentBucket(at('2026-09-29', 0), day)).toBe('today');
    expect(recentBucket(at('2026-09-28', 23), day)).toBe('week');
    expect(recentBucket(at('2026-09-23'), day)).toBe('week');
    expect(recentBucket(at('2026-09-22'), day)).toBe('older');
  });

  it('"recent": newest first inside each bucket, empty buckets are left out', () => {
    const items = [
      g('alt', at('2026-08-01')),
      g('heute früh', at('2026-09-29', 8)),
      g('heute spät', at('2026-09-29', 20)),
    ];
    const groups = groupItems(items, 'recent', day);
    expect(groups.map((x) => x.id)).toEqual(['today', 'older']);
    expect(groups[0]!.items.map((i) => i.title)).toEqual(['heute spät', 'heute früh']);
  });

  it('"tag": by first tag, alphabetical, without tag last, entries by title, ids safe for the DOM', () => {
    const items = [
      g('Wetter', 1),
      g('Karten', 2, { tags: ['Reisen', 'x'] }),
      g('Bahn', 3, { tags: ['reisen'] }),
      g('Rezept', 4, { tags: ['Kochen & Co'] }),
    ];
    const groups = groupItems(items, 'tag', day);
    expect(groups.map((x) => x.tag)).toEqual(['Kochen & Co', 'Reisen', '']);
    expect(groups[1]!.items.map((i) => i.title)).toEqual(['Bahn', 'Karten']);
    expect(groups.map((x) => x.id)).toEqual(['tag-kochen%20%26%20co', 'tag-reisen', 'none']);
  });

  it('"kind": in the order of the types, nothing dropped', () => {
    const items = [
      g('a', 1, { kind: 'idea' }),
      g('b', 2, { kind: 'link' }),
      g('c', 3, { kind: 'idea' }),
    ];
    const groups = groupItems(items, 'kind', day);
    expect(groups.map((x) => x.id)).toEqual(['link', 'idea']);
    expect(groups.flatMap((x) => x.items)).toHaveLength(items.length);
    expect(groups[1]!.items.map((i) => i.title)).toEqual(['c', 'a']);
  });
});
