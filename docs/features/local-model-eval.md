# Local model measurements (first round, 2026-10-05/06)

Question: which open model should be the built-in stage 1 ("Standard" profile)? Measured with `npm run ai:eval -- --bin <llm-batch> --models <id>=<file>` ([howto/ai-actions.md](../howto/ai-actions.md)): prompt v1, grammar-forced JSON, tuning set `tests/ai/eval-set.json`, first 40 inputs (0.8B: 60), CPU only (4 cores of a sandbox, no GPU). Absolute times are therefore much worse than on a desktop with GPU; compare models with each other, not with the stopwatch.

| Model (Q4_K_M) | exact | module+action right | wrong | invalid JSON | median / p95 per input | prompt cache | peak RAM | download |
|---|---|---|---|---|---|---|---|---|
| Qwen3.5 4B | 77.5 % | 85.0 % | 12.5 % | 1 | 79 s / 142 s | no | 4.3 GB | 2.55 GB |
| Qwen3 4B | 67.5 % | 87.5 % | 12.5 % | 0 | 12 s / 34 s | yes | 4.7 GB | 2.33 GB |
| Phi-4 mini | 57.5 % | 80.0 % | 17.5 % | 1 | 10 s / 41 s | yes | 4.3 GB | 2.32 GB |
| Qwen3.5 2B | 52.5 % | 82.5 % | 12.5 % | 2 | 34 s / 36 s | no | 2.0 GB | 1.19 GB |
| Qwen3.5 0.8B | 48.3 % | 75.0 % | 25.0 % | 0 | 19 s / 26 s | no | 1.0 GB | 0.50 GB |

## What the numbers say
- **Qwen3.5 models cannot reuse the prompt cache** (recurrent layers): every request reads the whole ~2k-token prompt again. On CPU that is 30–80 s; on a GPU it is seconds, but the difference stays. Qwen3 and Phi-4 mini keep the cache (first request ~68 s cold, then ~12 s).
- **Most errors are in the fields, not in the choice of module/action:** Qwen3 4B gets module+action right in 87.5 % but the whole op exactly right in 67.5 %. The rule stage (94 %+ on the same kind of sentences) stays the main path; the model only sees what rules cannot read.
- **No model is good enough as "Leicht" (≤ 2B)** with prompt v1: 0.8B has 25 % wrong module/action, 2B 52.5 % exact.
- **Two readings (top-2):** a second pass with the first answer's module/action forbidden (`--top2`, `core/ai/local/top2.ts`) raised module+action right from 87.5 % to 90.0 % (one input of 40) and did not change exact. Asking for two answers in one reply fails: the model leaves the second empty (39 of 40). So "show two suggestions" would mostly help when the module is ambiguous, not for wrong fields. Not built into the app.

## Preliminary recommendation (the maintainer decides)
- **Standard:** Qwen3 4B – best speed with a working cache, accuracy close to Qwen3.5 4B. Qwen3.5 4B is more accurate (77.5 %) but slow without the cache; worth re-measuring on the GTX 1070 (Vulkan) before deciding.
- **Leicht:** open. Candidates for the next step: a prompt/grammar tuned for small models, or a small model fine-tuned on Nemo's own action schema (LoRA on Qwen3 0.6B/1.7B, training data generated from the rule parser and the module `examples`, held-out set kept separate).
- Re-run on the real hardware (`--gpu-layers 99`, all 154 inputs, plus `eval-heldout.json` / `eval-blind.json` once the harness takes a set argument) before any model is marked recommended.

## Limits of this round
40 inputs per model, one run each (± ~8 points of noise), tuning set only, CPU only. Treat differences below ~10 points as a tie.
