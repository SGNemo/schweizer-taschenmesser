// @vitest-environment jsdom
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findModel } from '@/core/ai/local/catalogue';
import { writeLocalPrefs } from '@/core/ai/local/prefs';
import { localStageReady, useLocalModel } from '@/core/ai/local/state';
import { MAX_DURATION_MIN, type PlanLine } from '@/core/ai/local/prompts/plan';
import { switchAiOff, switchAiOn } from '@/core/ai/switch';
import { db } from '@/core/db/db';
import type { InstructionItem } from '@/core/plan/instructions';
import { setPlatform } from '@/core/platform';
import { createFakeLocalModel, type FakeLocalModel } from '@/core/platform/fakeLocalModel';
import { createWebPlatform } from '@/core/platform/web';
import { taskSchema } from '@/modules/todos/schema';
import { localStageAvailable, readSentence, readWithModel, worthAsking } from '../localStage';

const MODEL = findModel('qwen3.5-4b')!;
// Monday.
const TODAY = '2026-11-09';
const ITEMS: InstructionItem[] = [
  { key: 'todos:steuer', title: 'Steuer', date: '2026-11-09', hardDue: '2026-11-12' },
  { key: 'todos:keller', title: 'Keller aufräumen', date: '2026-11-10' },
  { key: 'todos:blog', title: 'Blogpost schreiben' },
];
const LINES: PlanLine[] = [
  { key: 'todos:steuer', title: 'Steuer', min: 120, prio: 2, due: '2026-11-12', day: '2026-11-09' },
  { key: 'todos:keller', title: 'Keller aufräumen', min: 60, prio: 0, day: '2026-11-10' },
  { key: 'todos:blog', title: 'Blogpost schreiben', min: 90, prio: 1 },
];
const ctx = { today: TODAY, items: ITEMS, lines: LINES };
/** The rules know the verb but not „übernächsten“: they explain; the model may read the day. */
const UNREAD = 'schieb die Steuer auf übernächsten Freitag';
const PIN = JSON.stringify({ ops: [{ op: 'pin', key: 'k1', value: '2026-11-20' }] });

const TASK = { listId: 'inbox', title: 'Steuer', done: false, priority: 0, order: 0 };

let fake: FakeLocalModel;

async function install(options: Parameters<typeof createFakeLocalModel>[0] = {}) {
  fake = createFakeLocalModel({
    models: [{ file: MODEL.file, bytes: MODEL.bytes }],
    answer: () => PIN,
    ...options,
  });
  setPlatform({ ...createWebPlatform(), localModel: fake });
  await useLocalModel.getState().refresh();
}

