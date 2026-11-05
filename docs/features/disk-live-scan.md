# Dieser PC: live scan (map and list grow while the scan runs)

Built on `fix/disk-scan-live` (2026-11-05). Module `disk`, desktop only. Decision: [decisions/modules.md](../decisions/modules.md) (Dieser PC); rules: [RULES](../RULES.md).

## Behaviour
- The scan runs in a Rust thread; the whole app stays usable. The scan page and the drives page show **one line** ("Scan läuft · bisher 312.000 Dateien, 210 GB", a new figure at most once a second) with Pause and Abbrechen: no bar, no percentage, no toast for progress ([FOCUS-GUIDELINES](../design/FOCUS-GUIDELINES.md)).
- While it runs, the page shows what is known so far as a **map or a list** of the top two folder levels (`disk_scan_live`, polled every 1.5 s while the page is open; the store keeps the last picture, so leaving the module and coming back shows it at once). Folders whose walk has not returned are **pending**: "…" and a dashed outline on the tile, "zählt noch" in the list, "Wird noch gezählt" in the tooltip.
- On the drives page the line lives in the card of the scanned drive (a clean-up place's scan keeps a line above the grid); it stays after the scan ended ("Scan von C:\ beendet · Zum Ergebnis"; "abgebrochen" after Abbrechen; after a failure the reason with "Zum Scan"; it stays until the next scan starts, as the way back to the result), and another drive's scan button leads to the running scan instead of replacing it (one toast). The live list keeps a stable order by name while sizes still move.
- View only: opening, selecting and deleting come with the finished tree (`tree_of` answers `not-finished` in Rust until then). The finished result is unchanged.

Screenshots (e2e build, invented data): [map](shots/disk-live-scan-map.jpg) · [list](shots/disk-live-scan-list.jpg) · [drives page](shots/disk-live-scan-drives.jpg).

## Numbers (Linux VM, 4 cores, release build of the crate; parse times measured in Node as a stand-in for the webview)
| Case | Rust `snapshot` | payload | parse |
|---|---|---|---|
| depth 2, 1.5 k live folders, canvas cutoff | 0.02 ms | 217 nodes · 54 KB | 0.3 ms |
| depth 2, 9 k live folders, canvas cutoff | 0.13 ms | 232 nodes · 58 KB | 0.3 ms |
| depth 2, 9 k live folders, no cutoff (what a pushed event would carry) | 0.8 ms | 2.2 MB | 4 ms |
| depth 3, 144 k live folders, canvas cutoff | 4.3 ms | 283 nodes · 72 KB | 0.3 ms |
| 500 k files in 10 k folders, whole scan incl. live tree | 229 ms | – | – |

Poll won over a pushed event: the poll carries the canvas-derived `minBytes`, costs nothing while nobody looks, and needs no new command or capability. `LIVE_DEPTH` stays 2: the map draws two levels, and depth 3 would hold the live lock for up to 4 ms per poll on big drives.

## Code
Rust `crates/disk-scan/src/live.rs` (`done`, `pending`), `scan.rs` (`finish` when a folder's walk returns), `tree.rs` (`NodeView.pending`, never set in the finished tree); seam `core/platform/disk.ts` (`DiskNode.pending?`); `modules/disk/store.ts` (`live`, `pollLive`, `PROGRESS_MS`, `LIVE_POLL_MS`), `components/{ScanStatusLine,LiveView,TreemapView}.tsx`; e2e `e2e/disk.spec.ts` steps the fake scan by hand (`__tmDiskScanStepMs` 0, `__tmDiskScanStep()`).
