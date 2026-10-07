import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackup, serializeBackup } from '@/core/backup/backup';
import { createRepo } from './repo';
import { tableName } from './schema';
import todos from '@/modules/todos/manifest';
import { createTestDb } from '@/test-utils';
import type { TaschenmesserDB } from './db';
import { keepBrokenCopy, restoreIntoFreshDb } from './recovery';

const dbs: TaschenmesserDB[] = [];
const mk = () => {
  const d = createTestDb();
  dbs.push(d);
  return d;
};
afterEach(async () => {
  for (const d of dbs.splice(0)) {
    d.close();
    await d.delete();
  }
});

const platform = (save: 'saved' | 'cancelled', kind: 'web' | 'desktop' = 'web') => {
  const saveFile = vi.fn(async (_req: { data: string | Uint8Array }) => save);
  const write = vi.fn(async (_path: string, _data: string | Uint8Array) => undefined);
  return { saveFile, files: { write }, fake: { kind, saveFile, files: { write } } as never };
};

async function backupText(): Promise<string> {
  const source = mk();
  const lists = createRepo(
    tableName('todos', 'list'),
    todos.dataSchema.collections.list!.schema,
    source,
  );
  await lists.create({ name: 'Einkauf', order: 0 } as never);
  return serializeBackup(await createBackup(source));
}

describe('recovery: restore a backup into a fresh database', () => {
  it('keeps a copy of the defective state, then restores', async () => {
    const text = await backupText();
    const broken = mk();
    await broken.table('todos_list').add({ id: 'old', name: 'Alt' });
    const p = platform('saved');
    const out = await restoreIntoFreshDb(text, undefined, broken, p.fake);
    expect(out).toMatchObject({ ok: true });
    expect(p.saveFile).toHaveBeenCalledOnce();
    expect(p.saveFile.mock.calls[0]![0].data).toContain('Alt');
    const names = (await broken.table('todos_list').toArray()).map((r: { name: string }) => r.name);
    expect(names).toEqual(['Einkauf']);
  });

  it('stops without touching anything when the user cancels the copy', async () => {
    const text = await backupText();
    const broken = mk();
    await broken.table('todos_list').add({ id: 'old', name: 'Alt' });
    const out = await restoreIntoFreshDb(text, undefined, broken, platform('cancelled').fake);
    expect(out).toEqual({ ok: false, reason: 'cancelled' });
    expect(await broken.table('todos_list').count()).toBe(1);
  });

  it('rejects a file that is not a backup before anything happens', async () => {
    const broken = mk();
    await broken.table('todos_list').add({ id: 'old', name: 'Alt' });
    const p = platform('saved');
    expect(await restoreIntoFreshDb('{"nope":1}', undefined, broken, p.fake)).toEqual({
      ok: false,
      reason: 'unreadable',
    });
    expect(p.saveFile).not.toHaveBeenCalled();
    expect(await broken.table('todos_list').count()).toBe(1);
  });
});

describe('keepBrokenCopy', () => {
  it('writes to the data folder on native platforms', async () => {
    const p = platform('cancelled', 'desktop');
    expect(await keepBrokenCopy({ text: '{}', rows: 3, tables: 1 }, p.fake)).toBe(true);
    expect(p.files.write).toHaveBeenCalledOnce();
    expect(p.saveFile).not.toHaveBeenCalled();
  });
  it('needs nothing when nothing was readable', async () => {
    const p = platform('cancelled');
    expect(await keepBrokenCopy({ text: '{}', rows: 0, tables: 0 }, p.fake)).toBe(true);
  });
});
