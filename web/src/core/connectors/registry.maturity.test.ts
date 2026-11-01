import { describe, expect, it } from 'vitest';
import { connectors, isVisible } from './registry';
import type { ConnectorDef } from './types';

describe('connector maturity', () => {
  const spotify = connectors.find((c) => c.id === 'spotify')!;
  const google = connectors.find((c) => c.id === 'google')!;

  it('Spotify is preview, the others stable (no field = stable)', () => {
    expect(spotify.maturity).toBe('preview');
    expect(google.maturity).toBeUndefined();
    for (const c of connectors)
      expect([undefined, 'stable', 'preview'], c.id).toContain(c.maturity);
  });

  it('a preview connector is listed with the switch or while connected, a stable one always', () => {
    for (const showPreview of [false, true])
      for (const connected of [false, true]) {
        expect(isVisible(google, { showPreview, connected })).toBe(true);
        expect(isVisible(spotify, { showPreview, connected })).toBe(showPreview || connected);
      }
    const explicit = { ...google, maturity: 'stable' } as ConnectorDef;
    expect(isVisible(explicit, { showPreview: false, connected: false })).toBe(true);
  });
});
