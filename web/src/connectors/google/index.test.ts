import { describe, expect, it } from 'vitest';
import { buildAuthUrl } from '@/core/connectors/oauth';
import connector from './index';

describe('google connector: login URL', () => {
  it('asks for exactly the scopes of the chosen features, never for previously granted ones', () => {
    const url = new URL(
      buildAuthUrl({
        endpoints: connector.oauth!,
        clientId: 'client-abc',
        redirectUri: 'http://127.0.0.1:5555/callback',
        scopes: connector.features[0]!.scopes,
        state: 'st',
        challenge: 'ch',
      }),
    );
    expect(url.searchParams.get('include_granted_scopes')).toBeNull();
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.readonly');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });
});
