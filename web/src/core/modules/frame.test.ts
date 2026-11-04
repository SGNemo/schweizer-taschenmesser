import { describe, expect, it } from 'vitest';
import { frameVariant } from './frame';
import { allManifests } from './registry';

describe('frameVariant', () => {
  it('lifts content (the old default) to the area width; narrow, wide and full stay', () => {
    expect(frameVariant(undefined)).toBe('wide');
    expect(frameVariant('content')).toBe('wide');
    expect(frameVariant('wide')).toBe('wide');
    expect(frameVariant('full')).toBe('full');
    expect(frameVariant('narrow')).toBe('narrow');
  });

  it('no module of one area ends up as a narrow island between wide pages', () => {
    for (const area of new Set(allManifests.map((m) => m.area).filter(Boolean))) {
      const widths = allManifests
        .filter((m) => m.area === area && !m.retired)
        .map((m) => frameVariant(m.layout));
      expect(widths, area).not.toContain('content');
    }
  });
});
