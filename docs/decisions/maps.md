# Decisions – Karten & Orte

- **Module, not a connector (2026-10-30):** places and routes are the user's own data (Dexie `maps_place`, `maps_route`, synced, no `aiSchema`), so it is a module with a widget; the map and search are services it calls on demand.
- **No map library:** a hand-drawn Web Mercator tile map (`logic.ts` + `TileMap.tsx`, about 300 lines, tested) instead of Leaflet / MapLibre: no new dependency, tiles stay under our network rules. Raster tiles of OpenStreetMap (light use, attribution shown); the tile URL is a setting so a heavy user can bring an own server. Vector tiles would need MapLibre and are left out.
- **Tiles as `blob:` URLs through the platform fetch:** the connection log and "Netzwerk sperren" apply and the CSP `img-src` stays strict. Memory only, 300 tiles.
- **Nothing is requested until the user opens the Karte tab or submits a search** (lists, widget, Overview make no request); first use shows the one-time notice (`maps` in `core/legal/notices.ts`, data flow `maps`, connection-log reason). Search is Nominatim-compatible, on submit only, one request per 1.1 s; coordinates are parsed locally.
- **Routes are saved ends + mode, opened in apps in package 1** (OpenStreetMap with the FOSSGIS engines per mode, Google Maps incl. stops and transit, Apple Karten); OpenStreetMap has no transit routing, so that entry is hidden for transit. In-app routing (package 2, OSRM) and public transport (package 3, Transitous/MOTIS) follow as own PRs.
- **Straight-line distance is labelled as such** ("Luftlinie etwa …") until real routing exists.
