/**
 * Tools are small self-contained helpers (calculator, timer, QR code …), reachable from the toolbar
 * in the top bar. They are not modules: they hold no data of their own, are not synced (only which
 * ones are on and their order), and never import modules or the database (ESLint).
 */
import type { ComponentType } from 'react';
import type { Maturity, ModuleHue, SignatureId } from '@/core/modules/types';
import type { SetupStepDef } from '@/core/setup/types';
import type { IconName } from '@/ui/icons';

export type ToolGroup = 'basis' | 'extra' | 'dev';

/** How the toolbox panel sorts its list (`group` stays the library/settings section). */
export const TOOL_CATEGORIES = [
  'rechnen',
  'zeit',
  'erzeugen',
  'medien',
  'text',
  'entwickler',
] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

/** Identity v3 for a tool (docs/design/MODULE-IDENTITY.md "Tools"): colour, mark, type. */
export interface ToolIdentity {
  /** Primary colour of the plate and the tinted head; one of the palette v3 hues. */
  hue: ModuleHue;
  /** Optional second colour (second stop of the head). Never equal to `hue`. */
  hue2?: ModuleHue;
  /** The mark in the tool's head, from the one signature library (`SIGNATURES`, `@/ui/identity`). */
  signature: SignatureId;
  /** `mono` for code-like tools (developer group); everything else stays sans. */
  type?: 'sans' | 'mono';
}

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
  /** Required. Sorting in the toolbox panel and the search; `npm run check:tools` checks it. */
  category: ToolCategory;
  /** Required. Colour, mark and type of the tool (identity v3); `npm run check:tools` checks it. */
  identity: ToolIdentity;
  /**
   * Required. Extra words the panel search and palette match (synonyms, other spellings), taken
   * from the current language (`t.tools.<id>.keywords`, comma separated there, split by `toolKeywords`).
   */
  keywords: readonly string[];
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
