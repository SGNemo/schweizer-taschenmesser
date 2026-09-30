import { useEffect, useRef } from 'react';
import { FILE_KINDS, type FileKind } from '@/core/platform/disk';
import { t } from '@/strings';
import { KIND_PATTERN, KIND_VAR, drawPattern } from '../logic/colors';
import type { ColorMode } from './TreemapView';
import { useThemeKey } from './useThemeKey';
import styles from './Legend.module.css';

/** One legend swatch: the type colour plus the same hatch pattern the map uses. */
export function Swatch({ kind }: { kind: FileKind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const themeKey = useThemeKey();
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const color = getComputedStyle(c).getPropertyValue(KIND_VAR[kind]).trim() || '#7a7f87';
    const dpr = window.devicePixelRatio || 1;
    c.width = 24 * dpr;
    c.height = 16 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 24, 16);
    drawPattern(ctx, KIND_PATTERN[kind], 0, 0, 24, 16, 'rgba(255,255,255,0.35)');
  }, [kind, themeKey]);
  return <canvas ref={ref} className={styles.swatch} width={24} height={16} aria-hidden="true" />;
}

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
      ) : (
        <p className={styles.text}>{t.disk.map.depthLegend}</p>
      )}
    </div>
  );
}
