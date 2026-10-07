import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setPlatform } from '@/core/platform';
import { createFakeLocalModel, type FakeLocalModel } from '@/core/platform/fakeLocalModel';
import { createWebPlatform } from '@/core/platform/web';
import { setNow } from '@/core/time/now';
import { ask, type AskDeps } from '../assistant';
import type { AiProvider } from '../providers/types';
import { clearAll, ctxFor, seed, TODAY, useFixedClock } from '../testing';
import { loadUsageRows, totalsByStage } from '../usage';
import { cloudAllowed } from '../write/settings';
import { findModel } from './catalogue';
import { writeLocalPrefs } from './prefs';
import { createLocalStage } from './stage';
import { localModelActive, localStageReady, useLocalModel } from './state';

const MODEL = findModel('qwen3.5-4b')!;
const SENTENCE = 'Leg bitte etwas für die Steuerberaterin fest, sie meldet sich Freitag';
const GOOD = JSON.stringify({
  ops: [
    {
      module: 'calendar',
      action: 'create',
      data: { title: 'Steuerberaterin', startDate: '2026-10-02', kind: 'reminder' },
    },
  ],
  confidence: 0.9,
  question: '',
});

let fake: FakeLocalModel;

async function install(options: Parameters<typeof createFakeLocalModel>[0] = {}) {
  fake = createFakeLocalModel({
    models: [{ file: MODEL.file, bytes: MODEL.bytes }],
    answer: () => GOOD,
    ...options,
  });
  setPlatform({ ...createWebPlatform(), localModel: fake });
  await useLocalModel.getState().refresh();
}

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  await db.table('_imports').clear();
  await seed();
  writeLocalPrefs({ file: MODEL.file, first: true, autoLoad: true, gpu: true });
  await install();
});
afterAll(() => {
  setNow();
  setPlatform(undefined);
});

function cloud(): AiProvider & { complete: ReturnType<typeof vi.fn> } {
  return {
    id: 'claude',
    model: 'claude-haiku-4-5',
    complete: vi.fn(async () => {
      throw new Error('the cloud must not be asked');
    }),
  };
}

const deps = (over: Partial<AskDeps> = {}): AskDeps => {
  const { manifests, known } = ctxFor();
  return {
    manifests,
    known,
    today: TODAY,
    database: db,
    write: {
      enabled: true,
      modulesOff: [],
      cloud: false,
      local: localStageReady() ? createLocalStage() : undefined,
    },
    ...over,
  };
};

