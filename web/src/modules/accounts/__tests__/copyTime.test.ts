// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { setSettings } from '@/core/settings/settings';
import { useUiStore } from '@/stores/ui';
import { CLIPBOARD_CLEAR_MS, copySecret, primeClipboardTime } from '../copy';

const writeSensitive = vi.fn<(text: string, ms: number) => Promise<void>>(async () => {});

beforeEach(() => {
  writeSensitive.mockClear();
  const base = createWebPlatform();
  setPlatform({ ...base, clipboard: { ...base.clipboard, writeSensitive } });
});
afterEach(() => setPlatform(undefined));

describe('clipboard time of copied secrets', () => {
  it('clears after 30 s by default', async () => {
    expect(await primeClipboardTime()).toBe(CLIPBOARD_CLEAR_MS);
    await copySecret('Passwort', 'geheim');
    expect(writeSensitive).toHaveBeenCalledWith('geheim', 30_000);
  });

  it('follows the setting and says the same time in the toast', async () => {
    const toast = vi.spyOn(useUiStore.getState(), 'toast');
    await setSettings('module.accounts', { clipboardSeconds: '10' });
    await primeClipboardTime();
    await copySecret('Passwort', 'geheim');
    expect(writeSensitive).toHaveBeenCalledWith('geheim', 10_000);
    expect(String(toast.mock.calls.at(-1)?.[0])).toContain('10 s');
    await setSettings('module.accounts', { clipboardSeconds: '120' });
    await primeClipboardTime();
    await copySecret('Code', '123456');
    expect(writeSensitive).toHaveBeenLastCalledWith('123456', 120_000);
  });
});
