import { useLayoutEffect, useState, type RefObject } from 'react';
import { G, phoneView, type SceneOptions } from './draw';

/** Card (overview widget): the body's centre as shares of the card's width from the right and of its height. */
const CARD = { bodyX: 0.2, bodyY: 0.5 } as const;
/** Width of the text column on a wide stage, rem. */
const TEXT_REM = 36;
/** Fog bands start this far left of the quiet edge and fade in (draw.ts `fogBand`): the card's text stays clear of them. */
const FOG_LEAD = 80;

/**
 * The scene behind a card (the overview widget) with the frame's head above its text: the whole panorama at the card's
 * width (`k = W / 1600`), the view reaching up into more sky (`view[1] < 0`), so the text rows lie on the sky and the
 * haze and never on the massif, the forest or the lake. The text ends at `share` of the width and the quiet zone one
 * fog lead later (`FOG_LEAD`), so a fog band only begins where the text ends; the body sits in its own box on the
 * right, at the card's mid height.
 */
export function cardFit(W: number, H: number, share: number): SceneOptions {
  const k = W / G.W;
  const h = Math.round(Math.max(G.H, H / k));
  const y0 = G.H - h;
  return {
    view: [0, y0, G.W, h],
    quietX: Math.round(G.W * share) + FOG_LEAD,
    bodyAt: [Math.round(G.W * (1 - CARD.bodyX)), Math.round(y0 + (H * CARD.bodyY) / k)],
  };
}

export interface SceneFit {
  /** The box the scene fills, px (0 before the first measurement). */
  w: number;
  h: number;
  /** The head's drawing (round 2). */
  opts: SceneOptions;
  /** The card's fit, when `quietShare` is given. */
  card?: SceneOptions;
}

const key = (f: SceneFit): string =>
  JSON.stringify([f.w, f.h, f.opts.quietX, f.opts.view, f.opts.phone, f.card]);

/**
 * Fits the scene to its stage (round 2, CONCEPT §5): on the phone the right `w / 0.46` units of the picture,
 * bottom-aligned, the quiet edge at 1000 and the body between the main summit and the third; on a wide stage the
 * quiet side ends at the right edge of the text (`[data-scene-text]`, at most 36 rem wide). A card takes
 * `cardFit`.
 */
export function useSceneFit(
  ref: RefObject<HTMLElement | null>,
  phone: boolean,
  /** The quiet zone ends at this share of the box's width (a card behind its text), not at the measured text. */
  quietShare?: number,
): SceneFit {
  // Before the first measurement the phone is drawn for a nominal box (412 × 256), never the whole panorama.
  const [fit, setFit] = useState<SceneFit>({
    w: 0,
    h: 0,
    opts: phone ? { phone, view: phoneView(412, 256), quietX: G.phone.quietX } : {},
  });
  // Before the first paint: the scene is drawn for its box from the start, it does not jump into place.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stage =
      (el.closest('[data-head="stage"]') as HTMLElement | null) ?? el.parentElement ?? el;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const W = Math.round(box.width);
      const H = Math.round(box.height);
      if (!W || !H) return;
      const next: SceneFit = { w: W, h: H, opts: {} };
      if (quietShare != null) next.card = cardFit(W, H, quietShare);
      else if (phone) next.opts = { phone: true, view: phoneView(W, H), quietX: G.phone.quietX };
      else {
        const scale = Math.max(W / G.W, H / G.H);
        const units = W / scale;
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        let right = 0;
        stage.querySelectorAll('[data-scene-text]').forEach((t) => {
          const r = t.getBoundingClientRect();
          right = Math.max(right, r.left - box.left + Math.min(r.width, TEXT_REM * rem));
        });
        if (right > 0) next.opts.quietX = Math.round(G.W - units + right / scale);
      }
      setFit((prev) => (key(prev) === key(next) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [ref, phone, quietShare]);
  return fit;
}