describe('stage 1: the built-in local model', () => {
  it('answers what the rules cannot place – 0 tokens, no cloud, nothing written', async () => {
    const provider = cloud();
    const before = (await db.table('calendar_event').toArray()).length;
    const res = await ask(SENTENCE, deps({ provider }));
    expect(res).toMatchObject({
      ok: true,
      tier: 'local',
      result: { kind: 'write', stage: 'local' },
    });
    if (!res.ok || res.result.kind !== 'write') throw new Error('expected a write result');
    expect(res.result.ops[0]).toMatchObject({
      module: 'calendar',
      kind: 'create',
      ready: true,
      data: { title: 'Steuerberaterin', startDate: '2026-10-02', kind: 'reminder' },
    });
    expect(provider.complete).not.toHaveBeenCalled();
    expect((await db.table('calendar_event').toArray()).length).toBe(before);
    const stages = totalsByStage(await loadUsageRows(db));
    expect(stages.local.answers).toBe(1);
    expect(stages.local.inputTokens + stages.local.outputTokens).toBe(0);
  });

  it('is not asked for what the free rules already understand', async () => {
    await ask('Rechnung Stadtwerke 89,90 € fällig 15.10.', deps());
    expect(fake.requests).toHaveLength(0);
  });

  it('sends the schema, the actions and examples first and the date and sentence last – never entries', async () => {
    await ask(SENTENCE, deps());
    const { prompt, grammar } = fake.requests[0]!;
    expect(prompt.indexOf('Modules and fields')).toBeLessThan(prompt.indexOf('Eingabe:'));
    expect(prompt.endsWith('</think>\n\n')).toBe(true); // chatml-nothink: the answer starts after it
    expect(prompt).toContain(`Heute: ${TODAY} (Dienstag)`);
    expect(prompt).toContain(`Eingabe: ${SENTENCE}`);
    expect(grammar).toContain('root ::=');
    for (const secret of ['Geheimfirma', 'Sonnenschein', 'Milch kaufen', 'Altes erledigt']) {
      expect(prompt).not.toContain(secret);
    }
  });

  it('loads the model on first use and keeps it for the next request', async () => {
    expect((await fake.status()).loaded).toBeUndefined();
    await ask(SENTENCE, deps());
    expect((await fake.status()).loaded?.file).toBe(MODEL.file);
    const load = vi.spyOn(fake, 'load');
    await ask(SENTENCE, deps());
    expect(load).not.toHaveBeenCalled();
    expect(fake.requests).toHaveLength(2);
  });

  it('hands an invalid or unsure answer on to the cloud (when allowed)', async () => {
    await install({ answer: () => 'not json at all' });
    const provider: AiProvider = {
      id: 'claude',
      model: 'claude-haiku-4-5',
      complete: vi.fn(async () => ({
        toolCalls: [
          {
            name: 'propose_actions',
            input: {
              ops: [{ module: 'todos', action: 'create', data: { title: 'Steuerberaterin' } }],
            },
          },
        ],
        text: '',
        usage: { inputTokens: 600, outputTokens: 40 },
        model: 'claude-haiku-4-5-20251001',
      })),
    };
    const res = await ask(
      SENTENCE,
      deps({
        provider,
        write: { enabled: true, modulesOff: [], cloud: true, local: createLocalStage() },
      }),
    );
    expect(res).toMatchObject({
      ok: true,
      tier: 'model',
      result: { kind: 'write', stage: 'cloud' },
    });
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it('with cloud writes off, the cloud is only offered the question tools', async () => {
    await install({ answer: () => JSON.stringify({ ops: [], confidence: 0, question: '' }) });
    const provider: AiProvider & { complete: ReturnType<typeof vi.fn> } = {
      id: 'claude',
      model: 'claude-haiku-4-5',
      complete: vi.fn(async () => ({
        toolCalls: [],
        text: 'Dazu kann ich nichts sagen.',
        usage: { inputTokens: 500, outputTokens: 10 },
        model: 'claude-haiku-4-5-20251001',
      })),
    };
    const res = await ask(SENTENCE, deps({ provider }));
    const tools = (provider.complete.mock.calls[0]![0] as { tools: { name: string }[] }).tools;
    expect(tools.map((t) => t.name)).not.toContain('propose_actions');
    expect(tools.map((t) => t.name)).not.toContain('create_entry');
    expect(res.ok && res.result.kind === 'write').toBe(false);
  });

  it('rejects an answer for a module that does not exist or that is the vault', async () => {
    await install({
      answer: () =>
        JSON.stringify({
          ops: [{ module: 'accounts', action: 'delete', target: 'Bank' }],
          confidence: 0.9,
          question: '',
        }),
    });
    const res = await ask(SENTENCE, deps({ provider: undefined }));
    expect(res.ok && res.result.kind === 'write').toBe(false);
  });

  it('is skipped when no model is downloaded, switched off, or the build lacks it', async () => {
    await install({ models: [] });
    expect(localStageReady()).toBe(false);
    writeLocalPrefs({ first: false });
    await install();
    expect(localStageReady()).toBe(false);
    writeLocalPrefs({ first: true });
    setPlatform(undefined); // web: no local model at all
    await useLocalModel.getState().refresh();
    expect(localStageReady()).toBe(false);
  });
});

describe('cloud fallback default', () => {
  it('is off while a local model is active unless the user chose otherwise', async () => {
    expect(localModelActive()).toBe(true);
    expect(cloudAllowed({}, localModelActive())).toBe(false);
    expect(cloudAllowed({ cloud: true }, true)).toBe(true);
    expect(cloudAllowed({}, false)).toBe(true);
    expect(cloudAllowed({ cloud: false }, false)).toBe(false);
  });
});
