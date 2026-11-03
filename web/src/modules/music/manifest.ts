import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { tMusicPage } from '@/strings.musicPage';
import { settings } from './settings';

/**
 * Music (Spotify): a module with a page of its own (the former player dialog), built on the module frame. The connection lives in
 * Einstellungen → Verbindungen (connector `spotify`, `connectors/spotify`); the module has no collections: what plays, your playlists
 * and the queue are read from Spotify on request and kept only while the page is open (hidden songs: ids only, on this device).
 * Preview like the connector; switch it on in the library (Wissen). No `aiSchema`, `dataApi: false`.
 */
const manifest: ModuleManifest = {
  id: 'music',
  get name() {
    return tMusicPage.get().name;
  },
  icon: 'music',
  identity: {
    hue: 'orchid',
    widgetType: 'status',
    head: 'cover',
    surface: 'gradient',
    signature: 'coverTone',
    type: 'mono',
  },
  version: 1,
  get description() {
    return tMusicPage.get().description;
  },
  maturity: 'preview',
  routes: [
    {
      path: '/music',
      get label() {
        return tMusicPage.get().name;
      },
      nav: true,
      component: () => import('./routes/MusicPage'),
    },
  ],
  dataSchema: { collections: {} },
  migrations: {},
  widgets: [
    {
      id: 'player',
      get title() {
        return tMusicPage.get().widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      to: '/music',
      component: () => import('./widgets/NowPlayingWidget'),
    },
  ],
  settings,
  dataApi: false,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [], none: 'live-data' },
  layout: 'wide',
  order: 160,
  area: 'knowledge',
  contributions: { onboarding: noOnboarding },
};

export default manifest;
