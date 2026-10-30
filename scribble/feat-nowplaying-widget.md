# feat/nowplaying-widget – for the next chat:
- `home/useNowPlaying.ts` is the one place with poller + Premium handling; the card (`NowPlayingLine`) and the dialog (`SpotifyPlayer`) both use it.
- `NowPlaying`/`NowPlayingSource`/`NowPlayingCommand` in `core/connectors/types.ts` got additive members (album, cover, progress, previous, state/seek/volume/shuffle/repeat/search/likedSongs/play).
- New feature `library` (`user-library-read`) needs a reconnect; existing connections keep working without it.
- Cover = fetch + blob URL (CSP `img-src` untouched). If someone loosens the CSP for images, keep the host check `COVER_URL`.
- Maps replacement was asked for in the same message: NOT built (needs a tile source = new data flow and either a dependency or a hand-rolled slippy map); see the chat summary / BOARD.
