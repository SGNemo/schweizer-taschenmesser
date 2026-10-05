# Local model for AI writes (PR B)
- **Order:** rules (0 tokens) → local model (0 tokens, offline) → cloud only if allowed; every answer carries its stage.
- **Runtime:** llama.cpp through `llama-cpp-2` (MIT/Apache) in `crates/local-llm`. GBNF grammar per action set forces valid JSON; the system prefix is cached between requests. Cargo feature `local-llm` is off by default so normal CI/release do not compile it; separate CI job covers it. Release builds need the feature, cmake/LLVM (Windows) and for GPU the Vulkan SDK – a `release.yml` change, to be made only after the maintainer agrees.
- **GPU:** Vulkan + CPU (target GTX 1070 / Ryzen 5 7600X). CUDA is out: Pascal is dropped by current CUDA and it adds ~0.5 GB of DLLs.
- **Models:** open licences only (Apache-2.0, MIT). Not bundled; the catalogue is data (`catalogue.json`), downloads are locked until `revision` and `sha256` are pinned. The choice between candidates is the maintainer's, based on `npm run ai:eval` tables.
- **Not in scope here:** Android (CPU "Leicht" profile is a proposal), PWA (no built-in model).
- **Size:** +4.9 MB Linux release exe with the feature (CPU build).
