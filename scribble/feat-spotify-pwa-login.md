# feat/spotify-pwa-login – for the next chat:

- Browser login = `core/connectors/oauthRedirect.ts` + `pages/OAuthCallback.tsx` + route `oauth/callback` in `router.tsx`; generic for any provider with `oauth.browserLogin: true` (https redirect, PKCE without secret). Google stays desktop-only (needs a client secret and does not accept this redirect for a "Desktop app" client).
- Unverified from the sandbox: CORS of `accounts.spotify.com/api/token` and `api.spotify.com` for a browser `fetch` (hand test S6). If the token endpoint refuses, the PWA could route it through the sync server proxy (`server/src/proxy.ts` is GET-only and narrow, so that would be a new decision).
- Android app: no login. A deep link needs a Tauri plugin = new Cargo dependency (maintainer).
- Fixed on the way: a never-connected connector card had every feature unticked and "Verbinden" disabled (the empty stored list hid the defaults). It now starts from the defaults.
- `redirect.ts` (leaf) exists so connectors can name the callback address without importing the login code (circular import with the registry).
