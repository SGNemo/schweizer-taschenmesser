// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModuleManifest } from '@/core/modules/types';
import { useModuleHeadline } from './useModuleHeadline';

afterEach(() => vi.restoreAllMocks());

const manifest = (headline: () => Promise<unknown>) =>
  ({ id: 'finance', contributions: { headline } }) as unknown as ModuleManifest;

describe('useModuleHeadline', () => {
  it('gives the figure of the module', async () => {
    const m = manifest(async () => ({ default: async () => ({ label: 'Saldo', value: '12 €' }) }));
    const { result } = renderHook(() => useModuleHeadline(m));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.figure).toMatchObject({ label: 'Saldo' });
  });

  it('leaves the figure out when its code does not load, instead of throwing into the app', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const m = manifest(() =>
      Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
    );
    const { result } = renderHook(() => useModuleHeadline(m));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.figure).toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});
