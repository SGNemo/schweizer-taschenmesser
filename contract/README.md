# Sync contract fixtures

`lww-cases.json` describes the one rule both projects must implement identically:
**per (collection, id, field) the op with the greatest HLC string wins** (plain string comparison;
equal HLCs change nothing).

- `server/test/contract.test.ts` pushes the batches to the sync server and reads the state back.
- `web/src/core/sync/contract.test.ts` applies the same batches to the local Dexie database.

Every case is checked with the batches in the given order and in reverse order – the final state
must not depend on arrival order. `expected` maps `"<collection>/<id>"` to the winning
`{ hlc, value }` per field.
