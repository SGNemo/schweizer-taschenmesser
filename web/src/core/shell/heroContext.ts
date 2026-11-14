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
 * the head or whose stage waits for its first reads (`identity.firstRead`) says when those reads are back
 * (`useHeadReady`).
 */
export interface HeroControls {
  /** Claims `area`; returns the release. */
  claim(area: HeroArea): () => void;
  setTitle(text: string | undefined): void;
  /** The page's first reads are back (`identity.firstRead`): the frame shows the notice, head and page. */
  settle(): void;
  /** The frame's hold ended at its bound before the page settled (`FIRST_READ_HOLD_MS`, a slow network): parts that
   * arrive late go where they push nothing that is already painted, for the rest of this visit. */
  late: boolean;
  /** Keeps the stage's room of the last visit (U01) while `on`: a head whose figure still waits for a late read. */
  keepRoom(on: boolean): void;
}

export const HeroControlsContext = createContext<HeroControls | undefined>(undefined);

export function useHeroControls(): HeroControls | undefined {
  return useContext(HeroControlsContext);
}

/**
 * For the entry page of a module with `identity.firstRead`: `ready` once the reads its hint above
 * the head or its stage depend on are back, with or without a hint (0b-8). Runs before paint, so the hint, the head and
 * the page appear in one frame and nothing pushes the head or the page down. Returns `late`: the frame stopped waiting
 * (`FIRST_READ_HOLD_MS`, a slow network) and painted before `ready`, so what arrives now must not move what is painted.
 * Outside a frame it does nothing and returns false.
 */
export function useHeadReady(ready: boolean): boolean {
  const controls = useHeroControls();
  useLayoutEffect(() => {
    if (ready) controls?.settle();
  }, [ready, controls]);
  return controls?.late ?? false;
}

/**
 * While `on`, the stage keeps the room it took on the last visit of this route (U01), so a head whose figure and facts
 * still wait for a late read (a slow network after the first-read hold, 0b-8) does not grow when they arrive.
 * Outside a frame it does nothing.
 */
export function useKeepHeadRoom(on: boolean): void {
  const controls = useHeroControls();
  useLayoutEffect(() => {
    if (!on || !controls) return;
    controls.keepRoom(true);
    return () => controls.keepRoom(false);
  }, [on, controls]);
}
