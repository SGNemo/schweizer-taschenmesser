// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCardActionVariant } from './cardAction';

function mockPhone(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matches && query === '(max-width: 899px)',
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('useCardActionVariant', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is filled on the desktop', () => {
    mockPhone(false);
    expect(renderHook(() => useCardActionVariant()).result.current).toBe('primary');
  });

  it('is secondary on the phone, where the plus owns the one fill', () => {
    mockPhone(true);
    expect(renderHook(() => useCardActionVariant()).result.current).toBe('secondary');
  });
});
