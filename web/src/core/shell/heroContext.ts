import { createContext, useContext } from 'react';

/**
 * Portal targets inside the module head ("hero") of the `ModuleShell`: the page title (`PageHeader` puts its h1 there,
 * so a module never has a head of its own) and a free slot beside it for the module's signature (sky, cards, cover).
 * Outside a shell (settings, dialogs) both are `undefined` and the title renders where it is called.
 */
export interface HeroTargets {
  title: HTMLElement | null;
  extra: HTMLElement | null;
}

export const HeroContext = createContext<HeroTargets | undefined>(undefined);

export function useHeroTargets(): HeroTargets | undefined {
  return useContext(HeroContext);
}
