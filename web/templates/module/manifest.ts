import { t } from '@/strings';
import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { entrySchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: '__ID__',
  get name() {
    return t.__ID__.meta.name;
  },
  icon: 'puzzle',
  // Identity v3 (docs/design/identity-v3/02-CONCEPT.md, docs/design/MODULE-IDENTITY.md): the hue from the palette
  // (lime | moss | fern | teal | ocean | sky | cobalt | indigo | violet | orchid | slate; free in the area, 25° apart),
  // the catalogue type of the main widget (kpi | dueList | progress | checklist | timeline | tiles | status | gauge), the
  // widget's shape (kennzahl | zeitleiste | fortschritt | cover | himmel | kacheln | status | notiz | fokus | faellig | checkliste),
  // the head variant (standard | stage; Identity 4.0: `standard` for every module, a stage is the exception) and the
  // signature (the drawing the module is recognised by; two modules with one hue each need one of their own, so pick
  // yours from SIGNATURES before you ship: 'none' only passes while no other module has your hue).
  identity: {
    hue: 'slate',
    widgetType: 'kpi',
    widget: 'kennzahl',
    head: 'standard',
    signature: 'none',
  },
  version: 1,
  get description() {
    return t.__ID__.meta.description;
  },
  routes: [
    {
      path: '/__ID__',
      get label() {
        return t.__ID__.meta.name;
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
        return t.__ID__.meta.name;
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
          return t.__ID__.meta.quickAdd;
        },
        to: '/__ID__?new=1',
      },
    ],
  },
};

export default manifest;
