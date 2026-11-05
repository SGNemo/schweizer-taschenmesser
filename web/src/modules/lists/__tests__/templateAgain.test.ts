import { beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { commitImport } from '@/core/importer/batches';
import { buildPreview } from '@/core/importer/plan';
import { getManifest } from '@/core/modules/registry';
import { itemRepo, listRepo } from '../repo';

const lists = getManifest('lists')!;

beforeEach(async () => {
  for (const t of ['lists_list', 'lists_item', '_imports', '_outbox']) await db.table(t).clear();
});

async function importTemplate(batchId: string) {
  const runtime = (await lists.contributions!.onboarding!.load!()).default;
  const parsed = await runtime.parse(
    'templates',
    { kind: 'template', ids: ['beach'] },
    { today: '2026-11-05', options: {}, batchId },
  );
  const rows = await buildPreview(lists, runtime, parsed.candidates);
  if (rows.some((r) => r.selected))
    await commitImport(lists, { batchId, importerId: 'templates', source: 'Vorlage', rows });
}

// QA round 4, X10: importing a packing template again put the missing items into a list id that is
// never written (the list itself is a duplicate), so they were invisible.
it('a template imported again adds the missing items to the existing list', async () => {
  await importTemplate('b1');
  const [list] = await listRepo.active().toArray();
  const first = (await itemRepo.active().toArray()).find((i) => i.listId === list!.id)!;
  await itemRepo.remove(first.id);

  await importTemplate('b2');
  expect((await listRepo.active().toArray()).map((l) => l.id)).toEqual([list!.id]);
  const back = (await itemRepo.active().toArray()).filter((i) => i.name === first.name);
  expect(back.map((i) => i.listId)).toEqual([list!.id]);
});
