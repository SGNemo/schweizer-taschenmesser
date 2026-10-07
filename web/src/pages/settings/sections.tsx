/**
 * The core part of the settings registry: every section the app itself provides, each in exactly one
 * category. Modules contribute theirs through `manifest.settings` (see `useSections.ts`).
 */
import { Link } from 'react-router';
import type { SettingsSectionDef } from '@/core/settings/registry/types';
import { t } from '@/strings';
import { SettingRow, SettingsGroup } from '@/ui';
import { DeveloperSection } from '@/layout/devTools';
import { Suspense } from 'react';
import {
  AboutSection,
  AboutUpdatesSection,
  DeviceResetSection,
  DiagnosticsSection,
  LicensesSection,
  LinksSection,
} from './AboutSections';
import { AiSection } from './AiSection';
import { AiSwitchSection } from './AiSwitchSection';
import { AppearanceSection } from './AppearanceSection';
import { SupporterSection } from './SupporterSection';
import { BackupSection } from './BackupSection';
import { AiStatsSection } from './AiStatsSection';
import { AiWriteSection } from './AiWriteSection';
import { CalmRemindersSection } from './CalmRemindersSection';
import { ConnectorsSection } from './ConnectorsSection';
import { FavouritesSection } from './FavouritesSection';
import { FocusSection } from './FocusSection';
import { GeneralSection } from './GeneralSection';
import { LocalApiSection } from './LocalApiSection';
import { LocalModelSection } from './LocalModelSection';
import { ModelLicensesSection } from './ModelLicensesSection';
import { NotificationsSection } from './NotificationsSection';
import { ReadingSection } from './ReadingSection';
import { QuickCaptureSection } from './QuickCaptureSection';
import { SetupSection } from './SetupSection';
import { SyncSection } from './SyncSection';
import { ToolsSection } from './ToolsSection';
import { UpdateSection } from './UpdateSection';

const s = t.settings;

