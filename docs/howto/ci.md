# CI and Dev-Preview

CI jobs, caches, sharding; rolling Dev-Preview build. Index: [HOW-TO](../HOW-TO.md). Commands run in `web/` unless stated.

- [ci-layout](ci-layout.md) – "CI layout, caches and sharding": which checks run when, concurrency, small packages, Windows release cache, jobs side by side, doc-only changes, shards, caches, timeouts; "Bundle budget (warnings only)"
- [ci-stimulus-budget](ci-stimulus-budget.md) – "Stimulus budget and ratchet", part 1: what is measured, strict bands, signature blocks, lowering a budget, seed rows, baselines that only shrink
- [ci-ratchet](ci-ratchet.md) – "Stimulus budget and ratchet", part 2: will my PR need Sven?, the ratchet script and its hit table, in CI (feedback, not proof)
- [ci-ratchet-signing](ci-ratchet-signing.md) – "Stimulus budget and ratchet", part 3: one-time setup, at the merge (`nemo-merge` rule 7), the approval is a signature, Sven's steps on a hit PR, key, agents
- [ci-dev-preview](ci-dev-preview.md) – "Dev-Preview": what, never lost, files, version, install, dev channel, back to stable, manual trigger, cleanup
