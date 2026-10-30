import { t } from '@/strings';
import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { placeSchema, routeSchema } from './schema';
import { settings } from './settings';

/**
 * "Karten & Orte": saved places and routes, a map (OpenStreetMap tiles, drawn without a map library) and
 * a place search. The map and the search only talk to the network when the user opens or uses them
 * (data flow `maps`, one-time notice). The `aiSchema` names fields only (no coordinates); the assistant never gets values.
 */
const manifest: ModuleManifest = {
  id: 'maps',
  get name() {
    return t.maps.meta.name;
  },
  icon: 'map',
  version: 1,
  get description() {
    return t.maps.meta.description;
  },
  routes: [
    {
      path: '/maps',
      get label() {
        return t.maps.meta.name;
      },
      nav: true,
      component: () => import('./routes/MapsPage'),
    },
  ],
  dataSchema: {
    collections: {
      place: { schema: placeSchema, indexes: ['createdAt'] },
      route: { schema: routeSchema, indexes: ['createdAt'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'places',
      get title() {
        return t.maps.widget.title;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/PlacesWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [] },
  layout: 'wide',
  area: 'plan',
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [
      {
        id: 'place',
        get label() {
          return t.maps.meta.quickAdd;
        },
        to: '/maps?new=1',
      },
    ],
  },
};

export default manifest;
