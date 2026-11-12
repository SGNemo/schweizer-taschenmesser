// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { commitImport } from '@/core/importer/batches';
import { buildPreview } from '@/core/importer/plan';
import { setNow } from '@/core/time/now';
import { ROUTINE_TEMPLATES, ROUTINE_TEMPLATE_IDS } from '../templates';
import { isDue } from '../logic';
import manifest from '../manifest';
import { routineRepo } from '../repo';
import { routineSchema } from '../schema';

const TODAY = '2026-09-29';

async function run(ids: string[]) {
  const runtime = (await manifest.contributions!.onboarding!.load!()).default;
  const parsed = await runtime.parse(
    'templates',
    { kind: 'template', ids },
    { today: TODAY, options: {}, batchId: 'tb' },
  );
  return buildPreview(manifest, runtime, parsed.candidates);
}

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 29, 10, 0).getTime());
  await db.table('routines_routine').clear();
  await db.table('_imports').clear();
  await db.table('_outbox').clear();
});
afterEach(() => setNow());

describe('routines: start templates', () => {
  it('offers every template with a name, and none is pre-ticked', () => {
    const [importer] = manifest.contributions!.onboarding!.importers;
    expect(importer!.kind).toBe('template');
    expect(importer!.templates!.map((x) => x.id)).toEqual(ROUTINE_TEMPLATE_IDS);
    for (const x of importer!.templates!) {
      expect(x.label, x.id).not.toBe('');
      expect(x.detail, x.id).not.toBe('');
      expect(x.preselected ?? false, x.id).toBe(false);
    }
  });

  it('turns every template into a valid routine', async () => {
    const rows = await run(ROUTINE_TEMPLATE_IDS);
    expect(rows).toHaveLength(ROUTINE_TEMPLATE_IDS.length);
    for (const r of rows) {
      expect(r.invalid, r.candidate.label).toBeUndefined();
      expect(routineSchema.safeParse(r.candidate.data).success, r.candidate.label).toBe(true);
    }
  });

  it('never opens the page with a row of "dran": nothing is due today, and no two share their first day', async () => {
    const rows = await run(ROUTINE_TEMPLATE_IDS);
    const days = rows.map((r) => r.candidate.data.dueDate as string);
    expect(days.every((d) => !isDue({ dueDate: d }, TODAY))).toBe(true);
    expect(new Set(days).size).toBe(days.length);
    expect(Object.values(ROUTINE_TEMPLATES).every((x) => x.firstIn >= 1)).toBe(true);
  });

  it('starts the rule on the first day and names nobody', async () => {
    const [bath] = await run(['bath']);
    expect(bath!.candidate.data).toMatchObject({
      name: 'Bad putzen',
      room: 'Bad',
      repeat: { freq: 'weekly', interval: 1 },
      startDate: '2026-09-30',
      dueDate: '2026-09-30',
      people: [],
      turn: 0,
    });
  });

  it('skips unknown ids and recognises a template that was taken before, whatever its case', async () => {
    expect(await run(['nope', 'constructor'])).toEqual([]);
    const first = await run(['bath', 'vacuum']);
    await commitImport(manifest, {
      batchId: 'tb',
      importerId: 'templates',
      source: 't',
      rows: first,
    });
    expect(await routineRepo.active().count()).toBe(2);
    const bath = (await routineRepo.active().toArray()).find((r) => r.name === 'Bad putzen')!;
    await routineRepo.update(bath.id, { name: 'BAD PUTZEN' });
    const again = await run(['bath', 'kitchen']);
    expect(again.map((r) => [r.candidate.label, r.duplicate, r.selected])).toEqual([
      ['Bad putzen', true, false],
      ['Küche wischen', false, true],
    ]);
  });
});
