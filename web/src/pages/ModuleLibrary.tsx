import { useState } from 'react';
import { markOnboardingHandled, wasOnboardingHandled } from '@/core/importer/batches';
import { hasImporters, OnboardingWizard } from '@/core/importer/OnboardingWizard';
import { disableModule, enableModule, useModuleStates } from '@/core/modules/activation';
import { visibleManifests } from '@/core/modules/registry';
import type { ModuleManifest } from '@/core/modules/types';
import { SetupLink } from '@/layout/setup/SetupLink';
import { t } from '@/strings';
import { Badge, Button, Card, Dialog, Icon } from '@/ui';
import styles from './Page.module.css';

export function ModuleLibrary() {
  const states = useModuleStates();
  const [pending, setPending] = useState<ModuleManifest | null>(null);
  const [offer, setOffer] = useState<ModuleManifest | null>(null);

  async function enable(m: ModuleManifest) {
    await enableModule(m);
    // Offer the start-data wizard once per device; "Überspringen" and every import count as handled.
    if (hasImporters(m) && !(await wasOnboardingHandled(m.id))) setOffer(m);
  }

  async function disable(policy: 'keep' | 'delete') {
    if (!pending) return;
    const m = pending;
    setPending(null);
    await disableModule(m, policy);
  }

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1>{t.library.title}</h1>
          <p className={styles.lead}>{t.library.intro}</p>
          <SetupLink />
        </div>
      </div>
      <ul className={`${styles.list} ${styles.grid}`}>
        {visibleManifests.map((m) => {
          const enabled = states?.[m.id] ?? false;
          return (
            <Card as="li" key={m.id} className={styles.moduleCard} data-testid={`module-${m.id}`}>
              <div className={styles.moduleHead}>
                <span className={styles.moduleIcon}>
                  <Icon name={m.icon} />
                </span>
                <span className={styles.moduleName}>{m.name}</span>
                {enabled ? <Badge tone="accent">{t.library.active}</Badge> : null}
                {m.devOnly ? <Badge>{t.library.devOnly}</Badge> : null}
              </div>
              <p className={styles.desc}>{m.description}</p>
              {enabled ? (
                <Button onClick={() => setPending(m)} disabled={!states}>
                  {t.actions.disable}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void enable(m)} disabled={!states}>
                  {t.actions.enable}
                </Button>
              )}
            </Card>
          );
        })}
      </ul>

      {offer ? (
        <OnboardingWizard
          manifest={offer}
          open
          onClose={() => {
            void markOnboardingHandled(offer.id);
            setOffer(null);
          }}
        />
      ) : null}

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? t.library.disableTitle(pending.name) : ''}
        footer={<Button onClick={() => setPending(null)}>{t.actions.cancel}</Button>}
      >
        <p>{t.library.disableText}</p>
        <div className={styles.options}>
          <div className={styles.option}>
            <Button variant="primary" onClick={() => void disable('keep')}>
              {t.library.keepData}
            </Button>
            <span className={styles.optionHint}>{t.library.keepDataHint}</span>
          </div>
          <div className={styles.option}>
            <Button variant="danger" onClick={() => void disable('delete')}>
              {t.library.deleteData}
            </Button>
            <span className={styles.optionHint}>{t.library.deleteDataHint}</span>
          </div>
        </div>
      </Dialog>
    </>
  );
}
