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
import { AboutSection } from './AboutSection';
import { AiSection } from './AiSection';
import { AppearanceSection } from './AppearanceSection';
import { BackupSection } from './BackupSection';
import { ConnectorsSection } from './ConnectorsSection';
import { FavouritesSection } from './FavouritesSection';
import { GeneralSection } from './GeneralSection';
import { LocalApiSection } from './LocalApiSection';
import { NotificationsSection } from './NotificationsSection';
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
    title: s.general.title,
    keywords: ['Name', 'Wochenstart', 'Sprache', 'Währung', 'Zeitzone', 'Format', 'Datum'],
    fields: [
      { key: 'displayName', label: s.general.name, description: s.general.nameHint },
      { key: 'weekStart', label: s.general.weekStart, description: s.general.weekStartHint },
      { key: 'language', label: s.general.language },
      { key: 'currency', label: s.general.currency },
      { key: 'timeZone', label: s.general.timeZone },
      { key: 'formats', label: s.general.formats },
    ],
    render: () => <GeneralSection />,
  },
  {
    id: 'appearance',
    category: 'darstellung',
    order: 10,
    title: s.appearance,
    keywords: ['Theme', 'Dunkelmodus', 'Schrift', 'Animation'],
    fields: [
      { key: 'theme', label: s.theme, description: s.rows.themeHint },
      { key: 'accent', label: s.accent, description: s.rows.accentHint },
      { key: 'textSize', label: s.textSize, description: s.rows.textSizeHint },
      { key: 'density', label: s.density, description: s.rows.densityHint },
      { key: 'sidebar', label: s.sidebar, description: s.rows.sidebarHint },
      { key: 'motion', label: s.rows.motion, description: s.rows.motionHint },
    ],
    render: () => <AppearanceSection />,
  },
  {
    id: 'favourites',
    category: 'darstellung',
    order: 20,
    title: s.favourites,
    description: s.favouritesHint,
    render: () => <FavouritesSection />,
  },
  {
    id: 'modules',
    category: 'module',
    order: 0,
    title: s.modulesOverview.title,
    description: s.modulesOverview.description,
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
    title: s.tools.title,
    description: s.tools.description,
    keywords: ['Werkzeugleiste', 'Reihenfolge'],
    render: () => <ToolsSection />,
  },
  {
    id: 'notifications',
    category: 'benachrichtigungen',
    order: 10,
    title: t.notifications.title,
    keywords: ['Push', 'Erlaubnis', 'Erinnerung'],
    render: () => <NotificationsSection />,
  },
  {
    id: 'browser-extension',
    category: 'verbindungen',
    order: 30,
    title: s.linkRow.browserExtension,
    description: s.linkRow.browserExtensionHint,
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
    title: t.sync.title,
    hint: t.help.sync,
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
    title: t.backup.title,
    keywords: ['Export', 'Import', 'Sicherung', 'Wiederherstellen', 'Automatisch'],
    render: () => (
      <SettingsGroup id="backup" title={t.backup.title} bare>
        <BackupSection />
      </SettingsGroup>
    ),
  },
  {
    id: 'ai',
    category: 'ki',
    order: 10,
    title: t.ai.title,
    hint: t.help.aiRouter,
    keywords: ['Anbieter', 'Schlüssel', 'Limit', 'Cache', 'Zähler'],
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
    title: t.connectors.title,
    hint: t.help.connectors,
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
    title: t.localApi.title,
    hint: t.help.localApi,
    keywords: ['API', 'MCP', 'Token', 'Schnittstelle', 'Port'],
    fields: [
      { key: 'enable', label: t.localApi.enable },
      { key: 'port', label: t.localApi.port },
    ],
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
    title: t.quickCapture.settings.title,
    keywords: ['Hotkey', 'Tastenkürzel', 'Tray', 'Autostart', 'Zwischenablage'],
    fields: [
      { key: 'defaultType', label: t.quickCapture.settings.defaultType },
      {
        key: 'hotkey',
        label: t.quickCapture.settings.hotkey,
        description: t.quickCapture.settings.hotkeyHint,
      },
      { key: 'vaultHotkey', label: t.quickCapture.settings.vaultHotkey },
      { key: 'closeToTray', label: t.quickCapture.settings.closeToTray },
      { key: 'autostart', label: t.quickCapture.settings.autostart },
      { key: 'clipboard', label: t.quickCapture.settings.clipboard },
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
    title: t.update.title,
    hint: t.help.updateChannel,
    keywords: ['Kanal', 'Beta', 'Stable', 'Prüfen'],
    fields: [
      { key: 'channel', label: t.update.settings.channel },
      { key: 'auto', label: t.update.settings.auto },
      { key: 'checkNow', label: t.update.settings.checkNow },
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
    title: t.settings.cat.entwickler.title,
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
    id: 'about',
    category: 'ueber',
    order: 10,
    title: t.about.title,
    keywords: ['Version', 'Lizenz', 'Logo'],
    render: () => (
      <SettingsGroup id="about" title={t.about.title} bare>
        <AboutSection />
      </SettingsGroup>
    ),
  },
  {
    id: 'setup',
    category: 'ueber',
    order: 20,
    title: t.setup.title,
    keywords: ['Einrichtung', 'Assistent', 'Checkliste', 'erneut starten'],
    render: () => (
      <SettingsGroup id="setup" title={t.setup.title} bare>
        <SetupSection />
      </SettingsGroup>
    ),
  },
];
