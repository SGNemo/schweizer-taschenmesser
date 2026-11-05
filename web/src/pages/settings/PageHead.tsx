import type { ReactNode } from 'react';
import type { AreaId, ModuleHue } from '@/core/modules/types';
import { HeadEyebrow, HeadSurface, type IconName } from '@/ui';
import styles from './PageHead.module.css';

export interface PageHeadProps {
  hue: ModuleHue;
  /** Second colour of the head (module identity `hue2`). */
  hue2?: ModuleHue;
  /** Drives the quiet pattern (`data-area`; `system` = none). */
  area: AreaId;
  icon: IconName;
  /** Small caps line next to the plate ("Einstellungen · Module"). */
  eyebrow: ReactNode;
  title: string;
  /** Anchor id of the heading (deep links to a module's settings). */
  titleId?: string;
  description?: string;
  /** `tall` carries figures/tiles (children), `compact` is a category or module page. */
  size?: 'tall' | 'compact';
  /** Buttons and links at the right of the eyebrow row. */
  actions?: ReactNode;
  /** Decoration at the right (a signature in small); hidden from assistive tech. */
  decoration?: ReactNode;
  /** Tiles or figures under the title. */
  children?: ReactNode;
  testId?: string;
}

/**
 * The head of a page that is not a module page (settings, libraries): the same surface as the module head band
 * of `layout/AreaFrame` (`ui/HeadSurface`: tinted surface in the hue, the area's pattern, the hue as the icon
 * plate, text always `--text`), as a rounded card inside the page, so nothing bleeds past the page container.
 * The decoration (a signature at size S) stays on the phone, smaller. No edge stripe.
 */
export function PageHead({
  hue,
  hue2,
  area,
  icon,
  eyebrow,
  title,
  titleId,
  description,
  size = 'compact',
  actions,
  decoration,
  children,
  testId,
}: PageHeadProps) {
  return (
    <HeadSurface
      as="header"
      className={styles.head}
      hue={hue}
      hue2={hue2}
      area={area}
      size={size === 'tall' ? 'hero' : 'compact'}
      testId={testId}
    >
      <HeadEyebrow icon={icon} className={styles.eyebrow}>
        {eyebrow}
      </HeadEyebrow>
      <div className={styles.titles}>
        <h1 id={titleId} className={styles.title}>
          {title}
        </h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {decoration ? (
        <div className={styles.decoration} aria-hidden="true">
          {decoration}
        </div>
      ) : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
      {children ? <div className={styles.body}>{children}</div> : null}
    </HeadSurface>
  );
}
