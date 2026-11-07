import { describe, expect, it } from 'vitest';
import { localModelGap, localModelOffered } from './availability';

describe('localModelGap', () => {
  it('names the case the user is in', () => {
    expect(localModelGap({ unavailable: 'platform' }, 'web', 'stable')).toBe('browser');
    expect(localModelGap({ unavailable: 'platform' }, 'android', 'dev')).toBe('android');
    expect(localModelGap({ unavailable: 'build' }, 'desktop', 'dev')).toBe('testBuild');
    expect(localModelGap({ unavailable: 'build' }, 'desktop', 'stable')).toBe('build');
    expect(localModelGap({ unavailable: 'cpu' }, 'desktop', 'dev')).toBe('cpu');
    expect(localModelGap({}, 'desktop', 'dev')).toBeUndefined();
  });

  it('offers the model only when the build has it', () => {
    expect(localModelOffered(undefined)).toBe(false);
    expect(localModelOffered({ unavailable: 'build' })).toBe(false);
    expect(localModelOffered({})).toBe(true);
  });
});
