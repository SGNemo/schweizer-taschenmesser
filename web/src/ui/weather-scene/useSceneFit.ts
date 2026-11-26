import { useLayoutEffect, useState, type RefObject } from 'react';
import { G, phoneView, type SceneOptions } from './draw';

/** The overview widget's text ends at this share of the card's width (handoff 04). */
export const CARD_QUIET_SHARE = 0.55;
/** Card (overview widget): the body's centre as shares of the card's width from the right and of its height. */
const CARD = { bodyX: 0.2, bodyY: 0.5, kMax: G.phone.k, bodyMaxY: 110 } as const;
/** Width of the text column on a wide stage, rem. */
const TEXT_REM = 36;
/** Fog bands start this far left of the quiet edge and fade in (draw.ts `fogBand`): the card's text stays clear of them. */
const FOG_LEAD = 80;

/** The card's text as measured in the box, px: its right edge and its bottom (the lowest text row). */
export interface CardText {
  right: number;
  bottom: number;
}

/** The highest land (ground or a tree) in view between `x0` and `x`, scene units (smaller y = higher). */
function landTop(x0: number, x: number): number {
  let top = G.H;
  for (const [gx, gy] of G.ground) if (gx >= x0 && gx <= x) top = Math.min(top, gy);
  for (const t of [...G.trees, ...G.behind])
    if (t[1] + t[3] >= x0 && t[1] - t[3] <= x)
      top = Math.min(top, t[2] - (t[0] === 'bush' ? 2 * t[3] : t[3]));
  return top;
}

/**
 * The scene behind a card (the overview widget) with the frame's head above its text. The picture is drawn as large
 * as the text allows, up to the phone head's scale (0.46): right-aligned like the phone's head (cabin and summit in
 * view), bottom-aligned, the land filling the room under the text. Land left of the text's right edge (ground and
 * trees) always lies below the lowest text row, so the text rows meet the sky, the deck and the hazed far layers
 * only; a card too low for that falls back to the whole panorama at the card's width (`k = W / 1600`) with more sky
 * above. The quiet zone begins one fog lead after the text (`FOG_LEAD`); the body sits in its own box on the right,
 * at the card's mid height. Without a measured text: the text ends at `share` of the width, 24 px above the bottom.
 */
export function cardFit(W: number, H: number, share: number, text?: CardText): SceneOptions {
  const right = text?.right ?? W * share;
  const bottom = text?.bottom ?? H - 24;
  const kMin = W / G.W;
  const fit = (k: number) => {
    const vw = W / k;
    const x0 = G.W - vw;
    // the card's own aspect: a wide, low card shows less sky above, never a crop by the browser
    const h = H / k;
    const y0 = G.H - h;
    const quietX = Math.round(x0 + right / k) + FOG_LEAD;
    return { k, x0, y0, h, quietX };
  };
  const fits = (c: ReturnType<typeof fit>) => (landTop(c.x0, c.quietX) - c.y0) * c.k >= bottom;
  let f: ReturnType<typeof fit> | undefined;
  for (let i = 0; CARD.kMax - i / 100 > kMin && !f; i++) {
    const c = fit(CARD.kMax - i / 100);
    // the land on the text's side starts below the lowest text row
    if (fits(c)) f = c;
  }
  if (!f) {
    f = fit(kMin);
    // A wide, low card (its scale fixed by the width): the view rises by what is missing, so the bottom edge cuts a
    // few units of ground instead of the text standing on it.
    if (!fits(f)) {
      f.y0 = landTop(f.x0, f.quietX) - bottom / f.k - 1;
      f.h = H / f.k;
    }
  }
  return {
    view: [Math.round(f.x0), Math.round(f.y0), Math.round(W / f.k), Math.round(f.h)],
    quietX: f.quietX,
    bodyAt: [
      Math.round(f.x0 + (W * (1 - CARD.bodyX)) / f.k),
      // never behind the massif (a low, wide card): above its summit line, inside the view
      Math.round(Math.max(f.y0 + 30, Math.min(f.y0 + (H * CARD.bodyY) / f.k, CARD.bodyMaxY))),
    ],
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
    // The card's text is watched too: a rain chip or a longer line changes where the land may begin.
    let watched = false;
    const ro: ResizeObserver | undefined =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure()) : undefined;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const W = Math.round(box.width);
      const H = Math.round(box.height);
      if (!W || !H) return;
      const next: SceneFit = { w: W, h: H, opts: {} };
      if (quietShare != null) {
        // The card's text (`[data-scene-text]` beside the backdrop): the picture grows into the room below it.
        const t = (el.parentElement?.parentElement ?? el).querySelector('[data-scene-text]');
        if (t && ro && !watched) {
          watched = true;
          ro.observe(t);
        }
        const r = t?.getBoundingClientRect();
        next.card = cardFit(
          W,
          H,
          quietShare,
          r && r.height > 0
            ? { right: Math.round(r.right - box.left), bottom: Math.round(r.bottom - box.top) }
            : undefined,
        );
      } else if (phone) next.opts = { phone: true, view: phoneView(W, H), quietX: G.phone.quietX };
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
    if (!ro) return;
    ro.observe(el);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [ref, phone, quietShare]);
  return fit;
}
