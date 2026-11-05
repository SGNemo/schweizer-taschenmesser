import { t } from '@/strings';
import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { entrySchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'planner',
  get name() {
    return t.planner.meta.name;
  },
  icon: 'puzzle',
  // Identity v3 (docs/design/identity-v3/02-CONCEPT.md, docs/design/MODULE-IDENTITY.md): the hue from the palette
  // (lime | moss | fern | teal | ocean | sky | cobalt | indigo | violet | orchid | slate; free in the area, 25° apart),
  // the catalogue type of the main widget (kpi | dueList | progress | checklist | timeline | tiles | status | gauge), the
  // widget's shape (kennzahl | zeitleiste | fortschritt | cover | himmel | kacheln | status | notiz | fokus | faellig | checkliste),
  // the head variant (kennzahl | zeit | fortschritt | cover | himmel | regal | tresor | schreib | fokus; not the same as the
  // neighbour module's in the area) and the signature inside the head ('none' until you build one).
  identity: {
    hue: 'slate',
    widgetType: 'kpi',
    widget: 'kennzahl',
    head: 'schreib',
    signature: 'none',
  },
  version: 1,
  get description() {
    return t.planner.meta.description;
  },
  routes: [
    {
      path: '/planner',
      get label() {
        return t.planner.meta.name;
      },
      nav: true,
      component: () => import('./routes/MainPage'),
    },
  ],
  dataSchema: {
    collections: {
      entry: { schema: entrySchema, indexes: ['createdAt'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'summary',
      get title() {
        return t.planner.meta.name;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/SummaryWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  maturity: 'stable',
  seed: { version: 1, dependsOn: [] },
  // layout: 'content', // page width: 'narrow' | 'content' | 'wide' | 'full' (default 'content')
  area: 'knowledge', // navigation area: plan | money | household | knowledge | vault | system
  // order: 50, // lower = earlier in navigation and library (default 100)
  // automation: () => import('./automation'), // events, state checks and `create` actions for rules (docs/howto/automation.md); never for secrets
  contributions: {
    // Start-data importers (see modules/todos/importer.ts); `noOnboarding` = nothing to import.
    onboarding: noOnboarding,
    quickAdd: [
      {
        id: 'new',
        get label() {
          return t.planner.meta.quickAdd;
        },
        to: '/planner?new=1',
      },
    ],
  },
};

export default manifest;
