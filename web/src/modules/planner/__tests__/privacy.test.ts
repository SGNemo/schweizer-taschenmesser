// @vitest-environment jsdom
/**
 * Privacy pins of the planner's AI layer (docs/design/plan/CONCEPT.md §6b):
 *   (1) with „KI aus“ the engine and the instructions run over the rules – 0 requests, the local
 *       model is never asked;
 *   (2) the local stage and the planner's field never call `fetch` (a spy, and the sources).
 * The cloud pins (3) and (4) live in `core/ai/privacy.test.ts` next to the adapters.
 */
import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findModel } from '@/core/ai/local/catalogue';
import { writeLocalPrefs } from '@/core/ai/local/prefs';
import { useLocalModel } from '@/core/ai/local/state';
import { switchAiOff, switchAiOn } from '@/core/ai/switch';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { setPlatform } from '@/core/platform';
import { createFakeLocalModel, type FakeLocalModel } from '@/core/platform/fakeLocalModel';
import { createWebPlatform } from '@/core/platform/web';
import { setNow } from '@/core/time/now';
import { buildBoard } from '../board';
import { localStageAvailable, readSentence } from '../localStage';
import { assignmentRepo, dayRepo, itemRepo } from '../repo';
import { previewPlanner, runPlanner, type RunDeps } from '../run';
import { instructionItems, planLines } from '../say';
import { DEFAULT_PLANNER_SETTINGS } from '../settings';

const TODAY = '2026-11-09'; // Monday
const NOW = new Date(2026, 10, 9, 10, 0).getTime();
const MODEL = findModel('qwen3.5-4b')!;
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');

/** Recognisable planner data: a blocker label, a day note, an item title, dates away from today. */
const BLOCKER = 'Zahnarzt Dr. Fuchsbauer';
const NOTE = 'Nachmittags Werkstatt aufräumen';
const ITEM_TITLE = 'Dachboden entrümpeln';
const FAR_DAY = '2026-11-13';

const UNREAD = 'schieb die Steuer auf übernächsten Freitag';
const deps = (): RunDeps => ({
  today: TODAY,
  manifests: [todos],
  settings: { ...DEFAULT_PLANNER_SETTINGS, horizonDays: '7' },
  planLimit: 3,
  settled: true,
});

let fake: FakeLocalModel;

async function install() {
  fake = createFakeLocalModel({
    models: [{ file: MODEL.file, bytes: MODEL.bytes }],
    answer: () => JSON.stringify({ ops: [{ op: 'pin', key: 'k1', value: '2026-11-20' }] }),
  });
  setPlatform({ ...createWebPlatform(), localModel: fake });
  await useLocalModel.getState().refresh();
}

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of ['planner_day', 'planner_item', 'planner_assignment', 'todos_task', '_settings'])
    await db.table(t).clear();
  localStorage.clear();
  const steuer = await taskRepo.create({
    listId: 'inbox',
    title: 'Steuer',
    done: false,
    priority: 2,
    order: 0,
    estimateMin: 120,
  });
  const attic = await taskRepo.create({
    listId: 'inbox',
    title: ITEM_TITLE,
    done: false,
    priority: 0,
    order: 1,
  });
  await dayRepo.upsert('2026-11-12', {
    date: '2026-11-12',
    blockers: [{ id: 'b1', label: BLOCKER, min: 60 }],
    note: NOTE,
  });
  await itemRepo.upsert(`todos:${attic.id}`, {
    source: { module: 'todos', id: attic.id },
    title: ITEM_TITLE,
    pinned: FAR_DAY,
    order: 0,
  });
  await assignmentRepo.upsert(`todos:${steuer.id}#0`, {
    itemKey: `todos:${steuer.id}`,
    k: 0,
    of: 1,
    date: TODAY,
    minutes: 120,
    order: 0,
    reason: 'new',
  });
  await assignmentRepo.upsert(`todos:${attic.id}#0`, {
    itemKey: `todos:${attic.id}`,
    k: 0,
    of: 1,
    date: FAR_DAY,
    minutes: 30,
    order: 0,
    reason: 'pinned',
  });
  writeLocalPrefs({ file: MODEL.file, first: true, autoLoad: true, gpu: true });
  await install();
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  setNow();
  setPlatform(undefined);
});

