// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { useTools } from '@/core/tools/state';
import { useUiStore } from '@/stores/ui';
import { useModuleStates } from './activation';
import { useCatalogManifests } from './available';

/**
 * "In Arbeit anzeigen" is presentation only: flipping it changes which manifests the catalogues
 * list, but writes nothing to the module states, the tool settings or any other stored value.
 */
describe('maturity switch', () => {
  afterEach(() => useUiStore.getState().setShowPreview(false));

  it('changes no stored value when toggled', async () => {
    const storedKeys = () => Object.keys(localStorage).sort();
    const rows = async () => ({
      modules: await db.table('_modules').count(),
      settings: await db.table('_settings').count(),
    });
    const before = { keys: storedKeys(), rows: await rows() };

    const tools = renderHook(() => useTools());
    const catalog = renderHook(() => useCatalogManifests(useModuleStates()));
    await waitFor(() => expect(tools.result.current).toBeDefined());
    const savedBefore = tools.result.current!.saved;
    const listedBefore = catalog.result.current.map((m) => m.id);

    act(() => useUiStore.getState().setShowPreview(true));
    await waitFor(() => expect(tools.result.current).toBeDefined());
    // Same saved choices (same object: nothing was patched), stable entries unchanged.
    expect(tools.result.current!.saved).toEqual(savedBefore);
    expect(catalog.result.current.map((m) => m.id)).toEqual(expect.arrayContaining(listedBefore));

    act(() => useUiStore.getState().setShowPreview(false));
    expect(catalog.result.current.map((m) => m.id)).toEqual(listedBefore);
    expect(await rows()).toEqual(before.rows);
    expect(storedKeys()).toEqual(before.keys);
  });
});
