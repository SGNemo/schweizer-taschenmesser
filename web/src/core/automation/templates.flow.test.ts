import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { clearAll, useFixedClock } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { visibleManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { tAuto } from '@/strings.automation';
import { invoiceRepo } from '@/modules/invoices/repo';
import { invoiceSchema } from '@/modules/invoices/schema';
import { itemRepo as shoppingItems } from '@/modules/lists/repo';
import { itemRepo } from '@/modules/pantry/repo';
import { itemSchema } from '@/modules/pantry/schema';
import { taskRepo } from '@/modules/todos/repo';
import type { EngineDeps } from './engine';
import { startWriteEvents } from './ingest';
import { listLog } from './log';
import { listNotices } from './notices';
import { buildRegistry, isRunnable } from './registry';
import { runTick } from './scheduler';
import { resetGuardCache } from './state';
import { resolveRules } from './templates';

const ENABLED = ['todos', 'invoices', 'pantry', 'lists', 'subscriptions', 'habits', 'timetrack'];
const manifests = visibleManifests.filter((m) => ENABLED.includes(m.id));
const at = new Date(2026, 8, 29, 10, 0).getTime();

async function setup(on: string[], dryRun = false) {
  const registry = await buildRegistry(manifests);
  const rules = resolveRules({
    enabled: true,
    rules: Object.fromEntries(on.map((id) => [id, { enabled: true, params: {} }])),
  }).filter((r) => isRunnable(r, registry));
  expect(rules).toHaveLength(on.length);
  const deps: EngineDeps & { detectors: () => typeof registry.detectors } = {
    rules: async () => rules,
    settings: async () => ({ enabled: true, dryRun, globalPerHour: 0 }),
    manifests: () => manifests,
    known: () => visibleManifests,
    allowed: registry.allowed,
    database: db,
    detectors: () => registry.detectors,
  };
  return { registry, deps };
}

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  for (const t of [
    '_meta',
    '_automationLog',
    '_imports',
    'lists_item',
    'lists_list',
    'pantry_item',
    'invoices_invoice',
  ])
    await db.table(t).clear();
  resetGuardCache();
});
afterAll(() => setNow());

describe('template flows with the real modules', () => {
  it('an invoice due in three days gets a reminder and a task, once', async () => {
    await invoiceRepo.create(
      invoiceSchema.parse({ payee: 'Stadtwerke', amountMinor: 4500, dueDate: '2026-10-01' }),
    );
    const { deps } = await setup(['invoiceDue']);
    await runTick(deps, at);
    await runTick(deps, at + 11 * 60_000);
    const task = tAuto.get().templates.invoiceDue.task.replace('{payee}', 'Stadtwerke');
    const tasks = (await taskRepo.active().toArray()).filter((t) => t.title === task);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ dueDate: '2026-10-01' });
    expect((await listNotices(db)).map((n) => n.title)).toEqual([
      tAuto
        .get()
        .templates.invoiceDue.reminder.replace('{payee}', 'Stadtwerke')
        .replace('{dueDate}', '2026-10-01'),
    ]);
    expect(await listLog(10, db)).toHaveLength(1);
  });

  it('an invoice due in two weeks waits until it is within the days', async () => {
    await invoiceRepo.create(
      invoiceSchema.parse({ payee: 'Later', amountMinor: 100, dueDate: '2026-10-12' }),
    );
    const { deps } = await setup(['invoiceDue']);
    await runTick(deps, at);
    expect(await listNotices(db)).toHaveLength(0);
    setNow(() => at + 8 * 24 * 3_600_000); // 2026-10-07: five days left
    await runTick(deps, at + 8 * 24 * 3_600_000);
    expect(await listNotices(db)).toHaveLength(0);
    setNow(() => at + 10 * 24 * 3_600_000); // 2026-10-09: three days left
    await runTick(deps, at + 10 * 24 * 3_600_000);
    expect(await listNotices(db)).toHaveLength(1);
  });

  it('a pantry item dropping under its minimum lands on the shopping list', async () => {
    const item = await itemRepo.create(itemSchema.parse({ name: 'Milch', count: 3, minCount: 2 }));
    const { deps, registry } = await setup(['stockLow']);
    const stop = startWriteEvents(deps, { derive: registry.derive, watched: registry.watched });
    try {
      setNow(() => at + 60_000);
      await itemRepo.update(item.id, { count: 1 });
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      stop();
    }
    const onList = (await shoppingItems.active().toArray()).filter((i) => i.name === 'Milch');
    expect(onList).toHaveLength(1);
    expect(onList[0]!.id).toMatch(/^auto-/);
  });

  it('dry run: the same flow writes nothing and says what it would do', async () => {
    await invoiceRepo.create(
      invoiceSchema.parse({ payee: 'Stadtwerke', amountMinor: 4500, dueDate: '2026-10-01' }),
    );
    const { deps } = await setup(['invoiceDue'], true);
    await runTick(deps, at);
    expect(await listNotices(db)).toHaveLength(0);
    expect(
      (await taskRepo.active().toArray()).filter((t) => String(t.title).includes('Stadtwerke')),
    ).toHaveLength(0);
    const [row] = await listLog(1, db);
    expect(row).toMatchObject({ result: 'dry', dryRun: true });
    expect(row!.actions.map((a) => a.note)).toEqual(['dry', 'dry']);
  });
});
