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
    'tm-toast-stay': 'off (toasts stay until closed; focus aid, setup step core.focus)',
    'tm-read-share': '40',
    'tm-read-style': 'soft',
    'tm-read-cover': '25',
    'tm-read-hint': 'unset',
    'tm-color': 'full',
    'tm-home-view': 'all',
    'tm-show-preview': 'off',
    'tm-sidebar': 'wide',
    'tm-clock': 'unset = on in the desktop app, off on Android/PWA (core/settings/clock.ts)',
    'tm-nav-closed': '[]',
    'tm-nav-open': '[] (F06: areas opened by hand; default = only the area of the current page)',
    'tm-quick-capture': 'hotkey, vaultHotkey, closeToTray, autostart, clipboard, trayToday',
    'tm-voice': 'enabled false, key F4, globalHotkey off, noticeSeen false',
    'tm-profile-schedules':
      '[] (profile schedules: profileId, days, time; core/settings/profiles.ts)',
    'tm-profile-last': 'unset (key of the schedule that ran last, so it runs once per day)',
    'tm-profile-applied': 'unset (id of the profile switched on last on this device)',
    'tm-settings-history':
      '[] (last 30 changes with what takes them back; never vault/supporter/AI switch; core/settings/history.ts)',
    'tm-settings-history-on': 'on (switch "Änderungen merken"; stored only when off)',
    'tm-settings-adv':
      '{} (open state of the "Erweitert" fold per settings category; core/settings/foldState.ts)',
    'tm-shortcuts': 'keys {} (overrides of the F-key defaults; core/keyboard/map.ts)',
    'tm-spotify-now':
      'last now-playing reading, only while connected (core/connectors/nowPlaying.ts)',
    'tm-spotify-no-premium': 'time of a PREMIUM_REQUIRED answer; controls hidden for a day',
    'tm-spotify-focus':
      'focus-round music: mode off, playlistId unset, pauseAtEnd true (core/focus/music.ts)',
    'tm-spotify-hidden':
      'songs hidden per playlist in the Spotify player, ids only (core/connectors/hiddenTracks.ts)',
  },
  '_settings scope core': { displayName: '', weekStart: 'mon' },
  '_settings scope supporter': {
    code: '',
    addedAt: '',
    showSidebarBadge: false,
    hideSetupHint: false,
  },
  '_settings scope nav': { favourites: ['calendar', 'todos', 'finance'] },
  '_settings scope profiles': { items: [] },
  '_settings scope tools': { enabled: 'per tool', order: 'per tool' },
  '_settings scope quickCapture': { defaultType: 'todo' },
  '_settings scope automation': { enabled: false, dryRun: false, globalPerHour: 10, rules: {} },
  '_settings scope focus': {
    notifyChannels: {},
    nextOne: true,
    dayPlan: true,
    planLimit: 3,
    calmAttention: true,
    moduleNow: true,
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
    weekCheck: false,
    eveningWrapUp: true,
  },
  '_settings scope weather': { enabled: true, place: '', lat: 0, lon: 0 },
  '_settings scope reminders': { snoozed: [], 'ack:<notification key>': 'time of the answer' },
  _meta: {
    'automation.guard': 'rule run times of the last hour, occurrence keys (device-local)',
    'automation.notices': 'reminders, hints and suggestions rules left (device-local)',
    'automation.cursor': 'timestamp of the last rule tick',
    'automation.detected': 'timestamp of the last module check',
    'update.prefs': { channel: 'stable', auto: true },
    'update.lastCheckAt': 'timestamp',
    'update.dismissedVersion': 'version',
    'legal.notices': 'ids of acknowledged one-time notices (device-local)',
    'setup.state': 'checklistHidden false, status, steps',
    'migrate.state':
      'setup: chosen origin ids with time, ticked point ids (device-local, no contents)',
    'focus.state': 'running focus session (task, end time), skipped suggestions of the day',
    'reminders.acked': 'older answers (Erledigt); now synced in the settings scope reminders',
    'focus.context': 'last visited route and title for the resume card (device-local)',
    'backup.auto.config': { enabled: false, interval: 'daily', keep: 7 },
    'backup.auto.last': 'timestamp',
    'localApi.config': { enabled: false, port: 47631, tokens: [] },
    'sync.lastSyncAt': 'timestamp',
    'seed.sync': false,
    'connector.<id>': 'status',
    'finance.bankMappings': 'column assignment per header of an unknown bank CSV (device-local)',
    'finance.rules': 'import rules: payee pattern → category / subscription (device-local)',
    'subscriptions.priceHints': 'day a price rise was first noticed, per rise (device-local)',
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
