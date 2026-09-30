import { noOnboarding } from '@/core/importer/types';
import type { ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { itemSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'pantry',
  name: 'Vorräte',
  icon: 'package',
  version: 1,
  description:
    'Was ist im Kühlschrank, im Vorratsschrank und im Tiefkühler? Mit Ablaufdaten, Erinnerung vor Ablauf und „Auf die Einkaufsliste“, wenn etwas zur Neige geht.',
  routes: [
    {
      path: '/pantry',
      label: 'Vorräte',
      nav: true,
      component: () => import('./routes/PantryPage'),
    },
  ],
  dataSchema: {
    collections: {
      item: {
        schema: itemSchema,
        indexes: ['expires'],
        example: { name: 'Beispielmilch', place: 'fridge', count: 2 },
      },
    },
  },
  migrations,
  widgets: [
    {
      id: 'expiring',
      title: 'Vorräte',
      size: 's',
      component: () => import('./widgets/ExpiringWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  layout: 'content',
  order: 95,
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [{ id: 'item', label: 'Vorrat', to: '/pantry?new=1' }],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
  },
};

export default manifest;
