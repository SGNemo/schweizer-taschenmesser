import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { bus } from '@/core/events';
import { getManifest } from '@/core/modules/registry';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { undoDepth, undoLast } from '@/core/undo';
import { useUiStore } from '@/stores/ui';
import { addKindFromField } from '../actions';
import { assignmentRepo, itemRepo } from '../repo';
import { setManifestsForTests } from '../services';
import { PLANNER_SCOPE } from '../settings';

// Planner hub 2, package 3: Enter on a sure kind is one undoable action of the planner. Monday 30 Nov 2026, invented data.
const NOW = new Date(2026, 10, 30, 10, 0).getTime();
const MODULES = ['todos', 'planner', 'invoices', 'lists', 'calendar', 'notes', 'bookmarks'];
const manifests = MODULES.map((id) => getManifest(id)!);
const repo = (module: string, collection: string) =>
  createCollectionRepo(getManifest(module)!, collection);
const live = async (table: string) =>
  (await db.table(table).toArray()).filter((r) => r.deletedAt === null);
const messages = () => useUiStore.getState().toasts.map((x) => x.message);
const modulesRow = (id: string, enabled: boolean) =>
  db.table('_modules').put({
    id,
    enabled,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });

/** Every table whose rows changed while `fn` ran. */
async function written(fn: () => Promise<unknown>): Promise<string[]> {
  const snap = async () =>
    Object.fromEntries(
      await Promise.all(
        db.tables.map(async (t) => [t.name, JSON.stringify(await t.toArray())] as const),
      ),
    );
  const before = await snap();
  await fn();
  const after = await snap();
  return Object.keys(after)
    .filter((k) => after[k] !== before[k])
    .sort();
}

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of db.tables) await t.clear();
  await repo('todos', 'list').create({ name: 'Eingang', order: 0 }, { id: 'inbox' });
  await repo('lists', 'list').createMany([
    { id: 'shopping-default', data: { name: 'Einkauf', kind: 'shopping' } },
  ]);
  for (const id of MODULES) await modulesRow(id, true);
  await setSettings(PLANNER_SCOPE, { horizonDays: '14' });
  bus.clear();
  useUiStore.setState({ toasts: [] });
  setManifestsForTests(async () => manifests);
});
afterEach(() => {
  setNow();
  setManifestsForTests(undefined);
  bus.clear();
});

const invoice = {
  kind: 'invoice' as const,
  fields: { title: 'Stadtwerke', amountMinor: 8000, date: '2026-12-04' },
  deadline: '2026-12-04',
};

