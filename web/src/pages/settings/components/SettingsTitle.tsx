import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { AreaId, ModuleHue } from '@/core/modules/types';
import { HuePlate, Icon, type IconName } from '@/ui';
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
  /** A link at the end of the line under the title. */
  actions?: ReactNode;
  /** Phone: the way back takes the plate's place beside the title (44 px), so the page needs no back row of its own. */
  back?: { to: string; label: string };
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
  back,
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
        {back ? (
          <Link to={back.to} className={styles.back} aria-label={back.label}>
            <Icon name="chevronLeft" />
          </Link>
        ) : (
          <HuePlate hue={hue} icon={icon} />
        )}
        <div className={styles.block}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 id={titleId} className={styles.title}>
            {title}
          </h1>
        </div>
      </div>
      {description || actions ? (
        <div className={styles.below}>
          {description ? <p className={styles.description}>{description}</p> : null}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
