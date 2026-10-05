#!/usr/bin/env node
/**
 * `npm run ai:eval` – evaluation of the AI entry stages on the invented German eval set.
 *   npm run ai:eval                       stage 0 (rules), prints the table
 *   npm run ai:eval -- --bin <llm-batch> --models qwen3.5-4b=<file.gguf>[,id=file …]
 *                      [--gpu-layers 99] [--threads 6] [--context 4096] [--limit 40] [--out results.md] [--template chatml-nothink]
 * Models need the `llm-batch` binary: `cd src-tauri/crates/local-llm && cargo build --release`
 * (add `--features vulkan` for the GPU; see docs/howto/ai-actions.md). Plain Node, so it works the same
 * on Windows, macOS and Linux.
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const env = { ...process.env, AI_EVAL: '1' };
const files = ['src/core/ai/write/eval.test.ts'];
const models = value('--models');
if (models) {
  const bin = value('--bin');
  if (!bin) {
    console.error('--models needs --bin <path to llm-batch>');
    process.exit(2);
  }
  env.AI_EVAL_BIN = bin;
  env.AI_EVAL_MODELS = models;
  const map = {
    '--gpu-layers': 'AI_EVAL_GPU_LAYERS',
    '--threads': 'AI_EVAL_THREADS',
    '--context': 'AI_EVAL_CONTEXT',
    '--limit': 'AI_EVAL_LIMIT',
    '--out': 'AI_EVAL_OUT',
    '--template': 'AI_EVAL_TEMPLATE',
  };
  for (const [flag, name] of Object.entries(map)) if (value(flag)) env[name] = value(flag);
  files.push('src/core/ai/local/eval.models.test.ts');
}
const run = spawnSync('npx', ['vitest', 'run', ...files], { stdio: 'inherit', env, shell: true });
process.exit(run.status ?? 1);
