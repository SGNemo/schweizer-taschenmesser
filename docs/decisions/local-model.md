# Local model for AI writes (PR B)

- **AI writes (PR A, 0.3): rules → local model → cloud, always via a preview the user confirms; actions per module (`aiSchema.actions`); the cloud sees schemas, never entries; the local model is optional and never bundled.**
- **Order:** rules (0 tokens) → local model (0 tokens, offline) → cloud only if allowed; every answer carries its stage.
- **Runtime:** llama.cpp through `llama-cpp-2` (MIT/Apache) in `crates/local-llm`. GBNF grammar per action set forces valid JSON; the system prefix is cached between requests. Cargo feature `local-llm` is off by default so normal CI/release do not compile it; separate CI job covers it. Release builds need the feature, cmake/LLVM (Windows) and for GPU the Vulkan SDK – a `release.yml` change, to be made only after the maintainer agrees.
- **GPU:** Vulkan + CPU (target GTX 1070 / Ryzen 5 7600X). CUDA is out: Pascal is dropped by current CUDA and it adds ~0.5 GB of DLLs.
- **Models:** open licences only (Apache-2.0, MIT). Not bundled; the catalogue is data (`catalogue.json`), downloads are locked until `revision` and `sha256` are pinned. The choice between candidates is the maintainer's, based on `npm run ai:eval` tables; first round and a preliminary recommendation (Qwen3 4B for Standard, Leicht open) in [features/local-model-eval.md](../features/local-model-eval.md).
- **Not in scope here:** Android (CPU "Leicht" profile is a proposal), PWA (no built-in model).
- **Size:** +4.9 MB Linux release exe with the feature (CPU build).
- **Dev-Preview builds with `local-llm-vulkan` too (2026-11-06):** measured warm cost ≈ +2 min on the Windows job (same commit: release 8:25 vs. preview 6:22); without it testers saw "built without" and could not try the model. Where a build lacks it, the UI names the case (browser, Android, test version, other build, CPU) via `core/ai/local/availability.ts`, and hints only send users to "Lokales Modell" when it can be downloaded there.

## Chat module (PR C)

- **Module `chat`** (`threads` + `messages`, synced like other data, so the optional E2E encryption applies). No `aiSchema`, no `searchable`, `dataApi: false`, id in `BLOCKED_MODULES`: chat text never reaches the assistant's query layer, search, data API or local API.
- **Engines per chat:** built-in local model (0 tokens, `stage: local`) or the router (`stage: cloud`, cost counted). Providers get an optional `history` (earlier turns); the entry pipeline does not use it.
- **Context from other modules is opt-in per chat** (default none, never the vault). The question is answered by the local rule parser (no model, no tokens), the text is capped at 2000 characters and shown in a dialog before it is sent; the stored message keeps what was attached.
- **Answers are one piece** for providers (no streaming yet); the local model streams. Markdown is rendered by a small own renderer (no HTML, links only http/https/mailto).
- **Not done:** proposals from inside a chat (the bar stays the place for writes), streaming for providers, token estimate before sending.

## Modules without `aiSchema` (planner, package 4)

- **A module without `aiSchema` may use the local stage with its own prompt and grammar (2026-11-06):** the entry pipeline (`stage.ts`, prompt `v1.ts`, `aiModules()`/`writableModules`) stays the one route for modules with a schema; a module that must stay invisible to the cloud, the search and the chat (the planner, `decisions/plan.md`) may still ask the built-in model directly – new files under `core/ai/local/prompts/` only (`plan.ts`), the same catalogue, prefs, `ensureLoaded`, `localStageReady()` and chat templates, the platform seam `getPlatform().localModel.generate` as the only way to the model, its own GBNF grammar with every repetition bounded, and the same gate `(await isAiOn()) && localStageReady()`. Nothing of it may touch `core/ai/{scope,assistant}.ts` or `core/ai/write/*`, and such a module never gets a cloud stage: without a schema the cloud cannot even name it (`privacy.test.ts` pins 3 and 4).
