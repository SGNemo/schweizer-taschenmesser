# feat/maps-routing – maps package 2 of 3 (in-app routing)

Done: route menu → "Route auf der Karte berechnen" (walk/bike/car) → FOSSGIS OSRM, line on the map, distance, time, turn list; notice `maps-route`; setting `routingUrl`; netlog host; strings in 5 languages; unit + page + e2e tests. Details: `docs/features/maps.md`.

Decided without asking: transit is not routed with a car profile (stays with the apps until package 3); the answer is not stored; the line is thinned to 1500 points.

For the next chat:

- Package 3 (public transport via Transitous/MOTIS, `api.transitous.org`): needs its own notice, netlog host, and a connection result shape (legs, times, changes). Reuse `fetch`-with-timeout and `MapsError` patterns from `routing.ts`; extend `PlanCard` or add a sibling.
- OSM tile/Nominatim/FOSSGIS usage policy for a wide release stays the maintainer's call (light use only).
- Not done on purpose: route alternatives, voice guidance, live position tracking.