describe('addKindFromField', () => {
  it('an invoice: stored, its own item row without a day, one undo entry takes both back', async () => {
    const depth = undoDepth();
    const tables = await written(async () =>
      expect(await addKindFromField(invoice, {})).toBe(true),
    );
    const [inv] = await live('invoices_invoice');
    expect(inv).toMatchObject({ payee: 'Stadtwerke', amountMinor: 8000, dueDate: '2026-12-04' });
    const row = await itemRepo.get(`invoices:${inv.id}`);
    expect(row?.excluded).toBeUndefined();
    expect(await assignmentRepo.active().count()).toBe(0);
    // No amount in the toast (also while „Werte ausblenden“ is on: the toast never carries one).
    expect(messages()).toEqual(['Rechnung angelegt, liegt unter „Noch ohne Tag“.']);
    expect(messages().join(' ')).not.toMatch(/80|€/);
    expect(undoDepth()).toBe(depth + 1);
    // The write spy: the planner's own tables, its _meta keys, the outbox, and exactly the target's collection.
    expect(
      tables.filter(
        (x) => !x.startsWith('planner_') && !['_meta', '_outbox', '_links'].includes(x),
      ),
    ).toEqual(['invoices_invoice']);
    await undoLast();
    expect(await live('invoices_invoice')).toHaveLength(0);
    expect(await itemRepo.get(`invoices:${inv.id}`)).toBeUndefined();
  });

  it('„Milch“ with the shopping list on „Nicht planen“: the entry is added, `excluded` stays as it is', async () => {
    await itemRepo.create(
      { source: { module: 'lists', id: 'shopping-default' }, order: 0, excluded: true },
      { id: 'lists:shopping-default' },
    );
    expect(await addKindFromField({ kind: 'list', names: ['Milch'] }, {})).toBe(true);
    expect((await itemRepo.get('lists:shopping-default'))?.excluded).toBe(true);
    expect((await live('lists_item')).map((i) => i.name)).toEqual(['Milch']);
    expect(await assignmentRepo.active().count()).toBe(0);
  });

  it('shopping entries: one per name, the list’s one row asked in, an existing day row kept', async () => {
    expect(await addKindFromField({ kind: 'list', names: ['Milch', 'Brot'] }, {})).toBe(true);
    expect((await live('lists_item')).map((i) => i.name).sort()).toEqual(['Brot', 'Milch']);
    const row = await itemRepo.get('lists:shopping-default');
    expect(row).toBeDefined();
    expect(row?.excluded).toBeUndefined();
    expect(messages()).toEqual(['Steht auf der Einkaufsliste.']);
    // The list now lies on Wednesday: a second entry leaves that row where it is.
    await assignmentRepo.create(
      {
        itemKey: 'lists:shopping-default',
        k: 0,
        of: 1,
        date: '2026-12-02',
        minutes: 45,
        order: 0,
        reason: 'new',
      },
      { id: 'lists:shopping-default#0' },
    );
    const before = await itemRepo.get('lists:shopping-default');
    expect(await addKindFromField({ kind: 'list', names: ['Eier'] }, {})).toBe(true);
    expect((await assignmentRepo.active().toArray()).map((r) => r.date)).toEqual(['2026-12-02']);
    expect((await itemRepo.get('lists:shopping-default'))?.updatedAt).toBe(before?.updatedAt);
  });

  it('rollback: a source that does not list the thing leaves nothing behind', async () => {
    await setSettings('module.invoices', { showInPlan: false });
    expect(await addKindFromField(invoice, {})).toBe(false);
    expect(await live('invoices_invoice')).toHaveLength(0);
    expect(await live('planner_item')).toHaveLength(0);
  });

  it('an appointment, a note and a link get no plan row; only the note offers „In den Plan“', async () => {
    const event = {
      kind: 'event' as const,
      fields: { title: 'Friseur', date: '2026-12-02', time: '15:00' },
    };
    const shown: [string, string | undefined][] = [];
    const last = () => {
      const x = useUiStore.getState().toasts.at(-1);
      shown.push([x?.message ?? '', x?.lead?.label]);
    };
    expect(await addKindFromField(event, {})).toBe(true);
    last();
    expect(await live('calendar_event')).toMatchObject([
      { title: 'Friseur', startDate: '2026-12-02', startTime: '15:00' },
    ]);
    expect(await addKindFromField({ kind: 'note', title: 'Regal im Flur' }, {})).toBe(true);
    last();
    expect(
      await addKindFromField(
        { kind: 'bookmark', url: 'https://example.org/a', host: 'example.org' },
        {},
      ),
    ).toBe(true);
    last();
    expect(await live('bookmarks_item')).toMatchObject([
      { title: 'example.org', url: 'https://example.org/a' },
    ]);
    expect(await live('planner_item')).toHaveLength(0);
    expect(await live('planner_assignment')).toHaveLength(0);
    expect(shown).toEqual([
      ['Termin eingetragen.', undefined],
      ['Notiz angelegt.', 'In den Plan'],
      ['Auf der Merkliste.', undefined],
    ]);
  });

  it('an Aufgabe mit Schritten: one ToDo with its checklist on the sheet’s day, the toast names it', async () => {
    expect(
      await addKindFromField(
        { kind: 'steps', title: 'Haushalt', steps: ['Wäsche', 'Bad', 'Küche'] },
        {},
        '2026-12-01',
      ),
    ).toBe(true);
    const [task] = await live('todos_task');
    expect(task.title).toBe('Haushalt');
    expect(task.checklist.map((c: { text: string }) => c.text)).toEqual(['Wäsche', 'Bad', 'Küche']);
    expect((await assignmentRepo.active().toArray()).map((r) => r.date)).toEqual(['2026-12-01']);
    expect(messages()[0]).toMatch(/^Aufgabe mit 3 Schritten angelegt, liegt auf Di/);
  });

  it('the target refuses (its module went off): nothing stored, false', async () => {
    await modulesRow('calendar', false);
    expect(
      await addKindFromField(
        { kind: 'event', fields: { title: 'Friseur', date: '2026-12-02', time: '15:00' } },
        {},
      ),
    ).toBe(false);
    expect(await live('calendar_event')).toHaveLength(0);
  });
});
