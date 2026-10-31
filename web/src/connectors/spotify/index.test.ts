import { describe, expect, it } from 'vitest';
import { buildAuthUrl } from '@/core/connectors/oauth';
import connector, { SPOTIFY_REDIRECT_PORT } from './index';

const loginUrl = (featureIds: string[]) =>
  new URL(
    buildAuthUrl({
      endpoints: connector.oauth!,
      clientId: 'client-invented-123',
      redirectUri: `http://127.0.0.1:${SPOTIFY_REDIRECT_PORT}/callback`,
      scopes: connector.features.filter((f) => featureIds.includes(f.id)).flatMap((f) => f.scopes),
      state: 'st',
      challenge: 'ch',
    }),
  );

describe('spotify connector', () => {
  it('logs in with PKCE at the Spotify endpoints on the fixed port 38417 (desktop) or the own app address in the browser', () => {
    expect(connector.authType).toBe('oauth-pkce');
    expect(connector.platforms).toEqual(['desktop', 'web']);
    expect(connector.oauth?.browserLogin).toBe(true);
    expect(connector.oauth).toMatchObject({
      authUrl: 'https://accounts.spotify.com/authorize',
      tokenUrl: 'https://accounts.spotify.com/api/token',
      preferredPort: 38417,
    });
    expect(connector.client?.secret).toBe(false);
  });

  it('"Anzeigen" asks for the two read scopes and nothing else', () => {
    const url = loginUrl(['show']);
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(url.searchParams.get('scope')).toBe(
      'user-read-currently-playing user-read-playback-state',
    );
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:38417/callback');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('"Steuern" adds only the modify scope, both together ask for all three', () => {
    expect(loginUrl(['control']).searchParams.get('scope')).toBe('user-modify-playback-state');
    expect(loginUrl(['show', 'control']).searchParams.get('scope')).toBe(
      'user-read-currently-playing user-read-playback-state user-modify-playback-state',
    );
  });

  it('"Playlists" is an opt-in feature with only the read scope for private playlists', () => {
    const f = connector.features.find((x) => x.id === 'playlists')!;
    expect(f.defaultOn).toBe(false);
    expect(loginUrl(['playlists']).searchParams.get('scope')).toBe(
      'playlist-read-private playlist-read-collaborative',
    );
    expect(loginUrl(['show', 'control']).searchParams.get('scope')).not.toContain('playlist');
  });

  it('offers the now-playing capability and no calendar or mail', () => {
    expect(connector.nowPlaying).toBeDefined();
    expect(connector.calendar).toBeUndefined();
    expect(connector.mail).toBeUndefined();
  });
});
