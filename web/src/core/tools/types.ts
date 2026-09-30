/**
 * Tools are small self-contained helpers (calculator, timer, QR code …), reachable from the toolbar
 * in the top bar. They are not modules: they hold no data of their own, are not synced (only which
 * ones are on and their order), and never import modules or the database (ESLint).
 */
import type { ComponentType } from 'react';
import type { SetupStepDef } from '@/core/setup/types';
import type { IconName } from '@/ui/icons';

export type ToolGroup = 'basis' | 'extra' | 'dev';

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
  defaultEnabled: boolean;
  /** Lower = earlier. */
  order: number;
  component: () => Promise<{ default: ComponentType }>;
  /** Optional steps for the setup assistant; ids must start with `<tool id>.`. */
  setupSteps?: SetupStepDef[];
}
