// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { markSeen, saveHint } from './seen';
import { newToken, selectChangelog } from './select';
import type { ChangelogData } from './types';
import { useNewChangelog } from './useNewChangelog';

const entry = {
  type: 'added' as const,
  area: 'app',
  breaking: false,
  highlight: false,
  de: 'd',
  en: 'e',
};
const data: ChangelogData = {
  areas: {},
  versions: [{ version: '2.0.0', date: '2026-11-10', entries: [entry] }],
};
vi.mock('./load', () => ({ loadChangelog: async () => data }));
vi.mock('@/core/platform', () => ({
  getPlatform: () => ({ app: { version: async () => '2.0.0' } }),
}));

describe('useNewChangelog', () => {
  it('is true for an unopened version, false once seen, and false when the mark is switched off', async () => {
    const { result } = renderHook(() => useNewChangelog());
    await waitFor(() => expect(result.current).toBe(true));
    await act(async () => markSeen(newToken(selectChangelog(data, '2.0.0'))!));
    await waitFor(() => expect(result.current).toBe(false));
    await act(async () => saveHint(false));
    expect(result.current).toBe(false);
  });
});
