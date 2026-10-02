import { describe, expect, it } from 'vitest';
import { allManifests, visibleManifests } from './registry';

/**
 * `devOnly` modules (the generator's `example`) stay in `allManifests` (their tables are part of the
 * schema in every build) but are hidden from the library unless the build asks for them
 * (`npm run dev` or `VITE_INCLUDE_EXAMPLE=true`, i.e. `.env.e2e`).
 */
describe('dev-only modules', () => {
  it('are hidden in builds that do not include them, and only then', () => {
    const include = import.meta.env.DEV || import.meta.env.VITE_INCLUDE_EXAMPLE === 'true';
    const devOnly = allManifests.filter((m) => m.devOnly);
    expect(devOnly.map((m) => m.id)).toContain('example');
    for (const m of devOnly) expect(visibleManifests.includes(m), m.id).toBe(include);
  });
});
