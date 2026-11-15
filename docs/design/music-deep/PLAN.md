# Music – depth and polish (round 2026-11 "Tiefe & Politur")

Ask (maintainer): "Bei Spotify brauche ich einen ‚Playlists'-Tab und generell mehr Funktionen."

## Today (develop, 2026-11-15)
Page `/music` with stage head (cover, player: seek, shuffle, repeat, volume, devices), tabs Start · Suchen · Lieblingssongs · Zuletzt gespielt · Warteschlange, an aside with the next five songs, keyboard shortcuts, the widget (play/pause, next). Your playlists are only on the start view (first 24, no search, sort or edit). The connector already has create / rename / add / remove for playlists (feature "Playlists bearbeiten"), but the page only uses "add to playlist". Cover hosts (`fix/music-covers`, #717, and the desktop follow-up) are merged.

## Goal
A full "Playlists" tab and, by use, more of what the Spotify app does, without new scopes where possible and without new stimulus.

## Packages (each its own branch and PR into `develop`, stacked, merge in order)
1. **p1 Playlists** (`feat/music-deep-p1`): tab "Playlists" – every own and followed playlist (up to 1000), search by name, filter Alle / Eigene / Gefolgte, sort (Spotify order, name, song count), cover tiles; the playlist view gets description, "Bearbeiten" (name, description), "Aus Playlist entfernen" with Rückgängig; "Neue Playlist" in the tab. Scopes: existing `playlists` + `playlistEdit`. New read: `GET /me` (account id only, to tell own from followed).
2. **p2 Albums and artists** (`feat/music-deep-p2`): tab "Alben" (saved albums, `user-library-read`), save / remove an album (`user-library-modify`), artist view (albums, top songs; from a song's "⋯" and from the search), "Weiterhören" on the start view (the last playlists and albums from the history, no extra request).
3. **p3 Player extras** (`feat/music-deep-p3`): sleep timer (pause after 15/30/45/60 min or at the end of the song, only while Nemo is open, off by default), "Liedtext suchen" (opens an external search, on tap only), shortcuts for volume and shuffle, the widget gets "Zurück" from size M.

## Not built (reasons in the PRs)
- Editing the queue: Spotify's Web API can only add to the queue (no remove, no reorder).
- Following artists / playlists: needs the new scopes `user-follow-read` / `user-follow-modify` (playlist follow needs `playlist-modify-*`, already there, but unfollow from Nemo is not asked for) – listed under "Im Nachhinein klären".
- Playback inside Nemo (Web Playback SDK), Android login: unchanged.
