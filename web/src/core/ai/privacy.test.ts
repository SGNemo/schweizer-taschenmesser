/**
 * Privacy contract for EVERY adapter: what leaves the device is the question, today's date and the
 * compact module schemas (plus the API key in its header) – never user data. Runs the real assistant
 * pipeline against the real adapters with a recording fetch and a database full of recognisable data.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { visibleManifests } from '@/core/modules/registry';
import { setPlatform } from '@/core/platform';
import { createFakeLocalModel } from '@/core/platform/fakeLocalModel';
import { createWebPlatform } from '@/core/platform/web';
import { setNow } from '@/core/time/now';
import { buildContext, contextModules } from '@/modules/chat/context';
import { addQuestion, generateReply } from '@/modules/chat/engine';
import { threadRepo } from '@/modules/chat/repo';
import plannerManifest from '@/modules/planner/manifest';
import { assignmentRepo, dayRepo, itemRepo } from '@/modules/planner/repo';
import { ask } from './assistant';
import { createProviderFor, entryFromPreset, type ProviderEntry } from './config';
import { findModel } from './local/catalogue';
import { writeLocalPrefs } from './local/prefs';
import { useLocalModel } from './local/state';
import { getPreset, PRESETS, type PresetId } from './providers/presets';
import { buildSystemPrompt, schemaHash, writableModules } from './prompt';
import { clearCooldown, createRouter } from './router';
import { aiModules } from './scope';
import { clearAll, ctxFor, seed, TODAY, useFixedClock } from './testing';
import { testConnection } from './testConnection';

const QUESTION = 'Wie viel habe ich im September für Lebensmittel ausgegeben?';
const KEY = 'sk-test-privacy-key-123'; // gitleaks:allow (test fixture)
const DATA = [
  'Geheimfirma',
  'Sonnenschein',
  'Supermarkt',
  'Netflix',
  'Stadtwerke',
  'Vodafone',
  'Telekom',
  'Arbeitgeber',
  'Milch kaufen',
  'Miete überweisen',
  'Girokonto',
  '8990',
  '250000',
];

/**
 * Planner fixtures (docs/design/plan/CONCEPT.md §6b, pins 3 and 4): a blocker label, a day note, an
 * item title and planning dates away from today and from the question. The planner has no
 * `aiSchema`, so none of it may ever be in a request body.
 */
const PLANNER_DATA = [
  'Zahnarzt Dr. Fuchsbauer',
  'Nachmittags Werkstatt aufräumen',
  'Dachboden entrümpeln',
  '2026-10-07',
];

async function seedPlanner(): Promise<void> {
  await dayRepo.upsert('2026-10-07', {
    date: '2026-10-07',
    blockers: [{ id: 'b1', label: 'Zahnarzt Dr. Fuchsbauer', min: 60 }],
    note: 'Nachmittags Werkstatt aufräumen',
  });
  await itemRepo.upsert('todos:attic', {
    source: { module: 'todos', id: 'attic' },
    title: 'Dachboden entrümpeln',
    pinned: '2026-10-07',
    order: 0,
  });
  await assignmentRepo.upsert('todos:attic#0', {
    itemKey: 'todos:attic',
    k: 0,
    of: 1,
    date: '2026-10-07',
    minutes: 45,
    order: 0,
    reason: 'pinned',
  });
}

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  await seed();
  await seedPlanner();
  clearCooldown();
});
afterAll(() => setNow());

const INTENT = {
  module: 'finance',
  collection: 'transaction',
  filters: [{ field: 'kind', op: 'eq', value: 'expense' }],
  range: { relative: 'this_month' },
  aggregate: 'sum:amountMinor',
};

