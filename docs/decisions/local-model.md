# Local model for AI writes (PR B)

- **Order:** rules (0 tokens) → local model (0 tokens, offline) → cloud only if allowed; every answer carries its stage.
- **Runtime:** llama.cpp through `llama-cpp-2` (MIT/Apache) in `crates/local-llm`. GBNF grammar per action set forces valid JSON; the system prefix is cached between requests. Cargo feature `local-llm` is off by default so normal CI/release do not compile it; separate CI job covers it. Release builds need the feature, cmake/LLVM (Windows) and for GPU the Vulkan SDK – a `release.yml` change, to be made only after the maintainer agrees.
- **GPU:** Vulkan + CPU (target GTX 1070 / Ryzen 5 7600X). CUDA is out: Pascal is dropped by current CUDA and it adds ~0.5 GB of DLLs.
- **Models:** open licences only (Apache-2.0, MIT). Not bundled; the catalogue is data (`catalogue.json`), downloads are locked until `revision` and `sha256` are pinned. The choice between candidates is the maintainer's, based on `npm run ai:eval` tables.
- **Not in scope here:** Android (CPU "Leicht" profile is a proposal), PWA (no built-in model).
- **Size:** +4.9 MB Linux release exe with the feature (CPU build).

## Chat module (PR C)

- **Module `chat`** (`threads` + `messages`, synced like other data, so the optional E2E encryption applies). No `aiSchema`, no `searchable`, `dataApi: false`, id in `BLOCKED_MODULES`: chat text never reaches the assistant's query layer, search, data API or local API.
- **Engines per chat:** built-in local model (0 tokens, `stage: local`) or the router (`stage: cloud`, cost counted). Providers get an optional `history` (earlier turns); the entry pipeline does not use it.
- **Context from other modules is opt-in per chat** (default none, never the vault). The question is answered by the local rule parser (no model, no tokens), the text is capped at 2000 characters and shown in a dialog before it is sent; the stored message keeps what was attached.
- **Answers are one piece** for providers (no streaming yet); the local model streams. Markdown is rendered by a small own renderer (no HTML, links only http/https/mailto).
- **Not done:** proposals from inside a chat (the bar stays the place for writes), streaming for providers, token estimate before sending.
