import { useId, useMemo, type CSSProperties } from 'react';
import type { SceneState } from '@/core/weather/scene';
import { portholeSvg } from './draw';
import styles from './ScenePorthole.module.css';

export interface ScenePortholeProps {
  /** The same state as the head (`core/weather/scene` `sceneOf`); its `motion` is ignored, the porthole never moves. */
  state: SceneState;
  /** 28 px in the overview line, 64 px in the widget ("Ruhig" / "Modulfarben: Aus"). */
  size: 28 | 64;
}

/**
 * The weather scene as a round crop (docs/design/weather-scenes@ca90c392f CONCEPT §8, mockup `porthole()`): decoration only
 * (`aria-hidden`, every thing it shows is a word beside it), no motion, "Schlicht" shows sky and body only, and
 * "Ruhig" / "Modulfarben: Aus" draw it in greys like the head.
 */
export function ScenePorthole({ state, size }: ScenePortholeProps) {
  const idPrefix = `pt${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const drawn = useMemo(() => portholeSvg(state, size, idPrefix), [state, size, idPrefix]);
  return (
    <span
      className={`${styles.porthole} ${state.calm ? styles.calm : ''}`}
      style={{ '--porthole': `${size}px` } as CSSProperties}
      data-testid="scene-porthole"
      data-size={size}
      aria-hidden="true"
    >
      <svg
        className={styles.svg}
        viewBox={drawn.viewBox}
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        data-phase={state.phase}
        data-cond={state.cond}
        data-ink={drawn.ink}
        data-level={state.level}
        style={drawn.vars as CSSProperties}
        // Generated from numbers and tokens only (draw.ts), never from data a person typed.
        dangerouslySetInnerHTML={{ __html: drawn.inner }}
      />
    </span>
  );
}
