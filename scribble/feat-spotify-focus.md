# feat/spotify-focus – for the next chat:

- The only code that steers the player in a focus round is `core/focus/music.ts` (`onFocusStart` from `modules/todos/focus.ts#beginFocus`, `onFocusEnd` from `layout/FocusWatcher.tsx` and the two end buttons in `FocusPage.tsx`). `music.test.ts` counts the control calls in the file: add a new start/end hook there and the test tells you.
- The choice is device-local (`tm-spotify-focus`), not in the synced `focus` scope: Spotify is connected per device, a synced playlist id would point at nothing on the other devices.
- "Playlists" is an opt-in feature (`ConnectorFeature.defaultOn: false`, scope `playlist-read-private`): people connected in package 1 have to tick it and connect again. The settings row says so.
- Only the first 50 playlists are listed (`GET /me/playlists?limit=50`), no paging; paging is a small follow-up in `connectors/spotify/api.ts`.
- `play` with `context_uri` needs an active device; with Spotify closed it answers 404 (`NO_ACTIVE_DEVICE`) and the focus screen shows "Musik: nicht erreichbar". Hand test S5.
