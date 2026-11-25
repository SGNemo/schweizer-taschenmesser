import { useId, useMemo, useRef, type CSSProperties } from 'react';
import type { SceneState } from '@/core/weather/scene';
import { G, sceneSvg } from './draw';
import { useSceneFit } from './useSceneFit';
import { useSceneMotion } from './useSceneMotion';
import styles from './WeatherScene.module.css';

export interface WeatherSceneProps {
  state: SceneState;
  /** The phone's head: the scene is drawn for the measured box (`bodyAt`, `extendTop`). */
  phone?: boolean;
  /** The old sky kind (`ui/identity/skyKind`), kept on the wrapper as `data-sky` until package 4 removes `Sky`. */
  legacyKind?: string;
}

/**
 * The weather scene behind the weather head: one SVG, one `<g data-layer>` per layer, `aria-hidden` (every thing it
 * shows is also a word on the page). The drawing is `draw.ts`; this component fits it to the stage, sets the ink
 * (`data-ink`), plays the five-second motion and draws "Ruhig" / "Modulfarben: Aus" in greys.
 */
export function WeatherScene({ state, phone = false, legacyKind }: WeatherSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const idPrefix = `sc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const bodyR = state.heat && state.body.kind === 'sun' ? 52 : 46;
  const fit = useSceneFit(ref, phone, bodyR);
  const allowed = state.motion && !state.calm && state.level === 'full';
  const { motion, paused, round } = useSceneMotion(ref, allowed);
  const drawn = useMemo(
    () => sceneSvg({ ...state, motion: allowed }, { ...fit.opts, idPrefix }),
    [state, allowed, fit.opts, idPrefix],
  );
  // The old head-height check finds the first span in `[data-sky]`: it is sized to the body's box.
  let bodyBox: CSSProperties = { width: 0, height: 0 };
  if (drawn.body && fit.w && fit.h) {
    const ext = fit.opts.extendTop ?? 0;
    const k = Math.max(fit.w / G.W, fit.h / (G.H + ext));
    const ox = fit.w - G.W * k;
    const oy = fit.h - (G.H + ext) * k;
    const r = drawn.body.r * k;
    bodyBox = {
      left: `${((ox + drawn.body.x * k - r) / fit.w) * 100}%`,
      top: `${((oy + (drawn.body.y + ext) * k - r) / fit.h) * 100}%`,
      width: `${((2 * r) / fit.w) * 100}%`,
      height: `${((2 * r) / fit.h) * 100}%`,
    };
  }
  return (
    <div
      ref={ref}
      className={`${styles.scene} ${state.calm ? styles.calm : ''}`}
      data-testid="sky"
      data-sky={legacyKind}
      aria-hidden="true"
    >
      <span className={styles.bodyBox} style={bodyBox} />
      <svg
        // A new round (back after a long absence) is a new element: its animations start again.
        key={round}
        className={styles.svg}
        viewBox={drawn.viewBox}
        preserveAspectRatio="xMaxYMax slice"
        aria-hidden="true"
        focusable="false"
        data-testid="weather-scene"
        data-phase={state.phase}
        data-cond={state.cond}
        data-ink={drawn.ink}
        data-level={state.level}
        data-motion={motion}
        data-paused={paused && motion === 'run' ? 'true' : undefined}
        style={drawn.vars as CSSProperties}
        // Generated from numbers and tokens only (draw.ts), never from data a person typed.
        dangerouslySetInnerHTML={{ __html: drawn.inner }}
      />
    </div>
  );
}
