/**
 * Privacy contract for EVERY adapter: what leaves the device is the question, today's date and the
 * compact module schemas (plus the API key in its header) – never user data. Runs the real assistant
 * pipeline against the real adapters with a recording fetch and a database full of recognisable data.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { ask } from './assistant';
import { createProviderFor, entryFromPreset, type ProviderEntry } from './config';
import { getPreset, PRESETS, type PresetId } from './providers/presets';
import { clearCooldown, createRouter } from './router';
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

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  await seed();
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

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** Each adapter kind with the answer shape its API really uses. */
const CASES: {
  name: string;
  preset: PresetId;
  patch?: Partial<ProviderEntry>;
  answer: () => unknown;
  keyHeader: string;
}[] = [
  {
    name: 'Anthropic (SDK)',
    preset: 'anthropic',
    keyHeader: 'x-api-key',
    answer: () => ({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-4-5-20251001',
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'tu_1', name: 'run_query', input: INTENT }],
      usage: { input_tokens: 400, output_tokens: 20 },
    }),
  },
  {
    name: 'Ollama',
    preset: 'ollama',
    keyHeader: '',
    answer: () => ({
      model: 'qwen2.5:7b',
      message: { tool_calls: [{ function: { name: 'run_query', arguments: INTENT } }] },
      prompt_eval_count: 300,
      eval_count: 15,
    }),
  },
  ...(['openai', 'gemini', 'groq', 'openrouter', 'mistral', 'custom'] as const).map((preset) => ({
    name: `OpenAI-compatible: ${preset}`,
    preset,
    patch: preset === 'custom' ? { baseUrl: 'https://llm.example.org/v1', model: 'my-model' } : {},
    keyHeader: 'authorization',
    answer: () => ({
      model: 'm',
      choices: [
        {
          message: {
            tool_calls: [{ function: { name: 'run_query', arguments: JSON.stringify(INTENT) } }],
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
    answer: () => ({
      choices: [{ message: { content: JSON.stringify({ tool: 'run_query', input: INTENT }) } }],
      usage: { prompt_tokens: 500, completion_tokens: 30 },
    }),
  },
];

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
