# feat/maps-transit – maps package 3 of 3 (public transport)

Done: menu of a bus & train route → "Verbindungen suchen" → Transitous (MOTIS) → up to 3 connections, step list, line on the map; notice `maps-transit`; setting `transitUrl`; netlog host; strings in 5 languages; unit + page + e2e tests. Details: `docs/features/maps.md`. Stacked on #323 (`feat/maps-routing`): retarget the PR to `develop` after #323 is merged.

Decided without asking: connections start "now"; stops on the way are not sent; no data → calm text + map apps.

For the next chat:

- The MOTIS answer shape was written from the v1 API docs and could NOT be checked live (sandbox had no network to `api.transitous.org`). First thing on a device: run "Verbindungen suchen" once (hand test) and compare with `transit.ts` schema; the parser is defensive, fixtures are in `maps.transit.test.ts`.
- Ideas, not done: departure time picker, "arrive by", saving a favourite connection, stops via MOTIS stop ids.
