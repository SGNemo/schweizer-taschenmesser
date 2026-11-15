import { Fragment } from 'react';
import { getPlatform } from '@/core/platform';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Icon } from '@/ui';
import { passportText, type Fact } from '../system';
import styles from './Facts.module.css';

/** The hardware passport: facts as a list and one button that copies them as plain text (no secret, so a plain copy). */
export function PassportSection({ facts }: { facts: Fact[] }) {
  const p = t.device.passport;
  const copy = () =>
    void getPlatform()
      .clipboard.writeText(passportText(p.textTitle, facts))
      .then(() => useUiStore.getState().toast(p.copied))
      .catch(() => undefined);
  return (
    <section
      className={styles.section}
      aria-labelledby="device-passport"
      data-testid="device-passport"
    >
      <div className={styles.head}>
        <h2 id="device-passport">{p.title}</h2>
        <Button variant="secondary" onClick={copy} data-testid="device-passport-copy">
          <Icon name="copy" size={16} />
          {p.copy}
        </Button>
      </div>
      <dl className={styles.facts}>
        {facts.map((f) => (
          <Fragment key={f.id}>
            {/* A fact without a label (second graphics card, second screen) is another value of the term above. */}
            {f.label ? <dt>{f.label}</dt> : null}
            <dd>{f.value}</dd>
          </Fragment>
        ))}
      </dl>
      <p className={styles.muted}>{p.hint}</p>
    </section>
  );
}