interface ToolCall {
  name: string;
  input: unknown;
}
const QUERY_CALL: ToolCall = { name: 'run_query', input: INTENT };

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** Each adapter kind with the answer shape its API really uses (`call` = the tool call it reports). */
const CASES: {
  name: string;
  preset: PresetId;
  patch?: Partial<ProviderEntry>;
  answer: (call?: ToolCall) => unknown;
  keyHeader: string;
}[] = [
  {
    name: 'Anthropic (SDK)',
    preset: 'anthropic',
    keyHeader: 'authorization',
    answer: (call = QUERY_CALL) => ({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-4-5-20251001',
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'tu_1', name: call.name, input: call.input }],
      usage: { input_tokens: 400, output_tokens: 20 },
    }),
  },
  {
    name: 'Ollama',
    preset: 'ollama',
    keyHeader: '',
    answer: (call = QUERY_CALL) => ({
      model: 'qwen2.5:7b',
      message: { tool_calls: [{ function: { name: call.name, arguments: call.input } }] },
      prompt_eval_count: 300,
      eval_count: 15,
    }),
  },
  ...(['openai', 'gemini', 'groq', 'openrouter', 'mistral', 'custom'] as const).map((preset) => ({
    name: `OpenAI-compatible: ${preset}`,
    preset,
    patch: preset === 'custom' ? { baseUrl: 'https://llm.example.org/v1', model: 'my-model' } : {},
    keyHeader: 'authorization',
    answer: (call: ToolCall = QUERY_CALL) => ({
      model: 'm',
      choices: [
        {
          message: {
            tool_calls: [{ function: { name: call.name, arguments: JSON.stringify(call.input) } }],
          },
        },
      ],
      usage: { prompt_tokens: 350, completion_tokens: 18 },
    }),
  })),
  {
    name: 'OpenAI-compatible in JSON tool mode',
    preset: 'openrouter',
    patch: { toolMode: 'json' },
    keyHeader: 'authorization',
    answer: (call = QUERY_CALL) => ({
      choices: [{ message: { content: JSON.stringify({ tool: call.name, input: call.input }) } }],
      usage: { prompt_tokens: 500, completion_tokens: 30 },
    }),
  },
];

/** A text answer of the adapter (the chat): the same shapes with a sentence instead of a tool call. */
const textAnswer = (answer: () => unknown) => () => ({
  ...(answer() as object),
  stop_reason: 'end_turn',
  choices: [{ message: { content: 'Dazu weiß ich nichts.' } }],
  content: [{ type: 'text', text: 'Dazu weiß ich nichts.' }],
  message: { content: 'Dazu weiß ich nichts.' },
});

