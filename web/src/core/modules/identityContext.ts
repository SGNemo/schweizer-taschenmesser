import { createContext, useContext } from 'react';
import type { IconName } from '@/ui/icons';
import type { ModuleHue, SignatureId } from './types';

/** What a dialog needs to wear a module's identity (S02): hue, icon plate and signature mark. */
export interface ModuleIdentityMark {
  hue: ModuleHue;
  icon: IconName;
  signature: SignatureId;
}

/**
 * The identity of the module page around this part of the tree. The module frame (`layout/AreaFrame`) provides it
 * around the page content, so only what renders inside a module page sees it: the shell's own dialogs (tools,
 * palette, capture, notifications), the overview and settings stay neutral by construction.
 */
export const ModuleIdentityContext = createContext<ModuleIdentityMark | undefined>(undefined);

/** The identity of the module page this component sits in; undefined outside module pages. */
export const useModuleIdentity = (): ModuleIdentityMark | undefined =>
  useContext(ModuleIdentityContext);
