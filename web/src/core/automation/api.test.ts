import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { clearAll, useFixedClock } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { enableModule } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { setNow } from '@/core/time/now';
import { taskRepo } from '@/modules/todos/repo';
import { applyAutomationSettings, dryRunAll, runRuleById, undoLastRun } from './api';
import { listLog } from './log';
import { listNotices } from './notices';
import { setAutomationSettings } from './settings';
import { resetGuardCache } from './state';

const RULE = 'tpl-invoiceDue';

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  for (const t of ['_meta', '_automationLog', '_imports', '_modules']) await db.table(t).clear();
  resetGuardCache();
  for (const id of ['todos', 'invoices']) {
    await enableModule(availableManifests().find((m) => m.id === id)!);
  }
  await setAutomationSettings({
    enabled: true,
    dryRun: false,
    globalPerHour: 0,
    rules: { invoiceDue: { enabled: true, params: {} } },
  });
  await applyAutomationSettings();
});
afterAll(() => setNow());

const made = async () =>
  (await taskRepo.active().toArray()).filter(
    (t) => String(t.title).includes('bezahlen') || String(t.title).includes('Pay'),
  );

describe('automation api (what the palette and the log call)', () => {
  it('runs a rule by hand, and takes the last run back', async () => {
    const report = await runRuleById(RULE);
    expect(report?.result).toBe('done');
    expect(await made()).toHaveLength(1);
    expect(await listNotices(db)).toHaveLength(1);

    const undone = await undoLastRun();
    expect(undone).toMatchObject({ removed: 1 });
    expect(await made()).toHaveLength(0);
    expect(await listNotices(db)).toHaveLength(0);
    expect((await listLog(5, db))[0]!.undone).toBe(true);
    // nothing left to take back
    expect(await undoLastRun()).toBeUndefined();
  });

  it('a rule that is not on cannot be run', async () => {
    expect(await runRuleById('tpl-stockLow')).toBeUndefined();
  });

  it('a dry run of all rules writes nothing and logs what would happen', async () => {
    expect(await dryRunAll()).toBe(1);
    expect(await made()).toHaveLength(0);
    expect(await listNotices(db)).toHaveLength(0);
    expect((await listLog(5, db))[0]).toMatchObject({ result: 'dry', dryRun: true });
  });

  it('switching the master off stops the rules at once', async () => {
    await setAutomationSettings({ enabled: false });
    await applyAutomationSettings();
    expect(await dryRunAll()).toBe(0);
  });
});
