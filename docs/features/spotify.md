# Spotify connector – "Läuft gerade"

One calm line on the Overview under the weather: `Läuft gerade: Titel – Interpret` with Pause/Weiter and Nächster. Nothing is visible until Spotify is connected; no cover, no progress bar, no colour. Everything else opens Spotify (the title is a link, `rel="noreferrer noopener"`). Rules: [FOCUS-GUIDELINES](../design/FOCUS-GUIDELINES.md). Decision: [decisions/features.md](../decisions/features.md). User guide: [user/spotify.md](../user/spotify.md).

## Behaviour
- Connector `web/src/connectors/spotify/` (`authType: 'oauth-pkce'`, `platforms: ['desktop']`; elsewhere the card says "only in the Windows app"). The user brings their **own Client ID** (Settings → Verbindungen → Spotify; stored via `getPlatform().secrets`, never in the repo; PKCE, no secret field).
- Two features with their own scopes: **Anzeigen** (`user-read-currently-playing`, `user-read-playback-state`) and **Steuern** (`user-modify-playback-state`).
- **Fixed redirect port 38417.** Spotify compares the redirect URI exactly, so the user registers `http://127.0.0.1:38417/callback`. `oauth_listen_start` got an optional `preferred_port`: free → taken, busy → error `port-busy: …` (shown as "Port belegt …"), never a silent other port. `OAuthLoopback.start({ preferredPort? })` is additive; the web platform is unchanged. No new Tauri command, no capability change.
- Data path: additive `ConnectorDef.nowPlaying?: NowPlayingSource` (`read(ctx)` → `{ title, artist, playing, trackUrl } | undefined`, `control(ctx, 'pause'|'play'|'next')`). `home/NowPlayingLine.tsx` reads it through the connector registry; the poller (`core/connectors/nowPlaying.ts`) asks at most every 30 s and **only while `document.visibilityState` is visible** (no timer when hidden, one read on return, at most once per 30 s).
- Errors, all quiet: 204 = nothing plays (line hidden); 401 → fresh token via `ctx.accessToken({ refresh: true })`, one retry, then status "Abgelaufen" (card shows it, line gone); 429 → `Retry-After` is honoured (capped at 10 min); 403 `PREMIUM_REQUIRED` on a control → controls hidden for a day (`tm-spotify-no-premium`), one toast "Steuern braucht Spotify Premium.", the display stays; 404 (no active device), offline, 5xx → last reading stays, no message. Error text goes through `redact()`.
- Last reading: device-local `localStorage` `tm-spotify-now` (Zod-checked, shown only when younger than 10 min before the first fresh read); disconnect and "reset this device" remove it.

## Privacy
Title and artist are user data: never to the AI (the connector cannot import `core/ai`, `privacy.test.ts` untouched), not in diagnostics (canary in `core/diagnostics/diagnostics.test.ts`), not synced (device-local only), not in logs. Data flow `spotify` in [DATA-FLOWS](../legal/DATA-FLOWS.md) and Settings → Über Nemo → Rechtliches.

## Spotify's limits (as documented, re-check before relying on them)
Apps in development mode need an owner with Premium and allow only a few named users (the user's own account must be added under "User management"); one Client ID per developer. Playback control needs the *listener's* account to be Premium. Not built: playback inside Nemo (no Web Playback SDK), cover images, Android/PWA.

## Android / PWA – what is missing
The login needs a redirect Spotify accepts: a fixed HTTPS callback page of our own or an Android deep link (`nemo://` custom scheme registered at Spotify). Both mean new infrastructure or a Tauri mobile plugin; not part of this package.

## Code and tests
`connectors/spotify/{index,api}.ts` (+ tests with handwritten fixtures: track, episode, 204, 403, 429, 401), `core/connectors/nowPlaying.ts` (poller with fake timers, storage), `home/NowPlayingLine.tsx` (+ test), `strings.spotify.ts` (5 languages), `e2e/connector-spotify.spec.ts` (mocked `api.spotify.com`; login = hand test S1–S4 in [MANUAL-TESTS](../MANUAL-TESTS.md)), Rust test for the busy port in `src-tauri/src/oauth.rs`.
