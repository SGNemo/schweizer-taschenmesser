# Sync contract fixtures

`lww-cases.json` describes the one rule both projects must implement identically:
**per (collection, id, field) the op with the greatest HLC string wins** (plain string comparison;
equal HLCs change nothing).

- `server/test/contract.test.ts` pushes the batches to the sync server and reads the state back.
- `web/src/core/sync/contract.test.ts` applies the same batches to the local Dexie database.

Every case is checked with the batches in the given order and in reverse order – the final state
must not depend on arrival order. `expected` maps `"<collection>/<id>"` to the winning
`{ hlc, value }` per field.

## Paging contract

`sync-paging-cases.json` pins what `core/sync/engine.ts` assumes of a store: pages in `seq` order with `cursor`/`more`, refused ops consume no `seq`, epoch changes on reset, plus the handler errors `hlc-drift` and the size limits. Cases have a `level`: `store` (checked in `server/test/paging.test.ts` and `web/src-tauri/crates/lan-sync/tests/contract.rs`) or `handler` (Node server now, hub handler in package 2), or `server` (Node server only: once a vault exists a push with a non-`enc:v1:` value is refused as `missing-enc`, and a vault cannot be created beside stored ops, `not-empty`; the hub is always encrypted and tests its own `missing-enc`). Device management, Web Push and the proxy are not part of it.
