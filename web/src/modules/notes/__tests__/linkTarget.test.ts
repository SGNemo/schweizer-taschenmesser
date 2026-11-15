import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import target from '../linkTarget';
import { noteRepo } from '../repo';

beforeEach(async () => {
  await db.table('notes_note').clear();
});

describe('notes as a link target', () => {
  it('alive: the title of today and the route that opens the note', async () => {
    const note = await noteRepo.create({
      title: ' Vermieter ',
      body: '',
      pinned: false,
      notebookId: null,
      order: 0,
    });
    expect(await target.resolve(note.id)).toEqual({
      state: 'alive',
      title: 'Vermieter',
      to: `/notes?open=${note.id}`,
    });
  });

  it('gone: a soft-deleted note and an id that was never here', async () => {
    const note = await noteRepo.create({
      title: 'Weg',
      body: '',
      pinned: false,
      notebookId: null,
      order: 0,
    });
    await noteRepo.remove(note.id);
    expect(await target.resolve(note.id)).toEqual({ state: 'gone' });
    expect(await target.resolve('never-here')).toEqual({ state: 'gone' });
  });

  it('a malformed id is gone, never a query for something else', async () => {
    expect(await target.resolve('../todos?open=1&x=<script>')).toEqual({ state: 'gone' });
    expect(await target.resolve('')).toEqual({ state: 'gone' });
  });
});