function recording(answer: () => unknown) {
  const sent: Sent[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => (headers[key.toLowerCase()] = value));
    sent.push({ url: String(input), headers, body: String(init?.body ?? '') });
    return new Response(JSON.stringify(answer()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { sent, fetchFn };
}

describe.each(CASES)('$name', ({ preset, patch, answer, keyHeader }) => {
  const entry = (): ProviderEntry => ({ ...entryFromPreset(preset), ...patch, keySet: true });

  it('sends only question, date and schemas – no user data – and the key only in its header', async () => {
    const { sent, fetchFn } = recording(answer);
    const e = entry();
    const provider = createRouter({
      members: [{ entry: e, provider: createProviderFor(e, KEY, fetchFn) }],
    });
    const { manifests, known } = ctxFor();
    const res = await ask(QUESTION, { manifests, known, today: TODAY, provider, database: db });
    expect(res).toMatchObject({ ok: true, tier: 'model', result: { kind: 'aggregate' } });

    expect(sent).toHaveLength(1);
    const { body, headers, url } = sent[0]!;
    expect(url).toContain(
      preset === 'anthropic' ? 'anthropic' : preset === 'ollama' ? '11434' : '/',
    );
    // what is sent: question, date, schema
    expect(body).toContain(QUESTION);
    expect(body).toContain('2026-09-29');
    expect(body).toContain('invoice[Rechnung]');
    // what is NOT sent
    for (const secret of DATA) expect(body, secret).not.toContain(secret);
    expect(body).not.toContain(KEY);
    if (keyHeader) expect(Object.values(headers).join(' ')).toContain(KEY);
    else expect(Object.values(headers).join(' ')).not.toContain(KEY);
    expect(JSON.stringify(headers)).not.toMatch(/Geheimfirma|Supermarkt/);
  });

  it.each([
    ['a query', { name: 'run_query', input: { ...INTENT, module: 'planner', collection: 'day' } }],
    [
      'a proposed write',
      { name: 'propose_actions', input: { ops: [{ module: 'planner', action: 'pin', data: {} }] } },
    ],
  ])(
    'pin (3): the planner does not exist for the cloud – %s naming it is unknown-module, the body carries no planner data (stages 2 and 3)',
    async (_what, call) => {
      const { sent, fetchFn } = recording(() => answer(call));
      const e = entry();
      const provider = createRouter({
        members: [{ entry: e, provider: createProviderFor(e, KEY, fetchFn) }],
      });
      const { manifests, known } = ctxFor();
      const res = await ask(QUESTION, {
        manifests: [...manifests, plannerManifest],
        known,
        today: TODAY,
        provider,
        database: db,
        // Cloud writes allowed (stage 2 offered), no local stage: the cloud is asked (tier 3).
        write: { enabled: true, modulesOff: [], cloud: true },
      });
      expect(res).toMatchObject({ ok: false, error: 'unknown-module' });
      expect(sent).toHaveLength(1);
      const { body } = sent[0]!;
      expect(body).toContain(QUESTION);
      expect(body).toContain('propose_actions');
      expect(body).not.toMatch(/planner/);
      for (const secret of [...DATA, ...PLANNER_DATA]) expect(body, secret).not.toContain(secret);
    },
  );

  it('the connection test carries nothing but "ping"', async () => {
    const { sent, fetchFn } = recording(() => ({
      ...(answer() as object),
      choices: [{ message: { content: 'ok' } }],
      content: [{ type: 'text', text: 'ok' }],
      message: { content: 'ok' },
    }));
    const result = await testConnection(entry(), KEY, fetchFn);
    expect(result.ok).toBe(true);
    const body = sent[0]!.body;
    expect(body).toContain('ping');
    for (const secret of DATA) expect(body).not.toContain(secret);
    expect(body).not.toContain('invoice[Rechnung]'); // not even the schemas
    expect(body).not.toContain(KEY);
  });
});

describe('pin (3): schemaHash and prompt with the planner enabled', () => {
  it('are the same as without it – it is not in the schemas, the tools or the text', () => {
    const { manifests } = ctxFor();
    const withPlanner = [...manifests, plannerManifest];
    expect(aiModules(withPlanner).map((m) => m.id)).not.toContain('planner');
    const modes = (list: typeof manifests) => [
      { writable: [] },
      { writable: writableModules(aiModules(list)) },
      { writable: [], off: true },
    ];
    const [a, b] = [modes(withPlanner), modes(manifests)];
    for (let i = 0; i < a.length; i++) {
      expect(schemaHash(aiModules(withPlanner), a[i])).toBe(schemaHash(aiModules(manifests), b[i]));
      expect(buildSystemPrompt(aiModules(withPlanner), a[i])).not.toMatch(/planner/);
    }
  });
});

describe('pin (4): a chat with planner data in the database', () => {
  const MODEL = findModel('qwen3.5-4b')!;
  afterEach(async () => {
    setPlatform(undefined);
    writeLocalPrefs({ file: '', first: true, autoLoad: true, gpu: true });
    await useLocalModel.getState().refresh();
  });

  it('carries no planner data on either engine, also after the switch to the router; the planner was never a context choice', async () => {
    expect(contextModules(visibleManifests).map((m) => m.id)).not.toContain('planner');
    const fake = createFakeLocalModel({
      models: [{ file: MODEL.file, bytes: MODEL.bytes }],
      answer: () => 'Das weiß ich nicht.',
    });
    setPlatform({ ...createWebPlatform(), localModel: fake });
    writeLocalPrefs({ file: MODEL.file, first: true, autoLoad: true, gpu: true });
    await useLocalModel.getState().refresh();
    await db.table('chat_thread').clear();
    await db.table('chat_message').clear();
    // Even a stored thread that names the planner (an old or synced row) gets no planner context.
    const allowed = [...contextModules(visibleManifests).map((m) => m.id), 'planner'];
    const thread = await threadRepo.create({
      title: 'Plan',
      autoTitle: true,
      pinned: false,
      archived: false,
      engine: 'local',
      contextModules: allowed,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    });
    const question = 'Was steht diese Woche im Plan und was blockt den Donnerstag?';
    const context = await buildContext(question, allowed, {
      manifests: [...visibleManifests],
      known: visibleManifests,
      today: TODAY,
    });
    for (const secret of PLANNER_DATA) expect(context ?? '', secret).not.toContain(secret);
    await addQuestion(thread.id, question, context);
    const local = await generateReply(thread.id, {});
    expect(local.ok).toBe(true);
    expect(fake.requests).toHaveLength(1);
    for (const secret of [...DATA, ...PLANNER_DATA])
      expect(fake.requests[0]!.prompt, secret).not.toContain(secret);
    expect(fake.requests[0]!.prompt).not.toMatch(/planner/);

    // The same chat, switched to the router: every adapter gets the conversation and nothing else.
    await threadRepo.update(thread.id, { engine: 'router' });
    for (const c of CASES) {
      const { sent, fetchFn } = recording(textAnswer(c.answer));
      const e: ProviderEntry = { ...entryFromPreset(c.preset), ...c.patch, keySet: true };
      const provider = createRouter({
        members: [{ entry: e, provider: createProviderFor(e, KEY, fetchFn) }],
      });
      await addQuestion(thread.id, 'Und morgen?');
      const res = await generateReply(thread.id, { provider });
      expect(res.ok, c.name).toBe(true);
      expect(sent, c.name).toHaveLength(1);
      const { body } = sent[0]!;
      expect(body).toContain('Und morgen?');
      expect(body).not.toMatch(/planner/);
      for (const secret of [...DATA, ...PLANNER_DATA])
        expect(body, `${c.name}: ${secret}`).not.toContain(secret);
    }
  });
});

describe('presets', () => {
  it('cover the required providers with usable defaults', () => {
    expect(PRESETS.map((p) => p.id).sort()).toEqual(
      ['anthropic', 'custom', 'gemini', 'groq', 'mistral', 'ollama', 'openai', 'openrouter'].sort(),
    );
    for (const p of PRESETS.filter((x) => x.id !== 'custom')) {
      expect(p.model, p.id).not.toBe('');
      if (p.kind !== 'anthropic') expect(p.baseUrl, p.id).toMatch(/^https?:\/\//);
      if (p.baseUrl.startsWith('http://')) expect(p.tier).toBe('local'); // plain http only for local servers
    }
  });

  it('marks free tiers that may train on inputs, and free/local ones as free of charge', () => {
    for (const id of ['gemini', 'groq', 'openrouter'] as const) {
      expect(getPreset(id)).toMatchObject({ tier: 'free', mayTrainOnInputs: true });
      expect(getPreset(id).price).toEqual({ inputPerMTok: 0, outputPerMTok: 0 });
    }
    for (const id of ['openai', 'mistral', 'anthropic'] as const) {
      expect(getPreset(id).mayTrainOnInputs).toBe(false);
      expect(getPreset(id).limits.costUsdPerMonth).toBeGreaterThan(0); // a cost cap by default
    }
    expect(getPreset('ollama')).toMatchObject({ tier: 'local', keyRequired: false });
  });
});

// Identity 4.0, package 0b-2: the palette and the quick capture are the entry points for adding things.
it('palette search: the typed text and the local hits make no provider request; only the explicit question does', async () => {
  const { searchEntries } = await import('./search/fulltext');
  const ollama = CASES.find((c) => c.preset === 'ollama')!;
  const { sent, fetchFn } = recording(ollama.answer);
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchFn;
  try {
    const { manifests, known } = ctxFor();
    // The palette's own call for its live hits (`useSearchHits`): it has no provider to hand over.
    const hits = await searchEntries('Milch', { manifests, database: db }, 5, false);
    expect(hits.map((row) => row.title)).toContain('Milch kaufen');
    expect(sent).toHaveLength(0);

    // Control: an option of kind 'ask' runs the assistant, and that request is seen by the same recorder.
    const e: ProviderEntry = { ...entryFromPreset('ollama'), keySet: true };
    const provider = createRouter({ members: [{ entry: e, provider: createProviderFor(e, '') }] });
    await ask(QUESTION, { manifests, known, today: TODAY, provider, database: db });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toContain(QUESTION);
    // The hits listed before are not part of the question.
    expect(sent[0]!.body).not.toContain('Milch');
  } finally {
    globalThis.fetch = realFetch;
  }
});

it('palette wiring: the search field feeds only the local full-text search, and the assistant is submitted only from an option of kind "ask"', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const hook = read('../../layout/assistant/useAssistant.ts');
  const liveHits = hook.slice(hook.indexOf('export function useSearchHits'));
  expect(liveHits).toMatch(/\bsearchEntries\(/);
  expect(liveHits).not.toMatch(/\bask\(|Provider|createLocalStage|\bfetch\b/);

  const palette = read('../../layout/CommandPalette.tsx');
  // No way to the assistant or a provider except the hook's `submit`.
  expect(palette).not.toMatch(/core\/ai\/assistant'|createRouterProvider|createProviderFor/);
  expect(palette.match(/\bsubmit\(/g)).toHaveLength(1);
  expect(palette).toMatch(/if \(o\.kind === 'ask'\) \{[^}]*\bsubmit\(query\.trim\(\)/);
});

it('quick capture: reading and saving a typed line makes no provider request and does not open the write palette', async () => {
  const { parseCapture } = await import('@/quickCapture/parser');
  const { saveCapture, saveCaptures } = await import('@/quickCapture/targets');
  const { useUiStore } = await import('@/stores/ui');
  const { sent, fetchFn } = recording(() => ({}));
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchFn;
  try {
    useUiStore.setState({ paletteOpen: false, paletteWrite: false, quickAddOpen: true });
    const states = { todos: true, calendar: true };
    const at = { now: new Date(2026, 8, 29, 10, 0) };
    const one = parseCapture('morgen 15 Uhr Zahnarzt Dr. Fuchsbauer', at);
    const saved = await saveCapture(one.type, one.fields, { states, database: db });
    const two = ['Dachboden entrümpeln', 'Werkstatt aufräumen'].map((line) => {
      const parsed = parseCapture(line, at);
      return { type: parsed.type, fields: parsed.fields };
    });
    const batch = await saveCaptures(two, 'Dachboden entrümpeln\nWerkstatt aufräumen', {
      states,
      database: db,
    });
    expect(['todos', 'calendar']).toContain(saved.moduleId);
    expect(batch.count).toBe(2);
    expect(sent).toHaveLength(0);
    // Closing the sheet after the save (`QuickAdd` → `setQuickAddOpen(false)`) opens nothing else.
    useUiStore.getState().setQuickAddOpen(false);
    expect(useUiStore.getState()).toMatchObject({ paletteOpen: false, paletteWrite: false });
    // The write palette is the one explicit action.
    useUiStore.getState().openWritePalette();
    expect(useUiStore.getState()).toMatchObject({ paletteOpen: true, paletteWrite: true });
  } finally {
    globalThis.fetch = realFetch;
    useUiStore.setState({ paletteOpen: false, paletteWrite: false, quickAddOpen: false });
  }
});

it('quick capture code imports nothing of the assistant; "Mit KI eintragen" (quick-add-ai) is the only way from the sheet to AI writing', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const root = new URL('../../quickCapture/', import.meta.url);
  const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter(
    (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f),
  );
  expect(files.length).toBeGreaterThan(20);
  for (const file of files) {
    const src = readFileSync(new URL(file.replaceAll('\\', '/'), root), 'utf8');
    // No assistant, prompt or provider code, no request of its own, no way to the write palette.
    expect(src, file).not.toMatch(/core\/ai\//);
    expect(src, file).not.toMatch(/\bfetch\(|XMLHttpRequest/);
    // (a launcher shortcut may open the plain search palette, never the write mode)
    expect(src, file).not.toMatch(/openWritePalette|paletteWrite/);
  }
  const sheet = readFileSync(new URL('../../layout/QuickAdd.tsx', import.meta.url), 'utf8');
  expect(sheet.match(/\bopenWritePalette\(\)/g)).toHaveLength(1);
  expect(sheet).toMatch(
    /data-testid="quick-add-ai"\s+onClick=\{\(\) => \{[^}]*\bopenWritePalette\(\);/,
  );
});
