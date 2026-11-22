import { describe, expect, it } from 'vitest';
import { nativeInit } from './redirect';

describe('nativeInit', () => {
  it('turns `redirect: manual` into the plugin’s "follow nothing"', () => {
    expect(nativeInit({ redirect: 'manual', credentials: 'omit' })).toMatchObject({
      redirect: 'manual',
      credentials: 'omit',
      maxRedirections: 0,
    });
  });
  it('leaves every other request as it is', () => {
    const init = { headers: { accept: 'text/calendar' } };
    expect(nativeInit(init)).toBe(init);
    expect(nativeInit(undefined)).toBeUndefined();
    expect(nativeInit({ redirect: 'follow' })).not.toHaveProperty('maxRedirections');
  });
});
