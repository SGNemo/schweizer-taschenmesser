# Decisions in full – Core – test data / seeds

Part of [core](core.md). Index of areas: [DECISIONS](../DECISIONS.md).

## Test data / seeds (2026-10-02)

- **Seeds are part of every module (`seed` in the manifest is required by the type).** New modules cannot be merged without test data, because the Dev-Preview, E2E tests and screenshots depend on it; `core/seed/registry.test.ts` and `check:modules` fail otherwise. Alternative (optional field + warning) rejected: parallel chats would skip it.
- **Metadata in the manifest, code in `modules/<id>/seed.ts` loaded by glob.** A function in the manifest would end up in the stable bundle; the glob is only reachable through `loadSeed`, which the build replaces with `undefined` unless `VITE_RELEASE_CHANNEL=dev` (`devFlag.test.ts` builds both flavours and greps the output).
- **Own mulberry32 generator instead of faker.** No new dependency or supply-chain surface, tiny bundle, output cannot change with a library update. One stream per module (`hash("42:<module>")`), so adding a module never shifts the others.
- **Seed rows go through `createCollectionRepo` (valid envelope, HLC) but are registered in the local table `_seeds` first.** Outbox, "upload everything" and backup skip registered rows (also in stable builds, so a stable app opening a dev database cannot leak them); the dev switch "Seed-Sync erlauben" (default off) queues them once, and removal then writes tombstones. Modules switched on for the seed are registered too.
- **Demo vault: fixed visible passphrase `nemo-demo-tresor` (10+ characters, `createVault` requires it), dev build only, never overwrites a vault.** Crypto unchanged; the entries use placeholder passwords.
- **E2E for the dev flavour is a separate Playwright project (`seed-dev`, build mode `e2e-seed`, :4174).** The regular specs stay on the stable build so the stable path stays covered.
