# ci/e2e-speed (PR #509, merged 2026-11-07) – for the next chat

- Measured on `develop` after the merge: full CI runs spend 9.2–11.6 min in E2E (11 runs, 2026-11-07), before 22.8 min median.

- Found, not fixed (identical on develop, sync rule-pinned): `e2e/sync/sync.spec.ts:211` "the server sees only ciphertext…" fails every time locally in a full `npm run e2e:sync` (device B's outbox stays at 1 after the reload, `syncNow` at :245) but passes alone (`-g "server sees only ciphertext"`, 2/2). Order-dependent on the shared in-memory server. In CI `:261` (encryption on a server with plain data) is flaky on develop (retry hides it).
- `e2e/seed/seed.spec.ts` "dev flavour …" and "seed data never enters the sync outbox" fail on develop (known, BOARD 2026-11-06).
- Single red E2E jobs on `develop` after the merge, green again in the next runs (untouched by #509): `seed.spec.ts:49` (run 42400516735), `notes.spec.ts:77` (42404380286), `automation.spec.ts:35` + `comfort-toolbox.spec.ts:63` flaky (42335236936). A flake-fix package should take these together.
- `e2e/assistant.spec.ts:492` (rate-limited provider, statistics "2 Anfragen") failed 2 of 3 local smoke runs at 2 and 4 workers; flaky.
- Specs that need seed data: `test` + `test.use({ seeded: { scale } })` from `e2e/seed/helpers.ts` instead of `seedApp` in `beforeEach`.
- Remaining fixed waits (≈ 9 s per run) assert that nothing happens (network, Spotify, maps tiles, share player, topbar); `comfort-toolbox` 500 ms before a reload waits for a synced settings write.
