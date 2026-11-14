import { useSetupHost } from '@/core/setup/host';
import { useSetupState } from '@/core/setup/hooks';
import { dismissSetup } from '@/core/setup/state';
import { enableModule, loadModuleStates } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Suspense } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card } from '@/ui';
import { TestDataOffer } from '../devTools';
import styles from './WelcomeCard.module.css';

/**
 * „Tage einteilen“ (use case „Wochenende retten“, TARGET F1): switches on the planner and what it needs
 * (`requires`: the ToDos) – only on this tap, never anything off –, ends the offer like „Später“ (the setup stays
 * in the settings and the checklist; nothing but the status is stored), keeps the „Planen“ group of the sidebar
 * open (W03) and opens the planner with its three-step sheet.
 */
async function planDays(go: (to: string) => void): Promise<void> {
  const planner = getManifest('planner');
  if (planner) {
    const states = await loadModuleStates();
    for (const id of [...(planner.requires ?? []), planner.id]) {
      const m = getManifest(id);
      if (m && !states[id]) await enableModule(m);
    }
    if (planner.area) useUiStore.getState().toggleAreaOpen(planner.area, false);
  }
  await dismissSetup();
  go('/planner?start=1');
}

/**
 * Discreet offer on the dashboard, only for a really empty app (`notStarted`; the start migration
 * marks every installation with data `dismissed`). "Später" ends the offer for good. One question
 * only (round 5, demo-a/demo-c): the reading aid is offered in the assistant's step "Fokus-Hilfen".
 * „Einrichtung starten“ stays the one primary button; „Tage einteilen“ beside it is secondary.
 */
export function WelcomeCard() {
  const state = useSetupState();
  const open = useSetupHost((s) => s.openWizard);
  const navigate = useNavigate();
  if (state?.status !== 'notStarted') return null;
  return (
    <div data-testid="setup-welcome" className={styles.card}>
      <Card>
        <h2>{t.setup.welcomeTitle}</h2>
        <p className={styles.text}>{t.setup.welcomeText}</p>
        <div className={styles.buttons}>
          <Button variant="primary" onClick={() => open()}>
            {t.setup.start}
          </Button>
          {getManifest('planner') ? (
            <Button onClick={() => void planDays((to) => void navigate(to))}>
              {t.setup.welcomePlanDays}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => void dismissSetup()}>
            {t.setup.welcomeLater}
          </Button>
        </div>
        {TestDataOffer ? (
          <Suspense fallback={null}>
            <TestDataOffer />
          </Suspense>
        ) : null}
      </Card>
    </div>
  );
}
