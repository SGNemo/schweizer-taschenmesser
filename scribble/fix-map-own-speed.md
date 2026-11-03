# fix/map-own-speed – own map: faster build after the first device run

Seen on the maintainer's device (Erlangen, lean, 20 cells): minutes per build, then "Angehalten bei 11 von 20 · Die Antwort des Kartendienstes war nicht lesbar". Causes as far as the code shows (no network in the sandbox): one request per z13 cell with eleven tag-filtered bbox statements each; a blind 5/15/45 s retry on 429 while the public server's slots (two per client, cooldown after each query) were still taken; a non-OK status outside 429/503/504 (502 from the front proxy is the likely one) or a garbled body went straight to "error".

Done: blocks of four cells per request (`plan.ts` `blocksOf`, cells in block order), set-based query (`way(bbox)->.w` etc., `[timeout:180][maxsize:256 MiB]`), two requests in flight with in-order writes, waits from `/api/status` (`slotWaitSeconds`, capped 120 s), 500/502 transient, one retry of a garbled answer, a timed-out partial answer = busy.

for the next chat:

- The real timing per block is still unknown: ask the maintainer what the connection log (Einstellungen → Verbindungen) shows per request (status, duration). If 429 still dominates, the next lever is one request per z11 block for the lean level (16 cells; answers up to ~30 MB, so only on desktop).
- A region paused before this change resumes in the new cell order (blocks): delete and rebuild once; the decision bullet says so.
- The first screenshot also showed "Einige Kartenteile konnten nicht geladen werden" for the online tiles (tile.openstreetmap.org) before any build: unrelated to the builder; worth a look at the connection log on the device (status codes) if it repeats.