/** The board as the page builds it, with the fixtures in it. */
async function board() {
  const tasks = await db.table('todos_task').toArray();
  return buildBoard({
    today: TODAY,
    span: 7,
    settings: DEFAULT_PLANNER_SETTINGS,
    dayRows: await dayRepo.active().toArray(),
    itemRows: await itemRepo.active().toArray(),
    assignments: await assignmentRepo.active().toArray(),
    entries: tasks.map((t) => ({
      moduleId: 'todos',
      id: t.id as string,
      kind: 'task',
      title: t.title as string,
      to: '/todos',
      ...(t.estimateMin ? { durationMin: t.estimateMin as number } : {}),
      priority: t.priority as 0 | 1 | 2 | 3,
    })),
    calendar: [],
    unplaced: [],
  });
}

describe('pin (1): „KI aus“', () => {
  it('plan() and the instructions run over the rules – 0 requests, the local model is never asked', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const generate = vi.spyOn(fake, 'generate');
    await switchAiOff('device');
    try {
      expect(await localStageAvailable()).toBe(false);
      const b = await board();
      const ctx = { today: TODAY, items: instructionItems(b), lines: planLines(b) };
      // A sentence the rules read, and one they cannot: both stay with the rules.
      const said = await readSentence('Donnerstag frei', ctx);
      expect(said).toMatchObject({ kind: 'ops', stage: 0 });
      expect(await readSentence(UNREAD, ctx)).toEqual({ kind: 'explain', stage: 0 });
      // The engine plans with the ops, and a real run writes rows – all without a model.
      if (said.kind !== 'ops') throw new Error('expected ops');
      const preview = await previewPlanner(deps(), said.ops);
      expect(preview.result.assignments.length).toBeGreaterThan(0);
      const run = await runPlanner(deps(), { force: true });
      expect(run.result).toBeDefined();
      expect(generate).not.toHaveBeenCalled();
      expect(fake.requests).toHaveLength(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      await switchAiOn();
    }
  });
});

describe('pin (2): the local stage and the field never fetch', () => {
  it('a sentence the model reads leaves the device nowhere: no fetch, and the prompt carries only the plan lines', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const b = await board();
    const said = await readSentence(UNREAD, {
      today: TODAY,
      items: instructionItems(b),
      lines: planLines(b),
    });
    expect(said).toMatchObject({ kind: 'ops', stage: 1 });
    expect(fake.requests).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    const { prompt } = fake.requests[0]!;
    // The model sees the things of the plan (titles, minutes, days) – never blocker labels or day notes.
    expect(prompt).toContain('| Steuer |');
    expect(prompt).toContain(`| ${ITEM_TITLE} |`);
    expect(prompt).not.toContain(BLOCKER);
    expect(prompt).not.toContain(NOTE);
    // Things are named by short aliases, never by their ids.
    expect(prompt).not.toContain('todos:');
    for (const t of await db.table('todos_task').toArray())
      expect(prompt).not.toContain(t.id as string);
  });

  it('the sources of the local stage and the page know no fetch, no router, no write pipeline', () => {
    // Code only: the comments may name what is forbidden.
    const src = (file: string) =>
      readFileSync(new URL(file, import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
    for (const file of [
      '../localStage.ts',
      '../routes/PlannerPage.tsx',
      '../say.ts',
      '../../../core/ai/local/prompts/plan.ts',
    ]) {
      const text = src(file);
      for (const forbidden of [
        'fetch(',
        'fetch ',
        '/router',
        'core/ai/write',
        'aiModules',
        'writableModules',
        'core/ai/providers',
        'core/ai/assistant',
        'core/ai/prompt',
      ])
        expect(text, `${file} must not contain ${forbidden}`).not.toContain(forbidden);
    }
    // The planner's prompt is its own and reaches the model only through the platform seam.
    const stage = src('../localStage.ts');
    expect(stage).toContain("from '@/core/ai/local/prompts/plan'");
    expect(stage).toContain('getPlatform().localModel.generate');
    expect(stage).toContain('isAiOn()');
    expect(stage).toContain('localStageReady()');
  });
});
