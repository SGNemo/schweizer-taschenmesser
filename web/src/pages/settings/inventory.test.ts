import { describe, expect, it } from 'vitest';
import { allManifests } from '@/core/modules/registry';

/**
 * Pins every persisted setting key and default as of the settings overhaul. Restructuring the settings page is
 * presentation only: a key that disappears, moves to another scope or changes its default fails here.
 * A deliberate change needs a migration and a regenerated `settings-inventory.json` (`npx vitest run -u <this file>`).
 */

/** Settings that are not declared in a module manifest: scope/store, key, default. */
const CORE_KEYS = {
  'localStorage (device-local, stores/ui.ts)': {
    'tm-theme': 'system',
    'tm-accent': 'orange',
    'tm-text-size': 'normal',
    'tm-density': 'normal',
    'tm-sidebar': 'wide',
    'tm-nav-closed': '[]',
    'tm-quick-capture': 'hotkey, vaultHotkey, closeToTray, autostart, clipboard',
  },
  '_settings scope core': { displayName: '', weekStart: 'mon' },
  '_settings scope nav': { favourites: ['calendar', 'todos', 'finance'] },
  '_settings scope tools': { enabled: 'per tool', order: 'per tool' },
  '_settings scope quickCapture': { defaultType: 'todo' },
  _meta: {
    'update.prefs': { channel: 'stable', auto: true },
    'update.lastCheckAt': 'timestamp',
    'update.dismissedVersion': 'version',
    'setup.state': 'checklistHidden false, status, steps',
    'backup.auto.config': { enabled: false, interval: 'daily', keep: 7 },
    'backup.auto.last': 'timestamp',
    'localApi.config': { enabled: false, port: 47631, tokens: [] },
    'sync.lastSyncAt': 'timestamp',
    'seed.sync': false,
    'connector.<id>': 'status',
  },
  '_secrets / platform secrets': {
    syncConfig: 'server, token, deviceName, encryption',
    aiConfig: { v: 2, providers: [] },
    'ai-key:<providerId>': 'api key',
    pushConfig: 'push subscription',
    'backup.autoPassphrase': 'password',
    'oauth:<id>:client-id|client-secret|refresh': 'oauth',
    'connector:<id>:<name>': 'connector secret',
  },
} as const;

function moduleSettings() {
  const out: Record<string, { scope: string; fields: Record<string, unknown> }> = {};
  for (const m of [...allManifests].sort((a, b) => a.id.localeCompare(b.id))) {
    const { fields, defaults } = m.settings;
    if (fields.length === 0) continue;
    out[m.id] = {
      scope: `module.${m.id}`,
      fields: Object.fromEntries(
        fields.map((f) => [f.key, { type: f.type, label: f.label, default: defaults[f.key] }]),
      ),
    };
  }
  return out;
}

describe('settings inventory', () => {
  it('keeps every module setting key, scope and default', async () => {
    await expect(JSON.stringify(moduleSettings(), null, 2) + '\n').toMatchFileSnapshot(
      './inventory.modules.json',
    );
  });

  it('keeps the core setting keys and defaults', async () => {
    await expect(JSON.stringify(CORE_KEYS, null, 2) + '\n').toMatchFileSnapshot(
      './inventory.core.json',
    );
  });
});
