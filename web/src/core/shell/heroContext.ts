import { createContext, useContext } from 'react';

/**
 * Portal targets inside the module head ("hero") of the `ModuleShell`: the page title (`PageHeader` puts its h1 there,
 * so a module never has a head of its own) and a free slot beside it for the module's signature (sky, cards, cover).
 * Outside a shell (settings, dialogs) both are `undefined` and the title renders where it is called.
 */
export interface HeroTargets {
  /** Above the head: a notice that outranks the page (a weather hint, a sync conflict). */
  notice: HTMLElement | null;
  /** Full-bleed layer behind the head's content (the sky). Decoration only. */
  backdrop: HTMLElement | null;
  title: HTMLElement | null;
  /** Under the title: the module's own headline block (big figure with context). */
  figure: HTMLElement | null;
  /** Beside the title: the signature (cards, leaf, cover). */
  extra: HTMLElement | null;
}

export type HeroArea = keyof HeroTargets;
export const EMPTY_HERO: HeroTargets = {
  notice: null,
  backdrop: null,
  title: null,
  figure: null,
  extra: null,
};

export const HeroContext = createContext<HeroTargets | undefined>(undefined);

export function useHeroTargets(): HeroTargets | undefined {
  return useContext(HeroContext);
}
