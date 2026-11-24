import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings } from '@/core/settings/settings';
import { addLink, linkEntries } from '@/core/entitylinks';
import { LINKS_TABLE } from '@/core/entitylinks/store';
import { entityRefOf } from '@/core/entitylinks/types';
import { resolveLink } from '@/core/modules/contributions';
import target from '../linkTarget';
import manifest from '../manifest';
import source from '../plannable';
import { documentRepo } from '../repo';

/**
 * Planner hub S2 (CONCEPT-SOURCES §3.2 row 5): documents with a notice deadline or an end are planner rows. The
 * title is the category's wording only – never the document's name or file name; the name is `detail`.
 */
const ctx = { today: '2026-11-09', until: '2026-11-22' };
const NAME = 'Handyvertrag Dr. Fuchsbauer';
const FILE = 'vertrag-fuchsbauer.pdf';
const add = (over: Record<string, unknown> = {}) =>
  documentRepo.create({ title: NAME, fileName: FILE, category: 'contract', ...over } as never);

beforeEach(async () => {
  await db.table('vault_document').clear();
  await db.table('_settings').clear();
  await db.table(LINKS_TABLE).clear();
});

describe('document deadlines as a planner source', () => {
  it('end minus notice → „Vertrag kündigen“, 15 Min, hard, the name only as detail, „Zum Dokument“', async () => {
    const d = await add({ endDate: '2026-12-31', noticeDays: 45 });
    expect(await source.list(ctx)).toEqual([
      expect.objectContaining({
        id: `${d.id}:cancel:2026-11-16`,
        kind: 'cancel',
        title: 'Vertrag kündigen',
        detail: NAME,
        to: `/vault?open=${d.id}`,
        durationMin: 15,
        due: { date: '2026-11-16', hard: true },
        action: { label: 'Zum Dokument', to: `/vault?open=${d.id}` },
      }),
    ]);
    expect(source.onDone).toBeUndefined();
    expect(source.onAssign).toBeUndefined();
    expect(manifest.contributions?.plannable).toBeDefined();
  });

  it('an end without notice → wording by category (also the old `expiresOn`); a custom category gets the plain wording', async () => {
    await add({ category: 'identity', endDate: '2026-11-20' });
    await add({ category: 'identity', expiresOn: '2026-11-18' });
    await add({ category: 'warranty', endDate: '2026-11-21' });
    await add({ category: 'insurance', endDate: '2026-11-22', noticeDays: 10 });
    await add({ category: 'contract', endDate: '2026-11-19' });
    await add({ category: 'my-own-folder-Fuchsbauer', endDate: '2026-11-17' });
    const items = await source.list(ctx);
    expect(
      items.map((i) => [i.due?.date, i.kind, i.title]).sort((a, b) => a[0]!.localeCompare(b[0]!)),
    ).toEqual([
      ['2026-11-12', 'cancel', 'Versicherung kündigen'],
      ['2026-11-17', 'renew', 'Unterlage verlängern'],
      ['2026-11-18', 'renew', 'Ausweis verlängern'],
      ['2026-11-19', 'renew', 'Vertragsende prüfen'],
      ['2026-11-20', 'renew', 'Ausweis verlängern'],
      ['2026-11-21', 'renew', 'Garantie prüfen'],
    ]);
  });

  it('titles never carry the document name, its file name or a custom category name', async () => {
    for (const category of ['contract', 'identity', 'warranty', 'insurance', 'tax', 'x-Fuchsbauer'])
      for (const over of [{ endDate: '2026-11-20' }, { endDate: '2026-12-31', noticeDays: 45 }])
        await add({ category, ...over });
    const items = await source.list(ctx);
    expect(items).toHaveLength(12);
    for (const i of items) {
      expect(i.title).not.toMatch(/Fuchsbauer|Handyvertrag|\.pdf/);
      expect(i.id).not.toMatch(/Fuchsbauer/);
      expect(i.to).not.toMatch(/Fuchsbauer/);
    }
  });

  it('P86: a date passed within a week is still handed over („Frist vorbei“); older, ended or deleted ones are not', async () => {
    // Deadline 6 Nov (3 days ago), the term runs until 6 Dec.
    const late = await add({ endDate: '2026-12-06', noticeDays: 30 });
    // Passport ran out 5 Nov.
    const gone = await add({ category: 'identity', endDate: '2026-11-05' });
    // Deadline passed 20 days ago: no longer in the plan.
    await add({ endDate: '2026-12-20', noticeDays: 61 });
    // The term itself has ended: nothing to cancel.
    await add({ endDate: '2026-11-08', noticeDays: 1 });
    // Far ahead and deleted.
    await add({ endDate: '2027-06-30', noticeDays: 30 });
    const del = await add({ category: 'identity', endDate: '2026-11-15' });
    await documentRepo.remove(del.id);
    const items = await source.list(ctx);
    expect(items.map((i) => [i.id, i.kind, i.due])).toEqual(
      expect.arrayContaining([
        [`${late.id}:cancel:2026-11-06`, 'cancel', { date: '2026-11-06', hard: true }],
        [`${gone.id}:end:2026-11-05`, 'renew', { date: '2026-11-05', hard: true }],
      ]),
    );
    expect(items).toHaveLength(2);
  });

  it('a notice deadline missed more than a week ago gives no row for the end either: the term runs on', async () => {
    // Deadline 21 Oct (19 days ago), the end 20 Nov is inside the plan.
    await add({ endDate: '2026-11-20', noticeDays: 30 });
    expect(await source.list(ctx)).toEqual([]);
  });

  it('„Im Plan zeigen“ (default on) off → no items', async () => {
    await add({ endDate: '2026-12-31', noticeDays: 45 });
    expect(await source.list(ctx)).toHaveLength(1);
    await setSettings('module.vault', { showInPlan: false });
    expect(await source.list(ctx)).toEqual([]);
  });

  it('the module keeps its data API posture', () => {
    expect(manifest.dataSchema?.collections.document?.dataApi).toBeUndefined();
    expect(manifest.dataSchema?.collections.category?.dataApi).toBe(false);
  });
});