export const CORE_SECTIONS: readonly SettingsSectionDef[] = [
  {
    id: 'general',
    category: 'allgemein',
    order: 10,
    get title() {
      return s.general.title;
    },
    keywords: [
      'Name',
      'Wochenstart',
      'Sprache',
      'Language',
      'Währung',
      'Zeitzone',
      'Format',
      'Datum',
    ],
    fields: [
      {
        key: 'displayName',
        get label() {
          return s.general.name;
        },
        get description() {
          return s.general.nameHint;
        },
      },
      {
        key: 'weekStart',
        get label() {
          return s.general.weekStart;
        },
        get description() {
          return s.general.weekStartHint;
        },
      },
      {
        key: 'language',
        get label() {
          return s.general.language;
        },
        get description() {
          return s.general.languageHint;
        },
      },
      {
        key: 'currency',
        get label() {
          return s.general.currency;
        },
      },
      {
        key: 'timeZone',
        get label() {
          return s.general.timeZone;
        },
      },
      {
        key: 'formats',
        get label() {
          return s.general.formats;
        },
      },
    ],
    render: () => <GeneralSection />,
  },
  {
    id: 'appearance',
    category: 'darstellung',
    order: 10,
    get title() {
      return s.appearance;
    },
    keywords: ['Theme', 'Dunkelmodus', 'Schrift', 'Animation'],
    fields: [
      {
        key: 'theme',
        get label() {
          return s.theme;
        },
        get description() {
          return s.rows.themeHint;
        },
      },
      {
        key: 'accent',
        get label() {
          return s.accent;
        },
        get description() {
          return s.rows.accentHint;
        },
      },
      {
        key: 'palette',
        get label() {
          return t.supporter.palette.label;
        },
        get description() {
          return t.supporter.palette.hintLocked;
        },
      },
      {
        key: 'logo',
        get label() {
          return t.supporter.logo.label;
        },
        get description() {
          return t.supporter.logo.hint;
        },
      },
      {
        key: 'textSize',
        get label() {
          return s.textSize;
        },
        get description() {
          return s.rows.textSizeHint;
        },
      },
      {
        key: 'density',
        get label() {
          return s.density;
        },
        get description() {
          return s.rows.densityHint;
        },
      },
      {
        key: 'sidebar',
        get label() {
          return s.sidebar;
        },
        get description() {
          return s.rows.sidebarHint;
        },
      },
      {
        key: 'motion',
        get label() {
          return s.rows.motion;
        },
        get description() {
          return s.rows.motionHint;
        },
      },
      {
        key: 'leading',
        get label() {
          return s.leading;
        },
        get description() {
          return s.rows.leadingHint;
        },
      },
      {
        key: 'color',
        get label() {
          return s.color;
        },
        get description() {
          return s.colorHint;
        },
      },
      {
        key: 'homeView',
        get label() {
          return s.homeView;
        },
        get description() {
          return s.rows.homeViewHint;
        },
      },
    ],
    render: () => <AppearanceSection />,
  },
  {
    id: 'reading',
    category: 'darstellung',
    order: 12,
    get title() {
      return s.reading.title;
    },
    get description() {
      return s.reading.description;
    },
    get keywords() {
      return s.reading.keywords;
    },
    fields: [
      {
        key: 'aid',
        get label() {
          return s.reading.aid;
        },
        get description() {
          return s.reading.aidHint;
        },
      },
      {
        key: 'share',
        get label() {
          return s.reading.share;
        },
      },
      {
        key: 'style',
        get label() {
          return s.reading.style;
        },
        get description() {
          return s.reading.styleHint;
        },
      },
      {
        key: 'cover',
        get label() {
          return s.reading.cover;
        },
        get description() {
          return s.reading.coverHint;
        },
      },
    ],
    render: () => <ReadingSection />,
  },
  {
    id: 'focus',
    category: 'darstellung',
    order: 15,
    get title() {
      return t.focus.settings.title;
    },
    get description() {
      return t.focus.settings.description;
    },
    get keywords() {
      return t.focus.settings.keywords;
    },
    fields: [
      {
        key: 'nextOne',
        get label() {
          return t.focus.settings.nextOne;
        },
        get description() {
          return t.focus.settings.nextOneHint;
        },
      },
      {
        key: 'dayPlan',
        get label() {
          return t.focus.settings.dayPlan;
        },
        get description() {
          return t.focus.settings.dayPlanHint;
        },
      },
      {
        key: 'planLimit',
        get label() {
          return t.focus.settings.planLimit;
        },
      },
      {
        key: 'calmAttention',
        get label() {
          return t.focus.settings.calmAttention;
        },
      },
      {
        key: 'timeToNext',
        get label() {
          return t.focus.settings.timeToNext;
        },
      },
      {
        key: 'focusMinutes',
        get label() {
          return t.focus.settings.focusMinutes;
        },
      },
      {
        key: 'focusSound',
        get label() {
          return t.focus.settings.focusSound;
        },
      },
      {
        key: 'focusIndicator',
        get label() {
          return t.focus.settings.focusIndicator;
        },
      },
      {
        key: 'resumeCard',
        get label() {
          return t.focus.settings.resumeCard;
        },
      },
      {
        key: 'streaks',
        get label() {
          return t.focus.settings.streaks;
        },
      },
      {
        key: 'weekReview',
        get label() {
          return t.focus.settings.weekReview;
        },
      },
      {
        key: 'eveningWrapUp',
        get label() {
          return t.focus.settings.eveningWrapUp;
        },
      },
      {
        key: 'searchHistory',
        get label() {
          return t.focus.settings.searchHistory;
        },
      },
      {
        key: 'clearHistory',
        get label() {
          return t.focus.settings.clearHistory;
        },
      },
    ],
    render: () => <FocusSection />,
  },
  {
    id: 'favourites',
    category: 'darstellung',
    order: 20,
    get title() {
      return s.favourites;
    },
    get description() {
      return s.favouritesHint;
    },
    render: () => <FavouritesSection />,
  },
  {
    id: 'modules',
    category: 'module',
    order: 0,
    get title() {
      return s.modulesOverview.title;
    },
    get description() {
      return s.modulesOverview.description;
    },
    keywords: ['Bibliothek', 'Modul aktivieren', 'Startdaten'],
    render: () => (
      <SettingsGroup
        id="modules"
        title={s.modulesOverview.title}
        description={s.modulesOverview.description}
      >
        <SettingRow label={s.modulesOverview.library}>
          <Link to="/library">{s.modulesOverview.library}</Link>
        </SettingRow>
      </SettingsGroup>
    ),
  },
  {
    id: 'tools',
    category: 'werkzeuge',
    order: 10,
    get title() {
      return s.tools.title;
    },
    get description() {
      return s.tools.description;
    },
    keywords: ['Werkzeugleiste', 'Reihenfolge'],
    render: () => <ToolsSection />,
  },
  {
    id: 'notifications',
    category: 'benachrichtigungen',
    order: 10,
    get title() {
      return t.notifications.title;
    },
    keywords: ['Push', 'Erlaubnis', 'Erinnerung'],
    render: () => <NotificationsSection />,
  },
  {
    id: 'calm-reminders',
    category: 'benachrichtigungen',
    order: 20,
    get title() {
      return t.focus.reminders.title;
    },
    get description() {
      return t.focus.reminders.description;
    },
    get keywords() {
      return t.focus.reminders.keywords;
    },
    fields: [
      {
        key: 'inAppPrompt',
        get label() {
          return t.focus.reminders.inAppPrompt;
        },
      },
      {
        key: 'inAppPosition',
        get label() {
          return t.focus.reminders.inAppPosition;
        },
      },
      {
        key: 'inAppSeconds',
        get label() {
          return t.focus.reminders.inAppSeconds;
        },
      },
      {
        key: 'quietHours',
        get label() {
          return t.focus.reminders.quietHours;
        },
      },
      {
        key: 'maxPerHour',
        get label() {
          return t.focus.reminders.maxPerHour;
        },
      },
      {
        key: 'staggered',
        get label() {
          return t.focus.reminders.staggered;
        },
      },
      {
        key: 'followUp',
        get label() {
          return t.focus.reminders.followUp;
        },
      },
      {
        key: 'todoDigest',
        get label() {
          return t.focus.reminders.todoDigest;
        },
      },
    ],
    render: () => <CalmRemindersSection />,
  },
  {
    id: 'browser-extension',
    category: 'verbindungen',
    order: 30,
    get title() {
      return s.linkRow.browserExtension;
    },
    get description() {
      return s.linkRow.browserExtensionHint;
    },
    keywords: ['Brave', 'Chrome', 'Autofill'],
    visibleWhen: (ctx) => ctx.isModuleEnabled('accounts'),
    render: () => (
      <SettingsGroup id="browser-extension" title={s.linkRow.browserExtension}>
        <SettingRow label={s.linkRow.browserExtension} description={s.linkRow.browserExtensionHint}>
          <Link to="/settings/sicherheit#module-accounts">{s.linkRow.open}</Link>
        </SettingRow>
      </SettingsGroup>
    ),
  },
  {
    id: 'sync',
    category: 'sync',
    order: 10,
    get title() {
      return t.sync.title;
    },
    get hint() {
      return t.help.sync;
    },
    keywords: ['Server', 'Token', 'Geräte', 'Ende-zu-Ende', 'Passphrase'],
    render: () => (
      <SettingsGroup id="sync" title={t.sync.title} hint={t.help.sync} bare>
        <SyncSection />
      </SettingsGroup>
    ),
  },
  {
    id: 'backup',
    category: 'sync',
    order: 20,
    get title() {
      return t.backup.title;
    },
    keywords: ['Export', 'Import', 'Sicherung', 'Wiederherstellen', 'Automatisch'],
    render: () => (
      <SettingsGroup id="backup" title={t.backup.title} bare>
        <BackupSection />
      </SettingsGroup>
    ),
  },
  {
    id: 'ai-switch',
    category: 'ki',
    order: 5,
    get title() {
      return t.ai.off.title;
    },
    get description() {
      return t.ai.off.description;
    },
    keywords: ['KI aus', 'abschalten', 'deaktivieren', 'ohne KI', 'Nuke', 'löschen', 'Schlüssel'],
    fields: [
      {
        key: 'off',
        get label() {
          return t.ai.off.switchLabel;
        },
        get description() {
          return t.ai.off.hint;
        },
      },
    ],
    render: () => <AiSwitchSection />,
  },
  {
    id: 'ai-write',
    category: 'ki',
    order: 15,
    get title() {
      return t.ai.writeSettings.title;
    },
    get description() {
      return t.ai.writeSettings.description;
    },
    get hint() {
      return t.help.aiWrite;
    },
    keywords: ['Eintragen', 'Schreiben', 'Vorschau', 'Cloud', 'Fallback', 'Nachfragen'],
    fields: [
      {
        key: 'enabled',
        get label() {
          return t.ai.writeSettings.enabled;
        },
      },
      {
        key: 'cloud',
        get label() {
          return t.ai.writeSettings.cloud;
        },
      },
      {
        key: 'askMissing',
        get label() {
          return t.ai.writeSettings.askMissing;
        },
      },
      {
        key: 'modules',
        get label() {
          return t.ai.writeSettings.modules;
        },
      },
    ],
    visibleWhen: (ctx) => ctx.aiOn !== false,
    render: () => <AiWriteSection />,
  },
  {
    id: 'ai-local',
    category: 'ki',
    order: 16,
    get title() {
      return t.ai.local.title;
    },
    get hint() {
      return t.help.aiLocal;
    },
    keywords: ['Lokal', 'Modell', 'Offline', 'Download', 'GPU', 'Vulkan', 'Gewichte'],
    render: () => <LocalModelSection />,
  },
  {
    id: 'ai-stats',
    category: 'ki',
    order: 17,
    get title() {
      return t.ai.stats.title;
    },
    get description() {
      return t.ai.stats.description;
    },
    keywords: ['Statistik', 'Token', 'Kosten', 'Regeln', 'lokal', 'Cloud'],
    visibleWhen: (ctx) => ctx.aiOn !== false,
    render: () => <AiStatsSection />,
  },
  {
    id: 'ai',
    category: 'ki',
    order: 10,
    get title() {
      return t.ai.title;
    },
    get hint() {
      return t.help.aiRouter;
    },
    keywords: ['Anbieter', 'Schlüssel', 'Limit', 'Cache', 'Zähler'],
    visibleWhen: (ctx) => ctx.aiOn !== false,
    render: () => (
      <SettingsGroup id="ai" title={t.ai.title} hint={t.help.aiRouter} bare>
        <AiSection />
      </SettingsGroup>
    ),
  },
  {
    id: 'connectors',
    category: 'verbindungen',
    order: 10,
    get title() {
      return t.connectors.title;
    },
    get hint() {
      return t.help.connectors;
    },
    keywords: ['Google', 'Kalender', 'ICS', 'Gmail'],
    render: () => (
      <SettingsGroup id="connectors" title={t.connectors.title} hint={t.help.connectors} bare>
        <ConnectorsSection />
      </SettingsGroup>
    ),
  },
  {
    id: 'localapi',
    category: 'verbindungen',
    order: 20,
    get title() {
      return t.localApi.title;
    },
    get hint() {
      return t.help.localApi;
    },
    keywords: ['API', 'MCP', 'Token', 'Schnittstelle', 'Port'],
    fields: [
      {
        key: 'enable',
        get label() {
          return t.localApi.enable;
        },
      },
      {
        key: 'port',
        get label() {
          return t.localApi.port;
        },
      },
    ],
    visibleWhen: (ctx) => ctx.aiOn !== false,
    render: () => (
      <SettingsGroup id="localapi" title={t.localApi.title} hint={t.help.localApi} bare>
        <LocalApiSection />
      </SettingsGroup>
    ),
  },
  {
    id: 'quickcapture',
    category: 'schnellerfassung',
    order: 10,
    get title() {
      return t.quickCapture.settings.title;
    },
    keywords: ['Hotkey', 'Tastenkürzel', 'Tray', 'Autostart', 'Zwischenablage'],
    fields: [
      {
        key: 'defaultType',
        get label() {
          return t.quickCapture.settings.defaultType;
        },
      },
      {
        key: 'noQuestion',
        get label() {
          return t.quickCapture.settings.noQuestion;
        },
      },
      {
        key: 'hotkey',
        get label() {
          return t.quickCapture.settings.hotkey;
        },
        get description() {
          return t.quickCapture.settings.hotkeyHint;
        },
      },
      {
        key: 'vaultHotkey',
        get label() {
          return t.quickCapture.settings.vaultHotkey;
        },
      },
      {
        key: 'closeToTray',
        get label() {
          return t.quickCapture.settings.closeToTray;
        },
      },
      {
        key: 'autostart',
        get label() {
          return t.quickCapture.settings.autostart;
        },
      },
      {
        key: 'clipboard',
        get label() {
          return t.quickCapture.settings.clipboard;
        },
      },
    ],
    render: () => (
      <SettingsGroup id="quickcapture" title={t.quickCapture.settings.title} bare>
        <QuickCaptureSection />
      </SettingsGroup>
    ),
  },
  {
    id: 'updates',
    category: 'updates',
    order: 10,
    get title() {
      return t.update.title;
    },
    get hint() {
      return t.help.updateChannel;
    },
    keywords: ['Kanal', 'Beta', 'Stable', 'Prüfen'],
    fields: [
      {
        key: 'channel',
        get label() {
          return t.update.settings.channel;
        },
      },
      {
        key: 'auto',
        get label() {
          return t.update.settings.auto;
        },
      },
      {
        key: 'checkNow',
        get label() {
          return t.update.settings.checkNow;
        },
      },
    ],
    render: () => (
      <SettingsGroup id="updates" title={t.update.title} hint={t.help.updateChannel} bare>
        <UpdateSection />
      </SettingsGroup>
    ),
  },
  {
    id: 'developer',
    category: 'entwickler',
    order: 10,
    get title() {
      return t.settings.cat.entwickler.title;
    },
    keywords: ['Testdaten', 'Seed', 'Zurücksetzen'],
    visibleWhen: (ctx) => ctx.isDev && DeveloperSection !== undefined,
    render: () =>
      DeveloperSection ? (
        <SettingsGroup id="developer" title={t.settings.cat.entwickler.title} bare>
          <Suspense fallback={null}>
            <DeveloperSection />
          </Suspense>
        </SettingsGroup>
      ) : null,
  },
  {
    id: 'model-licenses',
    category: 'ueber',
    order: 55,
    get title() {
      return t.ai.local.licensesTitle;
    },
    keywords: ['Lizenz', 'Modell', 'Apache', 'MIT', 'Gewichte'],
    render: () => <ModelLicensesSection />,
  },
  {
    id: 'setup',
    category: 'ueber',
    order: 30,
    get title() {
      return t.setup.title;
    },
    keywords: ['Einrichtung', 'Assistent', 'Checkliste', 'erneut starten'],
    render: () => (
      <SettingsGroup id="setup" title={t.setup.title} bare>
        <SetupSection />
      </SettingsGroup>
    ),
  },
  {
    id: 'about',
    category: 'ueber',
    order: 10,
    get title() {
      return t.about.title;
    },
    keywords: ['Version', 'Build', 'Commit', 'Plattform', 'Installation', 'Datenordner', 'Lizenz'],
    fields: [
      {
        key: 'version',
        get label() {
          return t.about.version;
        },
      },
      {
        key: 'build',
        get label() {
          return t.about.build;
        },
      },
      {
        key: 'channel',
        get label() {
          return t.about.channel;
        },
      },
      {
        key: 'platform',
        get label() {
          return t.about.platform;
        },
      },
      {
        key: 'install',
        get label() {
          return t.about.install;
        },
      },
      {
        key: 'dataDir',
        get label() {
          return t.about.dataDir;
        },
      },
      {
        key: 'license',
        get label() {
          return t.about.license;
        },
      },
    ],
    render: () => <AboutSection />,
  },
  {
    id: 'supporter',
    category: 'ueber',
    order: 35,
    get title() {
      return t.supporter.section.title;
    },
    get keywords() {
      return t.supporter.section.keywords;
    },
    fields: [
      {
        key: 'code',
        get label() {
          return t.supporter.section.codeLabel;
        },
        get description() {
          return t.supporter.section.codeHint;
        },
      },
      {
        key: 'badge',
        get label() {
          return t.supporter.section.sidebarBadge;
        },
      },
    ],
    render: () => <SupporterSection />,
  },
  {
    id: 'about-updates',
    category: 'ueber',
    order: 20,
    get title() {
      return t.about.updates.title;
    },
    keywords: ['Changelog', 'Änderungen', 'Neuerungen', 'Release Notes'],
    fields: [
      {
        key: 'check',
        get label() {
          return t.about.updates.lastCheck;
        },
      },
    ],
    render: () => <AboutUpdatesSection />,
  },
  {
    id: 'links',
    category: 'ueber',
    order: 40,
    get title() {
      return t.about.links.title;
    },
    keywords: ['GitHub', 'Quellcode', 'Downloads', 'Hilfe', 'Dokumentation', 'Fehler melden'],
    render: () => <LinksSection />,
  },
  {
    id: 'licenses',
    category: 'ueber',
    order: 50,
    get title() {
      return t.about.licenses;
    },
    keywords: ['Bibliotheken', 'Schrift', 'Icons', 'Open Source'],
    render: () => <LicensesSection />,
  },
  {
    id: 'diagnostics',
    category: 'ueber',
    order: 60,
    get title() {
      return t.about.diagnostics.title;
    },
    get description() {
      return t.about.diagnostics.description;
    },
    keywords: ['Fehlerprotokoll', 'Export', 'Support'],
    render: () => <DiagnosticsSection />,
  },
  {
    id: 'device-reset',
    category: 'ueber',
    order: 70,
    get title() {
      return t.about.reset.title;
    },
    get description() {
      return t.about.reset.description;
    },
    keywords: ['Löschen', 'Zurücksetzen', 'Gefahrenzone', 'Alle Daten'],
    render: () => <DeviceResetSection />,
  },
];
