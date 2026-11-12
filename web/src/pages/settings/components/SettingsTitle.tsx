import type { ReactNode } from 'react';
import type { AreaId, ModuleHue } from '@/core/modules/types';
import { HuePlate, type IconName } from '@/ui';
import styles from './SettingsTitle.module.css';

export interface SettingsTitleProps {
  hue: ModuleHue;
  /** Kept as a hook (`data-area`); the title line draws no pattern. */
  area: AreaId;
  icon: IconName;
  /** Small caps line above the title ("Einstellungen", "Einstellungen · Module"). */
  eyebrow: ReactNode;
  title: string;
  /** Anchor id of the heading (deep links to a module's settings). */
  titleId?: string;
  /** One calm line under the title. */
  description?: string;
  /** A link or button at the end of the title row. */
  actions?: ReactNode;
  testId?: string;
}

/**
 * The head of a settings tab and of a module's settings (Identity 4.0, rule 2): one title line on the page – the
 * plate in the hue, the eyebrow, one h1 in the size of every module head, one line below it. No card, no tint, no
 * pattern; the hue lives in the plate alone. The start page keeps its status head (`StatusHead`).
 */
export function SettingsTitle({
  hue,
  area,
  icon,
  eyebrow,
  title,
  titleId,
  description,
  actions,
  testId,
}: SettingsTitleProps) {
  return (
    <header
      className={styles.head}
      data-hue={hue}
      data-area={area}
      data-size="title"
      data-testid={testId}
    >
      <div className={styles.row}>
        <HuePlate hue={hue} icon={icon} />
        <div className={styles.block}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 id={titleId} className={styles.title}>
            {title}
          </h1>
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {description ? <p className={styles.description}>{description}</p> : null}
    </header>
  );
}
