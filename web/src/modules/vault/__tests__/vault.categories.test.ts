import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { runMigrations } from '@/core/modules/migrate';
import { undoable, undoEntry } from '@/core/undo';
import { createSeedContext } from '@/core/seed/context';
import {
  categoryLabel,
  categoryOfDoc,
  countByResolved,
  docsInCategory,
  moveCategory,
  nextCategoryOrder,
  resolveCategories,
} from '../categories';
import { filterDocuments, isRenewable } from '../logic';
import { aiSchema } from '../ai';
import manifest from '../manifest';
import seed from '../seed';
import { categoryRepo, createCategory, documentRepo, removeCategory, writeCategory } from '../repo';
import { CATEGORIES, documentSchema, NO_CATEGORY } from '../schema';
import { t } from '@/strings';

beforeEach(async () => {
  await db.table('vault_document').clear();
  await db.table('vault_category').clear();
});

const rec = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  deletedAt: null as number | null,
  tone: 0,
  icon: 'files' as const,
  order: 0,
  ...over,
});
const doc = (over: Record<string, unknown> = {}) =>
  documentSchema.parse({ title: 'Reisepass', ...over });
const names = t.vault.categories;
const loadCats = async () => resolveCategories(await categoryRepo.table.toArray());

describe('resolving categories', () => {
  it('without records: the built-in folders in their order, "Ohne Kategorie" last', () => {
    const cats = resolveCategories([]);
    expect(cats.map((c) => c.id)).toEqual([...CATEGORIES]);
    expect(cats.at(-1)).toMatchObject({ id: NO_CATEGORY, fixed: true });
    expect(cats.filter((c) => c.fixed)).toHaveLength(1);
  });

  it('a record renames, recolours and moves a built-in folder; `removed` hides it', () => {
    const cats = resolveCategories([
      rec('contract', { name: 'Verträge & Abos', tone: 4, order: -1 }),
      rec('tax', { removed: true }),
    ]);
    expect(cats[0]).toMatchObject({ id: 'contract', name: 'Verträge & Abos', tone: 4 });
    expect(cats.map((c) => c.id)).not.toContain('tax');
    expect(categoryLabel(cats[0], names)).toBe('Verträge & Abos');
  });

  it('a tombstone on a built-in id means "no record" (undo of a first change), never "gone"', () => {
    const cats = resolveCategories([rec('health', { removed: true, deletedAt: 1 })]);
    expect(cats.map((c) => c.id)).toContain('health');
  });

  it('custom folders: live ones show; removed, tombstoned or nameless ones do not', () => {
    const cats = resolveCategories([
      rec('c1', { name: 'Fahrzeug', order: 6 }),
      rec('c2', { name: 'Alt', removed: true }),
      rec('c3', { name: 'Weg', deletedAt: 5 }),
      rec('c4', {}),
    ]);
    expect(cats.filter((c) => !c.builtin).map((c) => c.id)).toEqual(['c1']);
  });

  it('a record for "Ohne Kategorie" cannot remove or rename it', () => {
    const cats = resolveCategories([rec(NO_CATEGORY, { removed: true, name: 'X', order: -5 })]);
    expect(cats.at(-1)).toMatchObject({ id: NO_CATEGORY, fixed: true });
    expect(cats.at(-1)?.name).toBeUndefined();
    expect(cats.filter((c) => c.id === NO_CATEGORY)).toHaveLength(1);
  });

  it('a document of a gone folder is shown and counted under "Ohne Kategorie"', () => {
    const cats = resolveCategories([rec('tax', { removed: true })]);
    const live = new Set(cats.map((c) => c.id));
    expect(categoryOfDoc({ category: 'tax' }, live)).toBe(NO_CATEGORY);
    expect(categoryOfDoc({ category: 'unknown-id' }, live)).toBe(NO_CATEGORY);
    expect(categoryOfDoc({ category: 'health' }, live)).toBe('health');
    const counts = countByResolved(
      [{ category: 'tax' }, { category: 'other' }, { category: 'health' }],
      cats,
    );
    expect(counts.get(NO_CATEGORY)).toBe(2);
    expect(counts.get('health')).toBe(1);
  });

  it('moving swaps neighbours and renumbers without ties', () => {
    const cats = resolveCategories([]);
    const writes = moveCategory(cats, 'insurance', -1);
    const order = new Map(cats.map((c) => [c.id, c.order]));
    for (const w of writes) order.set(w.id, w.order);
    const moved = resolveCategories(writes.map((w) => rec(w.id, { order: w.order })));
    expect(moved.slice(0, 2).map((c) => c.id)).toEqual(['insurance', 'identity']);
    // The first cannot go up, the last movable one cannot go down; "Ohne Kategorie" never moves.
    expect(moveCategory(cats, 'identity', -1)).toEqual([]);
    expect(moveCategory(cats, 'health', 1)).toEqual([]);
    expect(moveCategory(cats, NO_CATEGORY, -1)).toEqual([]);
  });

  it('a new folder goes after the last one', () => {
    expect(nextCategoryOrder(resolveCategories([]))).toBe(6);
  });

  it('search finds documents by the name of their folder; the filter uses the shown folder', () => {
    const cats = resolveCategories([
      rec('c1', { name: 'Fahrzeug' }),
      rec('tax', { removed: true }),
    ]);
    const live = new Set(cats.map((c) => c.id));
    const docs = [
      doc({ title: 'Schein', category: 'c1' }),
      doc({ title: 'Bescheid', category: 'tax' }),
    ];
    const opts = {
      shownCategory: (d: { category: string }) => categoryOfDoc(d, live),
      categoryName: (id: string) =>
        categoryLabel(
          cats.find((c) => c.id === id),
          names,
        ),
    };
    expect(filterDocuments(docs, { category: 'all', query: 'fahrz', ...opts })).toHaveLength(1);
    expect(
      filterDocuments(docs, { category: NO_CATEGORY, query: '', ...opts }).map((d) => d.title),
    ).toEqual(['Bescheid']);
  });

  it('documents of a folder the user made can be renewed; warranties and tax papers cannot', () => {
    expect(isRenewable('some-custom-id')).toBe(true);
    expect(isRenewable('warranty')).toBe(false);
    expect(isRenewable('tax')).toBe(false);
    expect(isRenewable('contract')).toBe(true);
  });
});

