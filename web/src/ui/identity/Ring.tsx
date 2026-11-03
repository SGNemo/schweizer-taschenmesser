import type { ReactNode } from 'react';
import styles from './Ring.module.css';

export interface RingPart {
  label: string;
  /** Share of the whole, 0..1 (the parts do not have to add up to 1). */
  share: number;
}

/**
 * Ring of shares (categories, progress). Each segment steps from the module hue towards the surface, so the ring
 * needs no extra colours; the legend beside it carries the meaning (never colour alone). Centre = a short label.
 */
export function Ring({
  parts,
  centre,
  label,
  size = 8.75,
}: {
  parts: readonly RingPart[];
  centre?: ReactNode;
  /** Accessible summary ("5 Kategorien"). */
  label: string;
  size?: number;
}) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.share), 0) || 1;
  const stops: string[] = [];
  let at = 0;
  parts.forEach((p, i) => {
    const mixPct = Math.max(18, 100 - i * 22);
    const next = at + (Math.max(0, p.share) / total) * 100;
    stops.push(
      `color-mix(in srgb, var(--module-color) ${mixPct}%, var(--surface)) ${at}% ${next}%`,
    );
    at = next;
  });
  return (
    <div
      className={styles.ring}
      role="img"
      aria-label={label}
      style={{
        width: `${size}rem`,
        background: `conic-gradient(${stops.join(', ')}${at < 100 ? `, var(--surface-2) ${at}% 100%` : ''})`,
      }}
      data-testid="ring"
    >
      <span className={styles.hole}>{centre}</span>
    </div>
  );
}

/** Colour (as CSS) of the i-th segment, for legends. */
export function ringColor(i: number): string {
  return `color-mix(in srgb, var(--module-color) ${Math.max(18, 100 - i * 22)}%, var(--surface))`;
}
