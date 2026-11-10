import type { CSSProperties, ReactNode, Ref } from 'react';
import type {
  AreaId,
  CardShape,
  HeadVariant,
  ModuleHue,
  SignatureId,
  SlotSize,
  TypeAccent,
} from '@/core/modules/types';
import { Icon, type IconName } from './icons';
import styles from './HeadSurface.module.css';

export interface HeadSurfaceProps {
  /** `div` for the shell's band, `header` for a head inside a page, `section` for a tool stage. */
  as?: 'div' | 'header' | 'section';
  hue?: ModuleHue;
  /** Second hue of the gradient (`[data-hue2]` in tokens.css, no inline style). */
  hue2?: ModuleHue;
  /** Drives the quiet pattern (`[data-area]`; `system` = none). */
  area?: AreaId;
  /** Height class (`headHeight`): `hero` = `--head-h-tall`, `compact` = `--head-h-compact` (as `--head-h` inside). */
  size?: 'hero' | 'compact';
  head?: HeadVariant;
  shape?: CardShape;
  type?: TypeAccent;
  signature?: SignatureId;
  /** Size of the signature slot the children lay out (`data-slot`). */
  slot?: SlotSize | 'none';
  /** The shell's band: bleeds through the page gutters, corners only at the bottom. Otherwise a rounded card. */
  bleed?: boolean;
  /** Full-bleed layer behind the content (the sky); the frame hands out the element as a `HeroSlot` target. */
  backdropRef?: Ref<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
  testId?: string;
  'aria-label'?: string;
  tabIndex?: number;
  /** Extra `data-*` hooks of the caller (e.g. `data-tool` on a tool stage). */
  data?: Record<`data-${string}`, string | undefined>;
  children: ReactNode;
}

/**
 * The tinted surface of a stage and of the heads outside the module frame: hue gradient over the surface, the area's
 * quiet pattern, the identity hooks as data attributes and the head height as `--head-h`. The stage of a module
 * head (`layout/AreaFrame`, Identity 4.0: weather and music), the settings head (`pages/settings/PageHead`) and the
 * tool stage (`layout/tools/ToolStage`) put their own grid inside; text on it is `--text` or `--text-on-tint` only
 * (tokens.test.ts). A standard module head does not use it: it is a plain title row without tint or pattern.
 */
export function HeadSurface({
  as: Tag = 'div',
  hue,
  hue2,
  area,
  size = 'hero',
  head,
  shape,
  type,
  signature,
  slot,
  bleed = false,
  backdropRef,
  className,
  style,
  testId,
  'aria-label': ariaLabel,
  tabIndex,
  data,
  children,
}: HeadSurfaceProps) {
  return (
    <Tag
      className={[styles.surface, bleed ? styles.bleed : styles.card, className]
        .filter(Boolean)
        .join(' ')}
      data-hue={hue}
      data-hue2={hue2}
      data-area={area}
      data-size={size}
      data-head={head}
      data-shape={shape}
      data-type={type}
      data-signature={signature}
      data-slot={slot}
      data-testid={testId}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      style={style}
      {...data}
    >
      <div className={styles.pattern} aria-hidden="true" />
      {backdropRef ? (
        <div className={styles.backdrop} ref={backdropRef} aria-hidden="true" />
      ) : null}
      {children}
    </Tag>
  );
}

/** The small caps line of a head: the icon plate (the hue's one solid spot) and the area · module words. */
export function HeadEyebrow({
  icon,
  className,
  children,
}: {
  icon?: IconName;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p className={[styles.eyebrow, className].filter(Boolean).join(' ')}>
      {icon ? (
        <span className={styles.plate} aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
      ) : null}
      <span className={styles.eyebrowText}>{children}</span>
    </p>
  );
}