describe('changing categories', () => {
  it('creates, renames and recolours; a built-in one keeps its look until changed', async () => {
    const id = await createCategory({ name: 'Fahrzeug', tone: 2, icon: 'car', order: 6 });
    let cats = await loadCats();
    expect(cats.find((c) => c.id === id)).toMatchObject({ name: 'Fahrzeug', icon: 'car' });
    const health = cats.find((c) => c.id === 'health')!;
    await writeCategory(health, { tone: 1 });
    cats = await loadCats();
    expect(cats.find((c) => c.id === 'health')).toMatchObject({
      tone: 1,
      icon: health.icon,
      order: health.order,
      name: undefined,
    });
  });

  it('removing a folder moves every document to "Ohne Kategorie" and loses none', async () => {
    const a = await documentRepo.create(doc({ title: 'A', category: 'contract' }));
    const b = await documentRepo.create(doc({ title: 'B', category: 'contract' }));
    const c = await documentRepo.create(doc({ title: 'C', category: 'health' }));
    const cats = await loadCats();
    const contract = cats.find((x) => x.id === 'contract')!;
    const ids = docsInCategory(await documentRepo.active().toArray(), cats, 'contract');
    expect(ids.sort()).toEqual([a.id, b.id].sort());
    await removeCategory(contract, ids);
    expect(await documentRepo.active().count()).toBe(3);
    expect((await documentRepo.get(a.id))?.category).toBe(NO_CATEGORY);
    expect((await documentRepo.get(b.id))?.category).toBe(NO_CATEGORY);
    expect((await documentRepo.get(c.id))?.category).toBe('health');
    expect((await loadCats()).map((x) => x.id)).not.toContain('contract');
  });

  it('removing into a chosen folder moves the documents there; "Rückgängig" brings all back', async () => {
    const target = await createCategory({ name: 'Archiv', tone: 0, icon: 'files', order: 7 });
    const a = await documentRepo.create(doc({ title: 'A', category: 'insurance' }));
    const cats = await loadCats();
    const insurance = cats.find((x) => x.id === 'insurance')!;
    const { entry } = await undoable('test', () => removeCategory(insurance, [a.id], target));
    expect((await documentRepo.get(a.id))?.category).toBe(target);
    expect((await loadCats()).map((x) => x.id)).not.toContain('insurance');
    expect(await undoEntry(entry!.id)).toBe(true);
    expect((await documentRepo.get(a.id))?.category).toBe('insurance');
    expect((await loadCats()).map((x) => x.id)).toContain('insurance');
  });

  it('a custom folder: remove and undo', async () => {
    const id = await createCategory({ name: 'Fahrzeug', tone: 2, icon: 'car', order: 6 });
    const a = await documentRepo.create(doc({ title: 'A', category: id }));
    const cat = (await loadCats()).find((x) => x.id === id)!;
    const { entry } = await undoable('test', () => removeCategory(cat, [a.id]));
    expect((await documentRepo.get(a.id))?.category).toBe(NO_CATEGORY);
    await undoEntry(entry!.id);
    expect((await documentRepo.get(a.id))?.category).toBe(id);
    expect((await loadCats()).map((x) => x.id)).toContain(id);
  });

  it('"Ohne Kategorie" cannot be removed or written', async () => {
    const fixed = (await loadCats()).at(-1)!;
    await expect(removeCategory(fixed, [])).rejects.toThrow();
    await writeCategory(fixed, { name: 'X' });
    expect(await categoryRepo.table.count()).toBe(0);
  });

  it('a removal never targets the folder being removed', async () => {
    const a = await documentRepo.create(doc({ title: 'A', category: 'tax' }));
    const tax = (await loadCats()).find((x) => x.id === 'tax')!;
    await removeCategory(tax, [a.id], 'tax');
    expect((await documentRepo.get(a.id))?.category).toBe(NO_CATEGORY);
  });
});

