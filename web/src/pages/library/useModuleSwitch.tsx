import { useState, type ReactNode } from 'react';
import { markOnboardingHandled, wasOnboardingHandled } from '@/core/importer/batches';
import { hasImporters, OnboardingWizard } from '@/core/importer/OnboardingWizard';
import {
  disableModule,
  enableModule,
  isOnByDefaultSetOnly,
  moduleHasData,
  undoDisable,
} from '@/core/modules/activation';
import type { ModuleManifest } from '@/core/modules/types';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { Button, Dialog } from '@/ui';
import styles from '../Page.module.css';

/**
 * Switching a module on or off, shared by the library cards and the detail page: on offers the start-data
 * wizard once per device; off asks what to do with entries (keep / delete) and otherwise switches off with
 * "Rückgängig". `node` holds the wizard and the dialog; render it once next to the switches.
 */
export function useModuleSwitch(): {
  set: (m: ModuleManifest, on: boolean) => void;
  node: ReactNode;
} {
  const [pending, setPending] = useState<ModuleManifest | null>(null);
  const [offer, setOffer] = useState<ModuleManifest | null>(null);
  const toast = useUiStore((st) => st.toast);
  const text = tComfort.get().library;

  async function enable(m: ModuleManifest) {
    await enableModule(m);
    // Offer the start-data wizard once per device; "Überspringen" and every import count as handled.
    if (hasImporters(m) && !(await wasOnboardingHandled(m.id))) setOffer(m);
  }

  /**
   * The switch was turned off. A module with entries asks what to do with them; an empty one is simply
   * switched off, with "Rückgängig" in the toast.
   */
  async function switchOff(m: ModuleManifest) {
    if (await moduleHasData(m)) {
      setPending(m);
      return;
    }
    // Read before the switch: afterwards the module has a row and looks like any other choice.
    const viaDefaultSet = await isOnByDefaultSetOnly(m.id);
    await disableModule(m, 'keep');
    toast(text.turnedOff(m.name), {
      label: t.ui.undo,
      run: () => void undoDisable(m, viaDefaultSet),
    });
  }

  async function disable(policy: 'keep' | 'delete') {
    if (!pending) return;
    const m = pending;
    // Close the dialog only after the write: "the dialog has closed" must mean "the write is finished"
    // (E2E rule in docs/howto/gotchas.md), otherwise a reload right after can lose the change.
    await disableModule(m, policy);
    setPending(null);
  }

  const node = (
    <>
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

  return { set: (m, on) => void (on ? enable(m) : switchOff(m)), node };
}
