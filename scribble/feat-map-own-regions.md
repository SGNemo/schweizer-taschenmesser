# feat/map-own-regions – own map package 4 (prebuilt region files)

Done: `own/pmtiles.ts` (PMTiles v3 reader without a library: header, root + leaf directories, Hilbert ids, metadata, range requests, gzip flag; `encodePmtiles` fixture writer with optional leaves), `own/sample.ts` `samplePmtiles()`, builder source "file" (`createAndStart({ fileUrl })` → `file: 'used' | 'miss' | 'unreachable'`, `runFileRegion`: tiles per z13 cell four at a time, then the lower zooms, no pyramid; `upgrade` ignores file regions), region fields `sourceUrl` / `credit`, setting `regionUrl`, `TileBytes.gzip`, RegionsCard ("aus Kartendatei", credit, no "Genauer machen"), notes under the map, legal texts + DATA-FLOWS row; tests (pmtiles, builder, page, e2e with a range-serving mock host). Details: `docs/features/map-own.md` "Status", decision bullet.

Decided without asking: a region file is a build source that fills the same local tables (no read-through source: the map stays one store, offline stays simple); the whole file is never downloaded; fallback to Overpass when the file does not cover the place or its host does not answer, with a calm note; file regions take the file's zooms (clamped to 8–16) and are "full" when the file holds z15+; four tiles in flight per batch (small files, calm hosts).

for the next chat:

- No real region file was tested (sandbox has no network, no Planetiler). A file from Planetiler/OpenMapTiles names its layers differently (`transportation`, `building`, `water`, …) than `own/cut.ts` (`road`, `building`, `water`, …?) – check `own/styleTable.ts` and add a small layer/class mapping when the maintainer has a file; the reader itself is spec-driven (`maps.own.pmtiles.test.ts`).
- Possible speed-up for big files: PMTiles are clustered, so the tiles of one leaf lie next to each other – one range per leaf run instead of one per tile would cut requests ~10×. Not done: not needed for the first file.
- `check:docs` budget: `docs/features/map-own.md` is the longest maps doc now; trim the plan section when package 5 lands.
- Still open from package 3: the live Overpass answer on a device; a lean/full choice before the first build; progress for the overview phase.
