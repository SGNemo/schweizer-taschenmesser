/**
 * Tools are small self-contained helpers (calculator, timer, QR code …), reachable from the toolbar
 * in the top bar. They are not modules: they hold no data of their own, are not synced (only which
 * ones are on and their order), and never import modules or the database (ESLint).
 */
import type { ComponentType } from 'react';
import type { Maturity } from '@/core/modules/types';
import type { SetupStepDef } from '@/core/setup/types';
import type { IconName } from '@/ui/icons';

export type ToolGroup = 'basis' | 'extra' | 'dev';

/**
 * What a tool answers to a line typed into the search bar ("timer 10m", "umrechnen 5 km"): one line
 * for the result list, and what Enter does with it. Computed locally, nothing is sent anywhere.
 */
export interface ToolAnswer {
  /** The line shown in the list, e.g. "5 km = 5.000 m · 3,11 mi". */
  text: string;
  /** Enter copies this (plain text) … */
  copy?: string;
  /** … or runs this (e.g. starts the timer). */
  run?: () => void | Promise<void>;
}

export interface ToolManifest {
  /** Lowercase alphanumeric; also the folder name under `src/tools`. */
  id: string;
  name: string;
  icon: IconName;
  /** One sentence for the tool library. */
  description: string;
  group: ToolGroup;
  /** Works without a network connection (shown as a badge in the library). */
  offline: boolean;
  /** On without user action; `false` = off but listed ("aus, aber sichtbar"). */
  defaultEnabled: boolean;
  /**
   * Required. `preview` hides the tool from the toolbox, library, palette and settings until
   * "In Arbeit anzeigen" is on (`core/tools/state.ts` `isVisible`); a tool the user switched on
   * explicitly stays listed. `npm run check:modules` fails without it.
   */
  maturity: Maturity;
  /** Lower = earlier. */
  order: number;
  component: () => Promise<{ default: ComponentType }>;
  /**
   * Optional: answers a line typed into the search bar. Must be a cheap pure parse (it runs on every
   * keystroke), returns `undefined` for everything it does not recognise, and starts heavy things
   * lazily inside `run`. Only offered while the tool is switched on.
   */
  expression?: (query: string) => ToolAnswer | undefined;
  /** Optional steps for the setup assistant; ids must start with `<tool id>.`. */
  setupSteps?: SetupStepDef[];
}