/**
 * Planner hub 2, 10a (CONCEPT §1.3, §1.5): a document is a link target. Its title is the plan row's own title – the
 * same category function – so the test that pins the row pins the link: never the name (`detail`), a file name or a
 * custom category's name.
 */
describe('documents as a link target', () => {
  it('a row names its document (`entityId`); the document resolves to the row’s own title, the row key to nothing', async () => {
    const d = await add({ endDate: '2026-12-31', noticeDays: 45 });
    const [row] = await source.list(ctx);
    expect(row).toMatchObject({ id: `${d.id}:cancel:2026-11-16`, entityId: d.id, detail: NAME });
    expect(await target.resolve(d.id)).toEqual({
      state: 'alive',
      title: row!.title,
      to: `/vault?open=${d.id}`,
    });
    expect(row!.title).toBe('Vertrag kündigen');
    expect(await target.resolve(row!.id)).toEqual({ state: 'gone' });
  });

  it('for every category and kind the link title equals the row title and carries no name, file or custom category', async () => {
    for (const category of ['contract', 'identity', 'warranty', 'insurance', 'tax', 'x-Fuchsbauer'])
      for (const over of [{ endDate: '2026-11-20' }, { endDate: '2026-12-31', noticeDays: 45 }])
        await add({ category, ...over });
    const rows = await source.list(ctx);
    expect(rows).toHaveLength(12);
    for (const row of rows) {
      const state = await target.resolve(row.entityId!);
      expect(state).toMatchObject({ state: 'alive', title: row.title });
      expect(JSON.stringify(state)).not.toMatch(/Fuchsbauer|Handyvertrag|\.pdf/);
    }
    // A document without any date (no plan row) still resolves to its category's wording only.
    const plain = await add({ category: 'x-Fuchsbauer' });
    expect(await target.resolve(plain.id)).toMatchObject({ title: 'Unterlage verlängern' });
  });

  it('a link made the way the planner will (label = the target’s own `resolveLink` title) stores no name', async () => {
    await db.table('_modules').put({
      id: 'vault',
      enabled: true,
      dataPolicy: null,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 't',
      deletedAt: null,
      _f: {},
    });
    const d = await add({ endDate: '2026-12-31', noticeDays: 45 });
    const [row] = await source.list(ctx);
    const to = entityRefOf('vault', row!);
    const state = await resolveLink(to);
    expect(state).toMatchObject({ state: 'alive', title: 'Vertrag kündigen' });
    const label = state.state === 'alive' ? state.title : '';
    await addLink({ from: { module: 'todos', id: 'task-1' }, to, rel: 'before', label });
    const stored = JSON.stringify(await db.table(LINKS_TABLE).toArray());
    expect(stored).not.toMatch(/Fuchsbauer|Handyvertrag|\.pdf/);
    expect(stored).toContain(`vault:${d.id}`);
    expect(stored).not.toContain(':cancel:');
    expect((await linkEntries({ module: 'vault', id: d.id })).map((e) => e.link.label)).toEqual([
      'Vertrag kündigen',
    ]);
  });

  it('gone: soft-deleted, never here, malformed', async () => {
    const d = await add({ endDate: '2026-12-31' });
    await documentRepo.remove(d.id);
    expect(await target.resolve(d.id)).toEqual({ state: 'gone' });
    for (const id of ['nope', '', `${d.id}:end:2026-12-31`])
      expect(await target.resolve(id)).toEqual({ state: 'gone' });
  });
});
