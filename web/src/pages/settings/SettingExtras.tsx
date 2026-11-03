import type { ReactNode } from 'react';
import type { FieldWarning } from '@/core/settings/warnings';
import type { SettingsScope } from '@/core/settings/registry/types';
import { tSettings2 } from '@/strings.settings2';
import { Icon } from '@/ui';
import styles from './SettingExtras.module.css';

/** One small line above a section: where its values live. Text only, no colour meaning. */
export function ScopeLabel({ scope }: { scope: SettingsScope }) {
  const o = tSettings2.use().scope;
  return (
    <p className={styles.scope} data-scope={scope} data-testid="scope-label">
      <Icon
        name={scope === 'synced' ? 'sync' : scope === 'local' ? 'monitor' : 'cloud'}
        size={14}
      />
      {o[scope]}
    </p>
  );
}

/** A calm note under a setting moved to its weaker side: informs, never blocks, never red. */
export function SecurityNote({ kind }: { kind: FieldWarning }) {
  const o = tSettings2.use().notes;
  return (
    <p role="note" className={styles.note} data-testid={`note-${kind}`}>
      <Icon name="lock" size={16} />
      {o[kind]}
    </p>
  );
}

/** Frame of a live preview: titled, clearly not a control, nothing in it is sent or saved. */
export function SettingPreview({ children, testId }: { children: ReactNode; testId?: string }) {
  const o = tSettings2.use().preview;
  return (
    <figure className={styles.preview} data-testid={testId} aria-label={o.title}>
      <figcaption className={styles.previewTitle}>{o.title}</figcaption>
      {children}
    </figure>
  );
}

/** Mini screen with a sample reminder where the in-app reminder will appear (top or bottom). */
export function ReminderPreview({ position }: { position: 'top' | 'bottom' }) {
  const o = tSettings2.use().preview.reminder;
  return (
    <SettingPreview testId="reminder-preview">
      <div className={styles.screen} data-position={position} aria-hidden="true">
        <div className={styles.sample}>
          <Icon name="bell" size={16} />
          <span className={styles.sampleText}>
            <strong>{o.title}</strong>
            <span>
              {o.body} · {o.when}
            </span>
          </span>
        </div>
      </div>
      <p className={styles.previewHint}>{o.hint}</p>
    </SettingPreview>
  );
}

/** The current look in a nutshell: card, text, link and button follow theme, density and text size. */
export function LookPreview() {
  const o = tSettings2.use().preview.look;
  return (
    <SettingPreview testId="look-preview">
      <div className={styles.lookCard}>
        <strong>{o.heading}</strong>
        <p>{o.body}</p>
        <span className={styles.lookRow}>
          <span className={styles.lookLink}>{o.link}</span>
          <span className={styles.lookButton}>{o.button}</span>
        </span>
      </div>
    </SettingPreview>
  );
}
