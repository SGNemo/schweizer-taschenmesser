import { useEffect, useRef } from 'react';
import { FILE_KINDS, type FileKind } from '@/core/platform/disk';
import { t } from '@/strings';
import { AGE_VAR } from '../logic/age';
import { KIND_PATTERN, KIND_VAR, drawPattern, type PatternId } from '../logic/colors';
import type { ColorMode } from './TreemapView';
import { useThemeKey } from './useThemeKey';
import styles from './Legend.module.css';

/** A legend swatch: the colour of `cssVar` plus the same hatch pattern the map uses. */
function ColorSwatch({ cssVar, pattern }: { cssVar: string; pattern: PatternId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const themeKey = useThemeKey();
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const color = getComputedStyle(c).getPropertyValue(cssVar).trim() || '#7a7f87';
    const dpr = window.devicePixelRatio || 1;
    c.width = 24 * dpr;
    c.height = 16 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 24, 16);
    drawPattern(ctx, pattern, 0, 0, 24, 16, 'rgba(255,255,255,0.35)');
  }, [cssVar, pattern, themeKey]);
  return <canvas ref={ref} className={styles.swatch} width={24} height={16} aria-hidden="true" />;
}

/** One file type: colour plus hatch pattern. */
export const Swatch = ({ kind }: { kind: FileKind }) => (
  <ColorSwatch cssVar={KIND_VAR[kind]} pattern={KIND_PATTERN[kind]} />
);

/** One age bucket (`AGE_LIMITS_DAYS`). */
export const AgeSwatch = ({ index }: { index: number }) => (
  <ColorSwatch cssVar={AGE_VAR[index]!} pattern="none" />
);

export function Legend({ colorBy }: { colorBy: ColorMode }) {
  return (
    <div className={styles.legend} aria-label={t.disk.map.legend} role="group">
      {colorBy === 'type' ? (
        <ul className={styles.list}>
          {FILE_KINDS.map((k) => (
            <li key={k} className={styles.item}>
              <Swatch kind={k} />
              {t.disk.map.kind[k]}
            </li>
          ))}
        </ul>
      ) : colorBy === 'age' ? (
        <>
          <ul className={styles.list}>
            {t.disk.age.buckets.map((label, i) => (
              <li key={label} className={styles.item}>
                <AgeSwatch index={i} />
                {label}
              </li>
            ))}
          </ul>
          <p className={styles.text}>{t.disk.map.ageLegend}</p>
        </>
      ) : (
        <p className={styles.text}>{t.disk.map.depthLegend}</p>
      )}
    </div>
  );
}
