import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { validateManifest } from '@/core/modules/registry';
import { setSettings } from '@/core/settings/settings';
import { displayTitle, excerpt, SCRATCH_ID, searchNotes, sortNotes } from '../logic';
import manifest from '../manifest';
import { noteRepo } from '../repo';
import { noteSchema } from '../schema';
import { ensureScratchNote, LEGACY_SCRATCH_SCOPE } from '../services';

beforeEach(async () => {
  await db.table('notes_note').clear();
  await db.table('_settings').clear();
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
      { ...note({ title: 'alt' }), id: 'a', updatedAt: 1 },
      { ...note({ title: 'neu' }), id: 'b', updatedAt: 3 },
      { ...note({ title: 'wichtig', pinned: true }), id: 'c', updatedAt: 2 },
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

  it('keeps the scratch pad above pinned notes', () => {
    const list = [
      { ...note({ title: 'wichtig', pinned: true }), id: 'c', updatedAt: 9 },
      { ...note({ title: 'Zettel' }), id: SCRATCH_ID, updatedAt: 1 },
    ];
    expect(sortNotes(list).map((n) => n.id)).toEqual([SCRATCH_ID, 'c']);
  });
});

describe('scratch pad copy from the old tool', () => {
  it('copies the text once, with the fixed id, and leaves the settings row alone', async () => {
    await setSettings(LEGACY_SCRATCH_SCOPE, { text: 'Brot kaufen' });
    expect(await ensureScratchNote()).toBe(true);
    const n = await noteRepo.get(SCRATCH_ID);
    expect(n).toMatchObject({ title: 'Zettel', body: 'Brot kaufen', pinned: true });
    const stamp = n!.updatedAt;
    await noteRepo.update(SCRATCH_ID, { body: 'geändert' });
    expect(await ensureScratchNote()).toBe(false);
    expect((await noteRepo.get(SCRATCH_ID))?.body).toBe('geändert');
    expect(stamp).toBeLessThanOrEqual((await noteRepo.get(SCRATCH_ID))!.updatedAt);
    expect(await db.table('_settings').get(LEGACY_SCRATCH_SCOPE)).toBeDefined();
  });

  it('does nothing for an empty text or without an old row', async () => {
    expect(await ensureScratchNote()).toBe(false);
    await setSettings(LEGACY_SCRATCH_SCOPE, { text: '  ' });
    expect(await ensureScratchNote()).toBe(false);
    expect(await noteRepo.table.count()).toBe(0);
  });

  it('does not bring back a pad that was deleted', async () => {
    await noteRepo.create(note({ title: 'Zettel', body: 'x' }), { id: SCRATCH_ID });
    await noteRepo.remove(SCRATCH_ID);
    await setSettings(LEGACY_SCRATCH_SCOPE, { text: 'alt' });
    expect(await ensureScratchNote()).toBe(false);
    expect(await noteRepo.get(SCRATCH_ID)).toBeUndefined();
  });
});
