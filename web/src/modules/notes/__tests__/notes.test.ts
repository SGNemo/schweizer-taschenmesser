import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { validateManifest } from '@/core/modules/registry';
import { displayTitle, excerpt, searchNotes, sortNotes } from '../logic';
import manifest from '../manifest';
import { noteRepo } from '../repo';
import { noteSchema } from '../schema';

beforeEach(async () => {
  await db.table('notes_note').clear();
});

const note = (over: Record<string, unknown>) => noteSchema.parse({ title: '', body: '', ...over });

describe('notes', () => {
  it('has a valid manifest and is off by default', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
  });

  it('needs a title or a body', () => {
    expect(noteSchema.safeParse({ title: ' ', body: '' }).success).toBe(false);
    expect(noteSchema.safeParse({ title: 'x' }).success).toBe(true);
    expect(noteSchema.safeParse({ body: 'x' }).success).toBe(true);
  });

  it('uses the first body line as title for untitled notes', () => {
    const n = note({ body: 'Einkaufen\nMilch\nBrot' });
    expect(displayTitle(n)).toBe('Einkaufen');
    expect(excerpt(n)).toBe('Milch Brot');
    expect(excerpt(note({ title: 'T', body: 'a\nb' }))).toBe('a b');
    expect(excerpt(note({ title: 'T', body: 'x'.repeat(200) }), 20)).toHaveLength(20);
  });

  it('sorts pinned first, then by recency; searches ignoring diacritics', () => {
    const list = [
      { ...note({ title: 'alt' }), updatedAt: 1 },
      { ...note({ title: 'neu' }), updatedAt: 3 },
      { ...note({ title: 'wichtig', pinned: true }), updatedAt: 2 },
    ];
    expect(sortNotes(list).map((n) => n.title)).toEqual(['wichtig', 'neu', 'alt']);
    expect(
      searchNotes([note({ title: 'Übersicht' }), note({ title: 'x' })], 'ubersicht'),
    ).toHaveLength(1);
    expect(searchNotes(list, '')).toHaveLength(3);
  });

  it('stores notes through the repo', async () => {
    const n = await noteRepo.create(note({ title: 'Idee' }));
    expect((await noteRepo.get(n.id))?.title).toBe('Idee');
  });
});
