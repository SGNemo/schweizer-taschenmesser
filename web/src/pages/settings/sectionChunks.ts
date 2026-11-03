/**
 * The section components of the settings, each in its own chunk: the registry (`sections.tsx`) only
 * carries cheap metadata, a section's code loads when it is opened (offline without the chunk: the calm
 * `lazyOnline` note). The names stay the ones of the components.
 */
// Not here: Sync and Backup stay in the start bundle (see sections.tsx), they are needed offline.
import { lazyOnline } from '@/core/net/OnlineChunk';
import type { ModuleManifest } from '@/core/modules/types';

export const AboutSection = lazyOnline<object>(() =>
  import('./AboutSections').then((m) => ({ default: m.AboutSection })),
);
export const AboutUpdatesSection = lazyOnline<object>(() =>
  import('./AboutSections').then((m) => ({ default: m.AboutUpdatesSection })),
);
export const DeviceResetSection = lazyOnline<object>(() =>
  import('./AboutSections').then((m) => ({ default: m.DeviceResetSection })),
);
export const DiagnosticsSection = lazyOnline<object>(() =>
  import('./AboutSections').then((m) => ({ default: m.DiagnosticsSection })),
);
export const LinksSection = lazyOnline<object>(() =>
  import('./AboutSections').then((m) => ({ default: m.LinksSection })),
);
export const AiSection = lazyOnline<object>(() =>
  import('./AiSection').then((m) => ({ default: m.AiSection })),
);
export const AiSwitchSection = lazyOnline<object>(() =>
  import('./AiSwitchSection').then((m) => ({ default: m.AiSwitchSection })),
);
export const AppearanceSection = lazyOnline<object>(() =>
  import('./AppearanceSection').then((m) => ({ default: m.AppearanceSection })),
);
export const SupporterSection = lazyOnline<object>(() =>
  import('./SupporterSection').then((m) => ({ default: m.SupporterSection })),
);
export const AiStatsSection = lazyOnline<object>(() =>
  import('./AiStatsSection').then((m) => ({ default: m.AiStatsSection })),
);
export const AiWriteSection = lazyOnline<object>(() =>
  import('./AiWriteSection').then((m) => ({ default: m.AiWriteSection })),
);
export const CalmRemindersSection = lazyOnline<object>(() =>
  import('./CalmRemindersSection').then((m) => ({ default: m.CalmRemindersSection })),
);
export const NetworkSection = lazyOnline<object>(() =>
  import('./NetworkSection').then((m) => ({ default: m.NetworkSection })),
);
export const ShareSection = lazyOnline<object>(() =>
  import('./ShareSection').then((m) => ({ default: m.ShareSection })),
);
export const RecentlyDeletedSection = lazyOnline<object>(() =>
  import('./RecentlyDeletedSection').then((m) => ({ default: m.RecentlyDeletedSection })),
);
export const ConnectorsSection = lazyOnline<object>(() =>
  import('./ConnectorsSection').then((m) => ({ default: m.ConnectorsSection })),
);
export const FavouritesSection = lazyOnline<object>(() =>
  import('./FavouritesSection').then((m) => ({ default: m.FavouritesSection })),
);
export const AdvancedSection = lazyOnline<object>(() =>
  import('./AdvancedSection').then((m) => ({ default: m.AdvancedSection })),
);
export const FocusSection = lazyOnline<object>(() =>
  import('./FocusSection').then((m) => ({ default: m.FocusSection })),
);
export const GeneralSection = lazyOnline<object>(() =>
  import('./GeneralSection').then((m) => ({ default: m.GeneralSection })),
);
export const LocalApiSection = lazyOnline<object>(() =>
  import('./LocalApiSection').then((m) => ({ default: m.LocalApiSection })),
);
export const LocalModelSection = lazyOnline<object>(() =>
  import('./LocalModelSection').then((m) => ({ default: m.LocalModelSection })),
);
export const LegalImprintSection = lazyOnline<object>(() =>
  import('./LegalSections').then((m) => ({ default: m.LegalImprintSection })),
);
export const LegalLicensesSection = lazyOnline<object>(() =>
  import('./LegalSections').then((m) => ({ default: m.LegalLicensesSection })),
);
export const LegalPrivacySection = lazyOnline<object>(() =>
  import('./LegalSections').then((m) => ({ default: m.LegalPrivacySection })),
);
export const ModelLicensesSection = lazyOnline<object>(() =>
  import('./ModelLicensesSection').then((m) => ({ default: m.ModelLicensesSection })),
);
export const NotificationsSection = lazyOnline<object>(() =>
  import('./NotificationsSection').then((m) => ({ default: m.NotificationsSection })),
);
export const ReadingSection = lazyOnline<object>(() =>
  import('./ReadingSection').then((m) => ({ default: m.ReadingSection })),
);
export const QuickCaptureSection = lazyOnline<object>(() =>
  import('./QuickCaptureSection').then((m) => ({ default: m.QuickCaptureSection })),
);
export const ShortcutsSection = lazyOnline<object>(() =>
  import('./ShortcutsSection').then((m) => ({ default: m.ShortcutsSection })),
);
export const VoiceSection = lazyOnline<object>(() =>
  import('./VoiceSection').then((m) => ({ default: m.VoiceSection })),
);
export const WeatherSection = lazyOnline<object>(() =>
  import('./WeatherSection').then((m) => ({ default: m.WeatherSection })),
);
export const AccessibilitySection = lazyOnline<object>(() =>
  import('./AccessibilitySection').then((m) => ({ default: m.AccessibilitySection })),
);
export const NotificationSourcesSection = lazyOnline<object>(() =>
  import('./NotificationSourcesSection').then((m) => ({ default: m.NotificationSourcesSection })),
);
export const StorageSection = lazyOnline<object>(() =>
  import('./StorageSection').then((m) => ({ default: m.StorageSection })),
);
export const HistorySection = lazyOnline<object>(() =>
  import('./HistorySection').then((m) => ({ default: m.HistorySection })),
);
export const ProfilesSection = lazyOnline<object>(() =>
  import('./ProfilesSection').then((m) => ({ default: m.ProfilesSection })),
);
export const TransferSection = lazyOnline<object>(() =>
  import('./TransferSection').then((m) => ({ default: m.TransferSection })),
);
export const SetupSection = lazyOnline<object>(() =>
  import('./SetupSection').then((m) => ({ default: m.SetupSection })),
);
export const PersonaSection = lazyOnline<object>(() =>
  import('./PersonaSection').then((m) => ({ default: m.PersonaSection })),
);
export const ToolsSection = lazyOnline<object>(() =>
  import('./ToolsSection').then((m) => ({ default: m.ToolsSection })),
);
export const UpdateSection = lazyOnline<object>(() =>
  import('./UpdateSection').then((m) => ({ default: m.UpdateSection })),
);
export const ModuleSection = lazyOnline<{ manifest: ModuleManifest }>(() =>
  import('./ModuleSection').then((m) => ({ default: m.ModuleSection })),
);
