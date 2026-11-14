// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { DEFAULTS_ERA_KEY } from '@/core/focus/defaults';
import { DEFAULTS_VERSION_KEY } from '@/core/modules/defaults';
import { setSettings } from '@/core/settings/settings';
import type * as Detect from '@/core/setup/detect';
import { ensureSetupState } from '@/core/setup/detect';
import { SETUP_STATE_KEY } from '@/core/setup/state';
import { useUiStore } from '@/stores/ui';
import { initCore } from './startup';

// The background services are not what this file checks: they stay off.
vi.mock('@/core/settings/history', () => ({ startHistory: () => () => {} }));
vi.mock('@/core/settings/profiles', () => ({ startProfileScheduler: () => () => {} }));
vi.mock('@/core/automation/start', () => ({ startAutomation: () => () => {} }));
vi.mock('@/core/setup/detect', async (importOriginal) => {
  const actual = await importOriginal<typeof Detect>();
  return { ...actual, ensureSetupState: vi.fn(actual.ensureSetupState) };
});

const meta = () => db.table<{ key: string; value: unknown }, string>('_meta');

beforeEach(async () => {
  for (const name of ['_meta', '_settings', '_modules']) await db.table(name).clear();
  localStorage.clear();
  useUiStore.setState({ homeView: 'calm' });
});
afterEach(() => {
  Reflect.deleteProperty(navigator, 'storage');
});

describe('first start: a fresh app keeps the calm overview (initCore)', () => {
  it('decides "fresh" before the page can write while the browser answers the storage request', async () => {
    // The page renders alongside the start-up; here it writes its first setting while `persist()` is pending.
    const persist = vi.fn(async () => {
      await setSettings('ui.example', { on: true });
      return true;
    });
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
    await initCore();
    expect(persist).toHaveBeenCalled();
    expect(useUiStore.getState().homeView).toBe('calm');
    expect(localStorage.getItem('tm-home-view')).toBeNull();
  });

  it('stores the defaults era before the setup state, so a start left in between is not read as an old app', async () => {
    let eraAtSetup: unknown = 'not reached';
    const actual = (await vi.importActual<typeof Detect>('@/core/setup/detect')).ensureSetupState;
    vi.mocked(ensureSetupState).mockImplementationOnce(async (...args) => {
      eraAtSetup = (await meta().get(DEFAULTS_ERA_KEY))?.value;
      return actual(...args);
    });
    await initCore();
    expect(eraAtSetup).toBe(1);
    expect((await meta().get(SETUP_STATE_KEY))?.value).toMatchObject({ status: 'notStarted' });
  });

  it('a second start after a first one left before the setup state stays calm, even with an entry made meanwhile', async () => {
    await meta().put({ key: DEFAULTS_ERA_KEY, value: 1 });
    await setSettings('ui.example', { on: true });
    await initCore();
    expect(useUiStore.getState().homeView).toBe('calm');
    // The entry made meanwhile counts as data: the assistant does not appear by itself.
    expect((await meta().get(SETUP_STATE_KEY))?.value).toMatchObject({ status: 'dismissed' });
  });

  it('notes the default set of modules before the setup state', async () => {
    let defaultsAtSetup: unknown = 'not reached';
    const actual = (await vi.importActual<typeof Detect>('@/core/setup/detect')).ensureSetupState;
    vi.mocked(ensureSetupState).mockImplementationOnce(async (...args) => {
      defaultsAtSetup = (await meta().get(DEFAULTS_VERSION_KEY))?.value;
      return actual(...args);
    });
    await initCore();
    expect(typeof defaultsAtSetup).toBe('number');
  });

  it('an app with data and no era marker is an existing installation: the detailed view, as before', async () => {
    await setSettings('ui.example', { on: true });
    await initCore();
    expect(useUiStore.getState().homeView).toBe('all');
    expect((await meta().get(SETUP_STATE_KEY))?.value).toMatchObject({ status: 'dismissed' });
  });
});
