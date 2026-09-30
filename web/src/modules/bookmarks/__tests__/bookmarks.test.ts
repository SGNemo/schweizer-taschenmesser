import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { validateManifest } from '@/core/modules/registry';
import { filterItems, hostOf, normalizeUrl, parseTags, tagCounts, type Filter } from '../logic';
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
