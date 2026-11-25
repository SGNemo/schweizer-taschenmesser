import { useEffect, useState, type RefObject } from 'react';
import { G, type SceneOptions } from './draw';

/** Phone head (mockups/head.js `PHONE`): scene scale at most, body centre as a share of the width, text zone. */
const PHONE = { k: 0.6, bodyX: 0.83, quietPx: 300, crest: 140 } as const;
/** Width of the text column on a wide stage, rem. */
const TEXT_REM = 36;

export interface SceneFit {
  /** The box the scene fills, px (0 before the first measurement). */
  w: number;
  h: number;
  opts: SceneOptions;
}

const same = (a: SceneFit, b: SceneFit): boolean =>
  a.w === b.w &&
  a.h === b.h &&
  a.opts.quietX === b.opts.quietX &&
  a.opts.extendTop === b.opts.extendTop &&
  a.opts.bodyAt?.[0] === b.opts.bodyAt?.[0] &&
  a.opts.bodyAt?.[1] === b.opts.bodyAt?.[1];

/**
 * Fits the scene to its stage (handoff 01b "Head layout"): on a wide stage narrower than 1600 scene units the quiet
 * zone ends at the right edge of the text (`[data-scene-text]`); on the phone the scene is drawn for the measured box
 * with more sky above and the body between the rows and the first pill or chip (`[data-scene-avoid]`).
 */
export function useSceneFit(
  ref: RefObject<HTMLElement | null>,
  phone: boolean,
  bodyR: number,
): SceneFit {
  const [fit, setFit] = useState<SceneFit>({ w: 0, h: 0, opts: {} });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stage =
      (el.closest('[data-head="stage"]') as HTMLElement | null) ?? el.parentElement ?? el;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const W = Math.round(box.width);
      const H = Math.round(box.height);
      if (!W || !H) return;
      const opts: SceneOptions = {};
      if (phone) {
        const rows =
          stage.querySelector('nav[data-module-row]') ??
          stage.querySelector('[data-testid="module-title-row"]');
        const rowsBottom = rows ? rows.getBoundingClientRect().bottom - box.top : 88;
        const first = stage.querySelector('[data-scene-avoid]');
        const below = first ? first.getBoundingClientRect().top - box.top : H - 40;
        const yc = (rowsBottom + below) / 2;
        const k = Math.min(PHONE.k, (H - yc - 6) / (G.H - PHONE.crest + bodyR));
        const ext = H / k - G.H;
        opts.extendTop = Math.round(ext);
        opts.quietX = Math.round(G.W - W / k + PHONE.quietPx / k);
        opts.bodyAt = [Math.round(G.W - (W * (1 - PHONE.bodyX)) / k), Math.round(-ext + yc / k)];
      } else {
        const scale = Math.max(W / G.W, H / G.H);
        const units = W / scale;
        if (units < G.W) {
          // The text column is at most 36 rem wide (the rest line's cap, A11Y §1 rule 1).
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
          let right = 0;
          stage.querySelectorAll('[data-scene-text]').forEach((t) => {
            const r = t.getBoundingClientRect();
            right = Math.max(right, r.left - box.left + Math.min(r.width, TEXT_REM * rem));
          });
          if (right > 0) opts.quietX = Math.round(G.W - units + right / scale);
        }
      }
      const next = { w: W, h: H, opts };
      setFit((prev) => (same(prev, next) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [ref, phone, bodyR]);
  return fit;
}
