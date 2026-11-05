import { createContext, useContext } from 'react';

/**
 * Portal targets inside the module head ("hero") of `layout/AreaFrame`: the page title (`PageHeader` puts its h1
 * there, so a module never has a head of its own), the figure under it, the signature slot beside the figure and a
 * free slot for strips and controls. Outside a shell (settings, dialogs) they are `undefined` and the title renders
 * where it is called.
 */
export interface HeroTargets {
  /** Above the head: a notice that outranks the page (a weather hint, a sync conflict). */
  notice: HTMLElement | null;
  /** Full-bleed layer behind the head's content (the sky). Decoration only. */
  backdrop: HTMLElement | null;
  title: HTMLElement | null;
  /** Under the title: the module's own headline block (big figure with context). */
  figure: HTMLElement | null;
  /**
   * The signature slot (identity v3.1): sized by the head variant (`SIGNATURE_SLOTS`), drawn by the frame with the
   * module's `identity.signature` until the module fills it (`HeroSlot area="signature"`).
   */
  signature: HTMLElement | null;
  /** Beside the figure: strips and controls (hour strip, start/stop, filters). */
  extra: HTMLElement | null;
}

export type HeroArea = keyof HeroTargets;
export const EMPTY_HERO: HeroTargets = {
  notice: null,
  backdrop: null,
  title: null,
  figure: null,
  signature: null,
  extra: null,
};

export const HeroContext = createContext<HeroTargets | undefined>(undefined);

export function useHeroTargets(): HeroTargets | undefined {
  return useContext(HeroContext);
}

/**
 * What the page tells the frame (never the other way round): a `HeroSlot` claims its area for as long as it is
 * mounted, so the frame stops drawing its own default there (the signature, the headline figure); `PageTitle` hands
 * over the title text, so the phone's compact bar never reads the DOM.
 */
export interface HeroControls {
  /** Claims `area`; returns the release. */
  claim(area: HeroArea): () => void;
  setTitle(text: string | undefined): void;
}

export const HeroControlsContext = createContext<HeroControls | undefined>(undefined);

export function useHeroControls(): HeroControls | undefined {
  return useContext(HeroControlsContext);
}
