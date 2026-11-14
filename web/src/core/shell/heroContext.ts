import { createContext, useContext, useLayoutEffect } from 'react';

/**
 * Portal targets of the module head of `layout/AreaFrame` (Identity 4.0): the title row takes the page title
 * (`PageHeader` puts its h1 there, so a module never has a head of its own), the one figure with its context line and,
 * on the desktop, the page's actions; the page's views (`Tabs`) lie at the head's lower edge. A stage head (weather,
 * music) also has the backdrop and the signature slot; under a standard head the signature and the free slot lie in
 * the page, right below the head. Outside a shell (settings, dialogs) they are `undefined` and the title renders where
 * it is called.
 */
export interface HeroTargets {
  /** Above the head: a notice that outranks the page (a weather hint, a sync conflict). */
  notice: HTMLElement | null;
  /** Full-bleed layer behind the head's content (the sky). Decoration only. */
  backdrop: HTMLElement | null;
  title: HTMLElement | null;
  /** In the title row: the one figure with its context line (on a stage: the figure of the stage). */
  figure: HTMLElement | null;
  /** In the title row, desktop only: the page's actions (`PageHeader` children) with the one filled module action. */
  actions: HTMLElement | null;
  /** The head's lower edge: the views of the page (`PageHeader views`, `Tabs`). */
  tabs: HTMLElement | null;
  /**
   * The signature slot: on a stage head the stage itself (the frame draws `identity.signature` until the module fills
   * it with `HeroSlot area="signature"`); under a standard head a block the page still brings lies in the page.
   */
  signature: HTMLElement | null;
  /** Strips and controls (hour strip, start/stop): on the stage, or in the page under a standard head. */
  extra: HTMLElement | null;
}

export type HeroArea = keyof HeroTargets;
export const EMPTY_HERO: HeroTargets = {
  notice: null,
  backdrop: null,
  title: null,
  figure: null,
  actions: null,
  tabs: null,
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
 * over the title text, so the eyebrow can name the module when the page's title is another one; a page whose hint above
 * the head waits for a read (`identity.notice`) says when that read is back (`useHeadReady`).
 */
export interface HeroControls {
  /** Claims `area`; returns the release. */
  claim(area: HeroArea): () => void;
  setTitle(text: string | undefined): void;
  /** The page's first read is back (`identity.notice`): the frame shows the notice, the head and the page. */
  settle(): void;
}

export const HeroControlsContext = createContext<HeroControls | undefined>(undefined);

export function useHeroControls(): HeroControls | undefined {
  return useContext(HeroControlsContext);
}

/**
 * For the entry page of a module with `identity.notice`: `ready` once the read its hint above the head depends on is
 * back, with or without a hint (0b-8). Runs before paint, so the hint, the head and the page appear in one frame and
 * the hint never pushes the head down. Outside a frame it does nothing.
 */
export function useHeadReady(ready: boolean): void {
  const controls = useHeroControls();
  useLayoutEffect(() => {
    if (ready) controls?.settle();
  }, [ready, controls]);
}
