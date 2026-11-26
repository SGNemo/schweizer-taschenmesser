import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motionReduced } from '@/core/shell/topbarCollapse';
import type { SceneState } from '@/core/weather/scene';
import { sceneSvg } from './draw';
import { sceneSvg as cardSvg } from './drawV1';
import { useSceneFit } from './useSceneFit';
import { useSceneMotion } from './useSceneMotion';
import styles from './WeatherScene.module.css';

export interface WeatherSceneProps {
  state: SceneState;
  /** The phone's head: the picture's right part at scale 0.46 (never zoomed out past the whole width; CONCEPT §5). */
  phone?: boolean;
  /**
   * A card behind its text (the overview widget): the quiet zone ends at this share of the box's width. Until package
   * D of round 2 the card keeps round 1's drawing.
   */
  quietShare?: number;
  /**
   * The moment the picture shows (round 2, CONCEPT-DAYS §3): when it changes, the old picture fades out over the new
   * one in 200 ms (opacity only) – never with less motion asked for, "Standbild", "Schlicht" or "Ruhig" (`fade` false).
   */
  fadeKey?: string;
  fade?: boolean;
}

type Drawn = Pick<ReturnType<typeof sceneSvg>, 'viewBox' | 'vars' | 'inner'>;

/**
 * The weather scene behind the weather head: one SVG, one `<g data-layer>` per layer, `aria-hidden` (every thing it
 * shows is also a word on the page). The drawing is `draw.ts`; this component fits it to the stage, sets the ink
 * (`data-ink`), plays the five-second motion and draws "Ruhig" / "Modulfarben: Aus" in greys.
 */
export function WeatherScene({
  state,
  phone = false,
  quietShare,
  fadeKey,
  fade = false,
}: WeatherSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const baseId = `sc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Each new moment draws with the other of two id prefixes, so the fading old picture keeps its own gradients.
  const [seen, setSeen] = useState({ key: fadeKey, n: 0 });
  if (seen.key !== fadeKey) setSeen({ key: fadeKey, n: seen.n + 1 });
  const idPrefix = `${baseId}${seen.n % 2 ? 'b' : 'a'}`;
  const fit = useSceneFit(ref, phone, quietShare);
  const allowed = state.motion && !state.calm && state.level === 'full';
  const { motion, paused, round } = useSceneMotion(ref, allowed);
  const isCard = quietShare != null;
  const drawn = useMemo(
    () =>
      isCard
        ? cardSvg({ ...state, motion: allowed }, { ...fit.card, idPrefix })
        : sceneSvg({ ...state, motion: allowed }, { ...fit.opts, phone, idPrefix }),
    [state, allowed, fit, idPrefix, isCard, phone],
  );
  const [ghost, setGhost] = useState<{ drawn: Drawn; n: number } | null>(null);
  const last = useRef<{ key?: string; drawn: Drawn } | null>(null);
  useLayoutEffect(() => {
    const prev = last.current;
    last.current = { key: fadeKey, drawn };
    if (!prev || prev.key === fadeKey) return;
    const on = fade && !state.calm && state.level === 'full' && !motionReduced() && !isCard;
    setGhost(on ? { drawn: prev.drawn, n: seen.n } : null);
  }, [fadeKey, drawn, fade, state.calm, state.level, isCard, seen.n]);
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
      {ghost ? (
        <svg
          key={`fade${ghost.n}`}
          className={`${styles.svg} ${styles.fadeOut}`}
          viewBox={ghost.drawn.viewBox}
          preserveAspectRatio="xMaxYMax slice"
          aria-hidden="true"
          focusable="false"
          data-testid="weather-scene-fade"
          style={ghost.drawn.vars as CSSProperties}
          onAnimationEnd={() => setGhost(null)}
          // The previous picture, drawn by draw.ts from numbers and tokens only.
          dangerouslySetInnerHTML={{ __html: ghost.drawn.inner }}
        />
      ) : null}
    </div>
  );
}
