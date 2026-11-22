/**
 * Planner hub S2 privacy pin (docs/design/planner-hub/CONCEPT-SOURCES.md §3.2 row 5): a document's name or file
 * name never leaves the vault through the planner. Plan titles travel into calendar chips and timed blocks, the
 * agenda, the planner widget, its run record and its notifications; only the planner page shows `detail`.
 * Cross-module on purpose (vault → planner), so it lives in core.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { getMeta } from '@/core/db/metaKv';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { setSettings } from '@/core/settings/settings';
import { FOCUS_SCOPE } from '@/core/settings/focus';
import { setNow } from '@/core/time/now';
import { toEpoch } from '@/core/time/dates';
import plannerCalendar, { planChips } from '@/modules/planner/calendar';
import plannerNotifications from '@/modules/planner/notifications';
import { assignmentRepo } from '@/modules/planner/repo';
import { LAST_RUN_KEY, runPlanner, type LastRun } from '@/modules/planner/run';
import { DEFAULT_PLANNER_SETTINGS } from '@/modules/planner/settings';
import vaultSource from '@/modules/vault/plannable';

const TODAY = '2026-11-09'; // Monday
const vault = getManifest('vault')!;
const docRepo = createCollectionRepo(vault, 'document');
const NAME = /Fuchsbauer|Reisepass|Handyvertrag|\.pdf/;

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 9, 10, 0).getTime());
  for (const t of [
    'planner_day',
    'planner_item',
    'planner_assignment',
    'vault_document',
    '_settings',
    '_meta',
  ])
    await db.table(t).clear();
  await docRepo.create({
    title: 'Reisepass Fuchsbauer',
    fileName: 'reisepass-fuchsbauer.pdf',
    category: 'identity',
    endDate: '2026-11-12',
  });
  await docRepo.create({
    title: 'Handyvertrag Fuchsbauer',
    fileName: 'handyvertrag.pdf',
    category: 'contract',
    endDate: '2026-12-31',
    noticeDays: 45,
  });
  await docRepo.create({
    title: 'Fuchsbauer privat',
    category: 'my-folder-Fuchsbauer',
    endDate: '2026-11-11',
  });
});
afterEach(() => setNow());

describe('a document name never reaches the planner’s outward surfaces', () => {
  it('not in the plan item titles, the run record, the calendar items or the notifications', async () => {
    const items = await vaultSource.list({ today: TODAY, until: '2026-11-22' });
    expect(items).toHaveLength(3);
    for (const i of items) expect(i.title).not.toMatch(NAME);
    // The name is the detail: the planner page's own line, nothing else.
    expect(items.every((i) => NAME.test(i.detail ?? ''))).toBe(true);

    const run = await runPlanner(
      {
        today: TODAY,
        manifests: [vault],
        settings: { ...DEFAULT_PLANNER_SETTINGS, horizonDays: '14' },
        planLimit: 3,
        settled: true,
      },
      // „Alles auslegen“: a run lays nothing by itself, and the rows are one of the surfaces checked here.
      { force: true, reshuffle: true },
    );
    expect(run.ran).toBe(true);
    const rows = await assignmentRepo.active().toArray();
    expect(rows.length).toBeGreaterThan(0);
    const last = await getMeta<LastRun>(LAST_RUN_KEY);
    expect(Object.keys(last!.titles)).toHaveLength(3);
    expect(JSON.stringify(last)).not.toMatch(NAME);
    expect(JSON.stringify(await db.table('planner_item').toArray())).not.toMatch(NAME);
    expect(JSON.stringify(rows)).not.toMatch(NAME);

    // Calendar: the day chips, and every session as a timed block (title from the run record).
    const range = { from: TODAY, to: '2026-11-22' };
    const chips = await plannerCalendar(range);
    expect(chips.length).toBeGreaterThan(0);
    const blocks = planChips(
      rows.map((r) => ({ ...r, from: '09:00', to: '09:15' })),
      last!.titles,
    );
    expect(blocks.map((b) => b.title)).toEqual(
      expect.arrayContaining([expect.stringMatching(/Ausweis verlängern|Vertrag kündigen/)]),
    );
    expect(JSON.stringify([...chips, ...blocks])).not.toMatch(NAME);

    // Notifications: the planner's („Rest verteilen?“) with the reminder on, and the vault's own calendar.
    await setSettings(FOCUS_SCOPE, { restReminder: true, quietHours: false });
    const notes = await plannerNotifications({
      from: toEpoch(TODAY, '00:00'),
      to: toEpoch('2026-11-22', '23:59'),
    });
    expect(notes.length).toBeGreaterThan(0);
    expect(JSON.stringify(notes)).not.toMatch(NAME);
    const ownCalendar = await (await vault.contributions!.calendarItems!()).default(range);
    expect(JSON.stringify(ownCalendar)).not.toMatch(NAME);
  });
});