beforeEach(async () => {
  await db.table('_settings').clear();
  localStorage.clear();
  writeLocalPrefs({ file: MODEL.file, first: true, autoLoad: true, gpu: true });
  await install();
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => setPlatform(undefined));

describe('the planner’s local stage', () => {
  it('the rules read first: a sentence they understand never reaches the model', async () => {
    const said = await readSentence('Donnerstag frei', ctx);
    expect(said).toMatchObject({
      kind: 'ops',
      stage: 0,
      ops: [{ op: 'available', date: '2026-11-12', min: 0 }],
    });
    expect(await readSentence('schieb Keller auf Freitag', ctx)).toMatchObject({
      kind: 'ops',
      stage: 0,
    });
    expect(fake.requests).toHaveLength(0);
  });

  it('a sentence the rules cannot read goes to the model with the compact plan and ends in ops', async () => {
    const onModel = vi.fn();
    const said = await readSentence(UNREAD, ctx, { onModel });
    expect(said).toEqual({
      kind: 'ops',
      stage: 1,
      ops: [{ op: 'pin', key: 'todos:steuer', date: '2026-11-20' }],
      rules: { kind: 'explain' },
    });
    expect(onModel).toHaveBeenCalledTimes(1);
    expect(fake.requests).toHaveLength(1);
    const { prompt, grammar, maxTokens } = fake.requests[0]!;
    expect(prompt).toContain('Heute: 2026-11-09 (Montag)');
    expect(prompt).toContain('k1 | Steuer | 120 min | prio 2 | due 2026-11-12 | day Mo 2026-11-09');
    expect(prompt).toContain('k3 | Blogpost schreiben | 90 min | prio 1 | waits');
    expect(
      prompt.endsWith(`Satz: ${UNREAD}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n`),
    ).toBe(true);
    expect(grammar).toContain('key ::= "\\"k1\\"" | "\\"k2\\"" | "\\"k3\\""');
    expect(maxTokens).toBeLessThanOrEqual(512);
    // Loaded on first use, kept for the next.
    expect((await fake.status()).loaded?.file).toBe(MODEL.file);
    const load = vi.spyOn(fake, 'load');
    await readSentence(UNREAD, ctx);
    expect(load).not.toHaveBeenCalled();
  });

  it('with „KI aus“ the model is never asked and the rules’ reading stands', async () => {
    const generate = vi.spyOn(fake, 'generate');
    await switchAiOff('device');
    try {
      expect(await localStageAvailable()).toBe(false);
      const said = await readSentence(UNREAD, ctx);
      expect(said).toEqual({ kind: 'explain', stage: 0 });
      expect(generate).not.toHaveBeenCalled();
    } finally {
      await switchAiOn();
    }
    expect(await localStageAvailable()).toBe(true);
  });

  it('is skipped without a downloaded model, with stage 1 switched off, and outside the desktop app', async () => {
    const onModel = vi.fn();
    await install({ models: [] });
    expect(await readSentence(UNREAD, ctx, { onModel })).toMatchObject({
      kind: 'explain',
      stage: 0,
    });
    writeLocalPrefs({ first: false });
    await install();
    expect(await readSentence(UNREAD, ctx, { onModel })).toMatchObject({
      kind: 'explain',
      stage: 0,
    });
    writeLocalPrefs({ first: true });
    setPlatform(undefined); // the web app and Android: no local model at all
    await useLocalModel.getState().refresh();
    expect(localStageReady()).toBe(false);
    expect(await readSentence(UNREAD, ctx, { onModel })).toMatchObject({
      kind: 'explain',
      stage: 0,
    });
    expect(onModel).not.toHaveBeenCalled();
    expect(fake.requests).toHaveLength(0);
  });

  it.each([
    ['not JSON', () => 'nope'],
    [
      'a key outside the plan',
      () => JSON.stringify({ ops: [{ op: 'pin', key: 'k7', value: '2026-11-13' }] }),
    ],
    [
      'a day before today',
      () => JSON.stringify({ ops: [{ op: 'pin', key: 'k1', value: '2026-11-01' }] }),
    ],
    [
      'a failing model',
      () => {
        throw new Error('boom');
      },
    ],
  ])('%s: the rules’ reading stands, nothing is guessed', async (_name, answer) => {
    await install({ answer });
    expect(await readSentence(UNREAD, ctx)).toEqual({ kind: 'explain', stage: 0 });
  });

  it('an empty answer means "no instruction": the field makes a ToDo as before', async () => {
    await install({ answer: () => JSON.stringify({ ops: [] }) });
    // Names a thing of the plan, so the model is asked; it says: a new task.
    const said = await readSentence('Steuer Unterlagen sortieren bis Fr', ctx);
    expect(said).toEqual({ kind: 'none', stage: 0 });
    expect(fake.requests).toHaveLength(1);
  });

  it('an aborted request is no instruction either – also while the model still loads, and with a shell that only hears a later abort', async () => {
    const ac = new AbortController();
    ac.abort();
    expect(await readWithModel(UNREAD, LINES, TODAY, ac.signal)).toBeUndefined();
    // A shell that ignores a signal aborted before the call: generate must not even be called.
    const generate = vi.spyOn(fake, 'generate');
    expect(await readWithModel(UNREAD, LINES, TODAY, ac.signal)).toBeUndefined();
    expect(generate).not.toHaveBeenCalled();
    // The first use loads the model (seconds): Escape ends the wait at once.
    await fake.unload();
    vi.spyOn(fake, 'load').mockImplementation(() => new Promise(() => {}));
    const slow = new AbortController();
    const reading = readWithModel(UNREAD, LINES, TODAY, slow.signal);
    slow.abort();
    expect(await reading).toBeUndefined();
    expect(generate).not.toHaveBeenCalled();
  });

  it('the model’s duration cap is the ToDo estimate’s cap', () => {
    expect(taskSchema.safeParse({ ...TASK, estimateMin: MAX_DURATION_MIN }).success).toBe(true);
    expect(taskSchema.safeParse({ ...TASK, estimateMin: MAX_DURATION_MIN + 1 }).success).toBe(
      false,
    );
  });

  it('only asks for what looks like an instruction: a planning verb, a day word, or a thing of the plan by name', () => {
    const items = ITEMS;
    expect(worthAsking({ kind: 'explain' }, 'schieb das irgendwie', items)).toBe(true);
    expect(worthAsking({ kind: 'missing', query: 'x' }, 'schieb x auf Fr', items)).toBe(true);
    expect(worthAsking({ kind: 'none' }, 'Milch kaufen', items)).toBe(false);
    expect(worthAsking({ kind: 'none' }, 'Steuer lieber am Freitag', items)).toBe(true);
    expect(worthAsking({ kind: 'none' }, 'den Keller endlich mal angehen', items)).toBe(true);
    // A verb or a filler the title shares with half of all ToDos names nothing.
    expect(worthAsking({ kind: 'none' }, 'Oma anrufen und Brief schreiben', items)).toBe(false);
    expect(worthAsking({ kind: 'none' }, 'noch Milch holen', items)).toBe(false);
    expect(worthAsking({ kind: 'ops', ops: [] }, 'Donnerstag frei', items)).toBe(false);
  });

  it('a discarded model reading is not asked again: `model: false` leaves the rules’ result', async () => {
    expect(await readSentence(UNREAD, ctx, { model: false })).toEqual({
      kind: 'explain',
      stage: 0,
    });
    expect(fake.requests).toHaveLength(0);
  });
});
