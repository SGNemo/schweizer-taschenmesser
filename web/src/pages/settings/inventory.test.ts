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
    'tm-palette': 'none (supporter colour theme; core/supporter/palette.ts)',
    'tm-logo': 'default (themed = fish in the accent colour, supporter)',
    'tm-text-size': 'normal',
    'tm-density': 'normal',
    'tm-leading': 'normal',
    'tm-motion': 'system',
    'tm-read-aid': 'off',
    'tm-read-share': '40',
    'tm-read-style': 'soft',
    'tm-read-scope': 'text',
    'tm-read-hint': 'unset',
    'tm-color': 'full',
    'tm-home-view': 'all',
    'tm-sidebar': 'wide',
    'tm-nav-closed': '[]',
    'tm-quick-capture': 'hotkey, vaultHotkey, closeToTray, autostart, clipboard',
  },
  '_settings scope core': { displayName: '', weekStart: 'mon' },
  '_settings scope supporter': {
    code: '',
    addedAt: '',
    showSidebarBadge: false,
    hideSetupHint: false,
  },
  '_settings scope nav': { favourites: ['calendar', 'todos', 'finance'] },
  '_settings scope tools': { enabled: 'per tool', order: 'per tool' },
  '_settings scope quickCapture': { defaultType: 'todo' },
  '_settings scope focus': {
    nextOne: true,
    dayPlan: true,
    planLimit: 3,
    calmAttention: true,
    timeToNext: true,
    focusMinutes: 25,
    focusSound: false,
    focusIndicator: true,
    quietHours: true,
    quietFrom: '22:00',
    quietTo: '07:00',
    maxPerHour: 3,
    staggered: false,
    stages: [60, 10],
    followUp: false,
    todoDigest: true,
    todoDigestTime: '09:00',
    inAppPrompt: false,
    inAppPosition: 'top',
    inAppSeconds: 0,
    resumeCard: true,
    captureNoQuestion: true,
    searchHistory: true,
    streaks: true,
    weekReview: true,
    eveningWrapUp: true,
  },
  '_settings scope reminders': { snoozed: [] },
  _meta: {
    'update.prefs': { channel: 'stable', auto: true },
    'update.lastCheckAt': 'timestamp',
    'update.dismissedVersion': 'version',
    'setup.state': 'checklistHidden false, status, steps',
    'focus.state': 'running focus session (task, end time), skipped suggestions of the day',
    'reminders.acked': 'notification keys answered with Erledigt (device-local)',
    'focus.context': 'last visited route and title for the resume card (device-local)',
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
