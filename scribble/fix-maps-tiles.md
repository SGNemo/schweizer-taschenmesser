# fix/maps-tiles

Reported: in the desktop app the map stayed empty ("Einige Kartenteile konnten nicht geladen werden"), search row looked untidy.
Likely cause (unverified, no desktop shell/network here): OSM refuses requests without a User-Agent; the Tauri HTTP client sends none. Fix: `maps/agent.ts` (native only), status shown in the message, search row as a grid (hint below the row).

For the next chat:

- Hand test on the exe: open Karte; if tiles still fail the message now names the HTTP status (403 = policy/User-Agent, other = network/proxy). If it is not a User-Agent matter, check `http:default` scope in `src-tauri/capabilities/default.json` (currently `https://*`).
