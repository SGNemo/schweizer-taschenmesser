# feat/spotify-player-pro – for the next chat:

- The player is now `home/SpotifyPlayer.tsx` (shell) + `home/spotify/{Nav inline, SourceView, TrackList, NowBar, useSavedTracks, types}.tsx` + `Spotify.module.css`; data layer `connectors/spotify/browse.ts` (tracks of playlist/album, playFrom, recent, queue, devices, saved/save) behind additive optional methods on `NowPlayingSource`.
- Hidden songs = device-local view setting (`core/connectors/hiddenTracks.ts`), deliberately **not** a removal at Spotify. A real "remove from playlist" / "add to playlist" needs `playlist-modify-private|public` (a new opt-in feature) and a confirm dialog: not built, maintainer's call.
- Unverified against the real service from the sandbox: shapes of `GET /playlists/{id}` (parser accepts `tracks`/`items`, `track`/`item`), `me/tracks/contains`, `me/player/queue|devices|recently-played`. Hand test S7. If Spotify moved `/playlists/{id}/tracks` → `/items` or `me/tracks` → `me/library`, only `browse.ts` and `api.ts#likedSongs` change.
- `pages/settings/inventory.test.ts` "module setting key" snapshot is red on `develop` independent of this work; the core snapshot (`inventory.core.json`) got the new `tm-spotify-hidden` key.
- Phone: library and list take turns (`data-pane`); volume is hidden (hardware keys).
