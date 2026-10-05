/**
 * Measures local model candidates on the eval set (`tests/ai/eval-set.json`). The prompts and grammars
 * are built here (the exact text the app sends); the model is run by `llm-batch`, a thin binary around
 * the same engine the app ships, so what is measured is what runs. Skipped unless a binary and models
 * are given: `npm run ai:eval -- --bin <llm-batch> --models qwen3.5-4b=<file.gguf>` (see
 * `docs/howto/ai-actions.md`, "Local model: measure candidates").
 *
 * Per model: exact / module+action right / invalid answers, load time, latency (first request cold,
 * the rest with the prompt prefix cached), tokens/s, peak memory, download size.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { setNow } from '@/core/time/now';
import { writableModules } from '../prompt';
import {
  EVAL_NOW,
  EVAL_TODAY,
  evalCases,
  evalManifests,
  scoreProposal,
  seedEvalFixtures,
  type Outcome,
} from '../write/evalSupport';
import { parseAnswer } from './answer';
import { findModel, TEMPLATES, type TemplateId } from './catalogue';
import { buildGrammar } from './grammar';
import { formatChat, PROMPT_VERSION, systemPrompt, userMessage } from './prompts/v1';

const bin = process.env.AI_EVAL_BIN;
const models = (process.env.AI_EVAL_MODELS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const i = s.indexOf('=');
    return { id: s.slice(0, i), path: s.slice(i + 1) };
  });
const limit = Number(process.env.AI_EVAL_LIMIT ?? 0) || undefined;
const gpuLayers = process.env.AI_EVAL_GPU_LAYERS ?? '0';
const threads = process.env.AI_EVAL_THREADS;
const context = process.env.AI_EVAL_CONTEXT ?? '4096';
const out = process.env.AI_EVAL_OUT;

interface Row {
  id: string;
  ok: boolean;
  error?: string;
  result?: {
    text: string;
    prompt_tokens: number;
    cached_tokens: number;
    generated_tokens: number;
    prompt_ms: number;
    generate_ms: number;
    stop: string;
  };
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s[Math.floor(s.length / 2)]!;
};
const p95 = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]!;
};
const pct = (n: number, d: number) => (d === 0 ? '–' : `${((n / d) * 100).toFixed(1)} %`);
const gb = (b: number) => `${(b / 1024 ** 3).toFixed(2)} GB`;

beforeAll(async () => {
  setNow(() => EVAL_NOW.getTime());
  await seedEvalFixtures();
});
afterAll(() => setNow());

describe.skipIf(!bin || models.length === 0)('local models on the eval set', () => {
  for (const model of models) {
    it(`measures ${model.id}`, { timeout: 4 * 60 * 60 * 1000 }, async () => {
      const entry = findModel(model.id);
      const template = (entry?.template ??
        process.env.AI_EVAL_TEMPLATE ??
        'chatml-nothink') as TemplateId;
      if (!(template in TEMPLATES)) throw new Error(`unknown template ${template}`);
      const writable = writableModules(evalManifests);
      const system = systemPrompt(writable);
      const grammar = buildGrammar(writable);
      const cases = limit ? evalCases.slice(0, limit) : evalCases;

      const dir = mkdtempSync(join(tmpdir(), 'nemo-eval-'));
      const input = join(dir, 'cases.jsonl');
      const output = join(dir, 'out.jsonl');
      writeFileSync(
        input,
        cases
          .map((c) =>
            JSON.stringify({
              id: c.id,
              prompt: formatChat(template, system, userMessage(c.input, EVAL_TODAY)),
              grammar,
              max_tokens: 480,
            }),
          )
          .join('\n'),
      );
      const args = [
        '--model',
        model.path,
        '--input',
        input,
        '--output',
        output,
        '--gpu-layers',
        gpuLayers,
        '--context',
        context,
      ];
      if (threads) args.push('--threads', threads);
      const run = spawnSync(bin!, args, { stdio: ['ignore', 'inherit', 'inherit'] });
      if (run.status !== 0) throw new Error(`llm-batch failed (${run.status})`);

      const lines = readFileSync(output, 'utf8').trim().split('\n');
      const summary = JSON.parse(lines.pop()!).summary as {
        info: { load_ms: number; backend: string; parameters: number };
        peak_memory_bytes: number | null;
      };
      const rows = new Map<string, Row>(
        lines.map((l) => JSON.parse(l) as Row).map((r) => [r.id, r]),
      );

      const outcomes: Outcome[] = [];
      let invalid = 0;
      const total: number[] = [];
      const cold: number[] = [];
      const gen: number[] = [];
      let tokens = 0;
      let ms = 0;
      for (const c of cases) {
        const row = rows.get(c.id);
        const text = row?.ok ? row.result!.text : '';
        const proposal = parseAnswer(text);
        let json = true;
        try {
          JSON.parse(text);
        } catch {
          json = false;
        }
        if (!json) invalid++;
        outcomes.push(await scoreProposal(c, proposal));
        if (row?.ok) {
          const r = row.result!;
          total.push(r.prompt_ms + r.generate_ms);
          (r.cached_tokens === 0 ? cold : gen).push(r.prompt_ms + r.generate_ms);
          tokens += r.generated_tokens;
          ms += r.generate_ms;
        }
      }
      const count = (o: Outcome) => outcomes.filter((x) => x === o).length;
      const positives = cases.filter((c) => c.expect.length > 0).length;
      const negatives = cases.length - positives;
      const lines2 = [
        `### ${model.id} – prompt v${PROMPT_VERSION}, ${gpuLayers === '0' ? 'CPU' : `GPU (${summary.info.backend})`}, ${cases.length} inputs`,
        '',
        '| exact | module+action right | wrong | passed on | negatives kept out | invalid JSON | load | median / p95 per input | tokens/s | peak RAM | download |',
        '|---|---|---|---|---|---|---|---|---|---|---|',
        `| ${pct(count('exact'), positives)} | ${pct(count('exact') + count('partial'), positives)} | ${pct(count('wrong'), positives)} | ${pct(count('escalate'), positives)} | ${negatives - count('false-positive')}/${negatives} | ${invalid} | ${(summary.info.load_ms / 1000).toFixed(1)} s | ${(median(total) / 1000).toFixed(1)} s / ${(p95(total) / 1000).toFixed(1)} s | ${ms > 0 ? ((tokens / ms) * 1000).toFixed(1) : '–'} | ${summary.peak_memory_bytes ? gb(summary.peak_memory_bytes) : '–'} | ${entry ? gb(entry.bytes) : '–'} |`,
        '',
        `first request (cold prompt): ${(median(cold) / 1000).toFixed(1)} s · later requests (prefix cached): ${(median(gen) / 1000).toFixed(1)} s`,
        '',
      ].join('\n');
      process.stdout.write(`\n${lines2}\n`);
      if (out) appendFileSync(out, `${lines2}\n`);
    });
  }
});