describe('version 4', () => {
  it('the migration keeps built-in categories and files documents without one under "Ohne Kategorie"', async () => {
    const kept = await documentRepo.create(doc({ title: 'A', category: 'contract' }));
    const bare = await documentRepo.create(doc({ title: 'B' }));
    await db.table('vault_document').update(bare.id, { category: undefined });
    await db.table('_meta').put({ key: 'moduleVersion.vault', value: 3 });
    await runMigrations(manifest);
    expect((await documentRepo.get(kept.id))?.category).toBe('contract');
    expect((await documentRepo.get(bare.id))?.category).toBe(NO_CATEGORY);
    expect(await categoryRepo.table.count()).toBe(0);
  });

  it('the assistant still knows only the built-in keys: folder names never reach it', () => {
    const fields = aiSchema.collections.document?.fields ?? {};
    expect(fields.category).toBe('enum:identity|insurance|contract|warranty|tax|health|other');
    expect(Object.keys(aiSchema.collections)).toEqual(['document']);
  });

  it('the seed makes one folder of its own and files a document in it, the same ids in every language', () => {
    const make = (lang: 'de' | 'en') =>
      seed.seed(
        createSeedContext({ moduleId: 'vault', today: '2026-09-29', scale: 'medium', lang }),
      );
    const de = make('de');
    const en = make('en');
    const folder = de.category?.[0];
    expect(folder?.data).toMatchObject({ name: 'Fahrzeug', icon: 'car' });
    expect(en.category?.[0]?.data).toMatchObject({ name: 'Vehicle' });
    expect(en.category?.[0]?.id).toBe(folder?.id);
    expect(de.document?.some((d) => d.data.category === folder?.id)).toBe(true);
  });
});
