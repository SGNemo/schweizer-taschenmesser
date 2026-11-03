import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { settings } from './settings';

/**
 * Weather: a module with a page of its own (the former preview dialog), built on the module frame. The place and the switch live in
 * Einstellungen → Verbindungen (shared scope `weather`, `core/weather`); the module has no collections: the forecast comes from
 * open-meteo.com on request and is cached on the device only. Not for the data API and not for the assistant (no `aiSchema`).
 */
const manifest: ModuleManifest = {
  id: 'weather',
  get name() {
    return tWeather.get().title;
  },
  icon: 'cloudSun',
  identity: {
    hue: 'indigo',
    hue2: 'sky',
    widgetType: 'kpi',
    head: 'cover',
    surface: 'gradient',
    signature: 'sky',
    type: 'thin',
    shape: 'round',
  },
  version: 1,
  get description() {
    return tWeather.get().description;
  },
  maturity: 'stable',
  routes: [
    {
      path: '/weather',
      get label() {
        return tWeather.get().title;
      },
      nav: true,
      component: () => import('./routes/WeatherPage'),
    },
  ],
  dataSchema: { collections: {} },
  migrations: {},
  widgets: [
    {
      id: 'today',
      get title() {
        return tWeatherPage.get().widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      to: '/weather',
      component: () => import('./widgets/WeatherWidget'),
    },
  ],
  settings,
  dataApi: false,
  defaultEnabled: true,
  seed: { version: 1, dependsOn: [], none: 'live-data' },
  layout: 'wide',
  order: 45,
  area: 'plan',
  contributions: { onboarding: noOnboarding },
};

export default manifest;
