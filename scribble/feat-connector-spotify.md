# feat/connector-spotify – for the next chat:

- Package 2 (`feat/spotify-focus`, music in the focus round) is **not started**: needs this PR merged first. It calls `nowPlaying.control` only at start/end of a focus round; a playlist picker needs the extra scope `playlist-read-private` (a third feature or a re-login) and a `play` with `context_uri` in `connectors/spotify/api.ts` (today `play` only resumes).
- Android / PWA: the login needs an HTTPS callback page of our own or a deep link registered at Spotify; the fixed port only works with the desktop loopback listener.
- The website privacy page and README list the data flows: the new flow `spotify` (`core/legal/dataFlows.ts`, `docs/legal/DATA-FLOWS.md`) is not yet mentioned there – maintainer/legal chat.
- Spotify's developer-mode limits (own account under "User management", Premium owner) are in the user docs from the public rules; re-check on the first real login (hand test S1).
- `ConnectorContext.accessToken({ refresh: true })` is new (skips the in-memory token after a 401).
- Local Rust checks need the GTK/WebKit dev packages (`apt-get update` first); `cargo test --lib -p taschenmesser oauth` is quick after the first build.
