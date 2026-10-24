import { useEffect, useMemo, useState } from 'react';
import { markOnboardingHandled, wasOnboardingHandled } from '@/core/importer/batches';
import { hasImporters, OnboardingWizard } from '@/core/importer/OnboardingWizard';
import {
  disableModule,
  enableModule,
  moduleHasData,
  useModuleStates,
} from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { libraryBadges, markLibrarySeen } from '@/core/modules/librarySeen';
import { normalize } from '@/core/text/normalize';
import { hasStartData } from '@/core/dataapi/onboarding';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { AREAS, type AreaId, type ModuleManifest } from '@/core/modules/types';
import { SetupLink } from '@/layout/setup/SetupLink';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { useUiStore } from '@/stores/ui';
import { Badge, Button, Dialog, LibraryCard, Switch, TextField, useHashTarget } from '@/ui';
import styles from './Page.module.css';

interface LibraryGroup {
  id: string;
  area: AreaId | undefined;
  label: string;
  manifests: ModuleManifest[];
}

/** The available modules grouped by navigation area (same order and names as the sidebar); modules without an area come last. */
/** What a search matches: name, description and the settings words of the module. */
const haystack = (m: ModuleManifest) =>
  normalize([m.name, m.description, ...(m.settings.keywords ?? [])].join(' '));

function libraryGroups(query: string): LibraryGroup[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const all = availableManifests().filter((m) => {
    const text = haystack(m);
    return tokens.every((tok) => text.includes(tok));
  });
  const groups: LibraryGroup[] = AREAS.map((id) => ({
    id,
    area: id,
    label: t.nav.areas[id],
    manifests: all.filter((m) => m.area === id),
  }));
  groups.push({
    id: 'other',
    area: undefined,
    label: t.library.other,
    manifests: all.filter((m) => !m.area),
  });
  return groups.filter((g) => g.manifests.length > 0);
}

export function ModuleLibrary() {
  const states = useModuleStates();
  const [pending, setPending] = useState<ModuleManifest | null>(null);
  const [offer, setOffer] = useState<ModuleManifest | null>(null);
  const [query, setQuery] = useState('');
  const toast = useUiStore((st) => st.toast);
  const text = tComfort.get().library;
  // The marks shown now; the library counts as looked at when it is left.
  const badges = useMemo(() => libraryBadges(availableManifests()), []);
  useEffect(() => () => markLibrarySeen(availableManifests()), []);
  // `/library#module-<id>` (from the palette or a link) scrolls to that card and marks it.
  useHashTarget(states !== undefined);

  const groups = libraryGroups(query);

  async function enable(m: ModuleManifest) {
    await enableModule(m);
    // Offer the start-data wizard once per device; "Überspringen" and every import count as handled.
    if (hasImporters(m) && !(await wasOnboardingHandled(m.id))) setOffer(m);
  }

  /**
   * The switch was turned off. A module with entries asks what to do with them (as before); an empty
   * one is simply switched off, with "Rückgängig" in the toast.
   */
  async function switchOff(m: ModuleManifest) {
    if (await moduleHasData(m)) {
      setPending(m);
      return;
    }
    await disableModule(m, 'keep');
    toast(text.turnedOff(m.name), { label: t.ui.undo, run: () => void enableModule(m) });
  }

  async function disable(policy: 'keep' | 'delete') {
    if (!pending) return;
    const m = pending;
    // Close the dialog only after the write: "the dialog has closed" must mean "the write is
    // finished" (E2E rule in docs/howto/gotchas.md), otherwise a reload right after can lose the change.
    await disableModule(m, policy);
    setPending(null);
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
      <div role="search" className={styles.librarySearch}>
        <TextField
          label={text.search}
          labelHidden
          type="search"
          placeholder={text.searchPlaceholder}
          value={query}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {groups.length === 0 ? (
        <p role="status" className={styles.lead}>
          {text.noResults}
        </p>
      ) : null}
      {groups.map((g) => (
        <section key={g.id} className={styles.libGroup} data-area={g.area}>
          <h2 className={styles.libHead}>
            <span className={styles.libStripe} aria-hidden="true" />
            {g.label}
            <span className={styles.libCount}>{g.manifests.length}</span>
          </h2>
          <ul className={`${styles.list} ${styles.grid}`}>
            {g.manifests.map((m) => {
              const enabled = states?.[m.id] ?? false;
              return (
                <LibraryCard
                  key={m.id}
                  id={`module-${m.id}`}
                  testId={`module-${m.id}`}
                  icon={m.icon}
                  name={m.name}
                  description={m.description}
                  badges={
                    <>
                      {enabled ? <Badge tone="accent">{t.library.active}</Badge> : null}
                      {badges[m.id] ? (
                        <Badge>{badges[m.id] === 'new' ? text.badgeNew : text.badgeUpdated}</Badge>
                      ) : null}
                      {m.devOnly ? <Badge>{t.library.devOnly}</Badge> : null}
                    </>
                  }
                >
                  {enabled && hasStartData(m) ? <StartDataButton moduleId={m.id} setupLink={false} /> : null}
                  <Switch
                    label={text.toggle(m.name)}
                    checked={enabled}
                    disabled={!states}
                    onChange={(on) => void (on ? enable(m) : switchOff(m))}
                  />
                </LibraryCard>
              );
            })}
          </ul>
        </section>
      ))}

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
