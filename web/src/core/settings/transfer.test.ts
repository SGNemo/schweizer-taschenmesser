// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/stores/ui';
import { DEFAULT_FOCUS, getFocusSettings, patchFocusSettings } from './focus';
import { readHistory, clearHistory } from './history';
import { loadCustomProfiles, saveCurrentAsProfile } from './profiles';
import { setSettings } from './settings';
import {
  applyImport,
  buildExport,
  dropUrls,
  parseTransfer,
  planImport,
  TRANSFER_FORMAT,
} from './transfer';

beforeEach(async () => {
  localStorage.clear();
  useUiStore.setState({ toasts: [] });
  useUiStore.getState().setTheme('system');
  useUiStore.getState().setDensity('normal');
  await patchFocusSettings({ ...DEFAULT_FOCUS });
  clearHistory();
});

describe('export', () => {
  it('carries look, reminders and module settings in a versioned file', async () => {
    useUiStore.getState().setTheme('dark');
    await patchFocusSettings({ maxPerHour: 5 });
    const file = await buildExport();
    expect(file.format).toBe(TRANSFER_FORMAT);
    expect(file.version).toBe(1);
    expect(file.values.theme).toBe('dark');
    expect((file.scopes.focus as { maxPerHour: number }).maxPerHour).toBe(5);
    expect(file.scopes.core).toBeDefined();
    expect(Object.keys(file.scopes).some((s) => s.startsWith('module.'))).toBe(true);
  });

  it('never carries the vault, the supporter code, the AI switch, secrets or an address', async () => {
    await setSettings('supporter', { code: 'SECRET-CODE-123' });
    await setSettings('module.accounts', { autoLockMinutes: '30' });
    await setSettings('ai.switch', { off: true });
    const text = JSON.stringify(await buildExport());
    expect(text).not.toMatch(/SECRET-CODE-123/);
    expect(text).not.toMatch(/autoLock|backgroundLock|originMatch/);
    expect(text).not.toMatch(/"module\.accounts"|"supporter"|"ai\.switch"/);
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/token|secret|password/i);
  });

  it('drops web addresses everywhere inside a value', () => {
    expect(dropUrls('https://x.example/a')).toBeUndefined();
    expect(dropUrls({ a: 'ok', b: 'http://h', c: ['https://h', 'fine'] })).toEqual({
      a: 'ok',
      c: ['fine'],
    });
    expect(dropUrls(5)).toBe(5);
  });
});

describe('import', () => {
  it('refuses what is not a settings file, and a file from a newer version', () => {
    expect(parseTransfer('not json')).toEqual({ ok: false, error: 'format' });
    expect(parseTransfer(JSON.stringify({ hello: 1 }))).toEqual({ ok: false, error: 'format' });
    expect(parseTransfer(JSON.stringify({ format: TRANSFER_FORMAT, version: 2 }))).toEqual({
      ok: false,
      error: 'version',
    });
    expect(parseTransfer(JSON.stringify({ format: TRANSFER_FORMAT, version: 1 })).ok).toBe(true);
  });

  it('round-trips: shows what would change, applies it, and the toast action takes it back', async () => {
    useUiStore.getState().setTheme('dark');
    useUiStore.getState().setDensity('compact');
    await patchFocusSettings({ maxPerHour: 5 });
    const saved = await saveCurrentAsProfile('Zuhause');
    const text = JSON.stringify(await buildExport());
    useUiStore.getState().setTheme('system');
    useUiStore.getState().setDensity('normal');
    await patchFocusSettings({ maxPerHour: 2 });
    await setSettings('profiles', { items: [] });
    const parsed = parseTransfer(text);
    if (!parsed.ok) throw new Error('parse');
    const lines = await planImport(parsed.file);
    expect(lines.map((l) => `${l.scope}.${l.key}`)).toEqual(
      expect.arrayContaining(['ui.theme', 'ui.density', 'focus.maxPerHour', 'profiles.items']),
    );
    clearHistory();
    expect(await applyImport(lines)).toBe(lines.length);
    expect(useUiStore.getState().theme).toBe('dark');
    expect((await getFocusSettings()).maxPerHour).toBe(5);
    expect((await loadCustomProfiles()).map((p) => p.id)).toEqual([saved!.id]);
    expect(readHistory()).toHaveLength(1); // one entry for the whole file
    useUiStore.getState().toasts.at(-1)!.action!.run();
    await new Promise((r) => setTimeout(r, 20));
    expect(useUiStore.getState().theme).toBe('system');
    expect((await getFocusSettings()).maxPerHour).toBe(2);
    expect(await loadCustomProfiles()).toEqual([]);
  });

  it('ignores unknown keys and scopes, invalid values and addresses; a file equal to now changes nothing', async () => {
    const same = await buildExport();
    expect(await planImport(same)).toEqual([]);
    const hostile = parseTransfer(
      JSON.stringify({
        format: TRANSFER_FORMAT,
        version: 1,
        values: { theme: 'purple', autoLockMinutes: '30', density: 'compact' },
        scopes: {
          'module.accounts': { autoLockMinutes: '30' },
          supporter: { code: 'X' },
          focus: { maxPerHour: 'many', nonsense: 1, quietFrom: '21:30' },
          core: { displayName: 'https://evil.example' },
        },
      }),
    );
    if (!hostile.ok) throw new Error('parse');
    const lines = await planImport(hostile.file);
    expect(lines.map((l) => `${l.scope}.${l.key}`).sort()).toEqual([
      'focus.quietFrom',
      'ui.density',
    ]);
    await applyImport(lines);
    expect(useUiStore.getState().density).toBe('compact');
    expect((await getFocusSettings()).quietFrom).toBe('21:30');
  });
});
