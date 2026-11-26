import { useId, useMemo, useRef, type CSSProperties } from 'react';
import type { SceneState } from '@/core/weather/scene';
import { sceneSvg } from './draw';
import { useSceneFit } from './useSceneFit';
import { useSceneMotion } from './useSceneMotion';
import styles from './WeatherScene.module.css';

export interface WeatherSceneProps {
  state: SceneState;
  /** The phone's head: the picture's right part at scale 0.46 (never zoomed out past the whole width; CONCEPT §5). */
  phone?: boolean;
  /** A card behind its text (the overview widget): the quiet zone ends at this share of the box's width. */
  quietShare?: number;
}

/**
 * The weather scene behind the weather head: one SVG, one `<g data-layer>` per layer, `aria-hidden` (every thing it
 * shows is also a word on the page). The drawing is `draw.ts`; this component fits it to the stage, sets the ink
 * (`data-ink`), plays the five-second motion and draws "Ruhig" / "Modulfarben: Aus" in greys.
 */
export function WeatherScene({ state, phone = false, quietShare }: WeatherSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const idPrefix = `sc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const fit = useSceneFit(ref, phone, quietShare);
  const allowed = state.motion && !state.calm && state.level === 'full';
  const { motion, paused, round } = useSceneMotion(ref, allowed);
  const drawn = useMemo(
    () =>
      sceneSvg(
        { ...state, motion: allowed },
        fit.card ? { ...fit.card, idPrefix } : { ...fit.opts, phone, idPrefix },
      ),
    [state, allowed, fit, idPrefix, phone],
  );
  return (
    <div
      ref={ref}
      className={`${styles.scene} ${state.calm ? styles.calm : ''}`}
      data-testid="sky"
      aria-hidden="true"
    >
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
        data-mode={state.mode || undefined}
        data-motion={motion}
        data-paused={paused && motion === 'run' ? 'true' : undefined}
        style={drawn.vars as CSSProperties}
        // Generated from numbers and tokens only (draw.ts), never from data a person typed.
        dangerouslySetInnerHTML={{ __html: drawn.inner }}
      />
    </div>
  );
}
