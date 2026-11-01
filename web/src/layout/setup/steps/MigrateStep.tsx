import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useOnboardingHost } from '@/core/importer/host';
import { enableModule, useModuleStates } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { useSetupHost } from '@/core/setup/host';
import {
  chooseOrigin,
  hasMigrateChoice,
  migrateOutcome,
  ORIGINS,
  setManualDone,
  useMigrateOverview,
  type MigrateItemStatus,
  type Origin,
} from '@/core/setup/migrate';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { Badge, Button, patternStyles } from '@/ui';

const s = t.setup.steps.migrate;

/** Importer buttons per origin: label key and the module whose existing importer opens. */
const TARGETS: Record<Origin, { action: string; moduleId: string }[]> = {
  google: [
    { action: 'calendar', moduleId: 'calendar' },
    { action: 'tasks', moduleId: 'todos' },
    { action: 'notes', moduleId: 'notes' },
  ],
  todoist: [{ action: 'tasks', moduleId: 'todos' }],
  obsidian: [{ action: 'notes', moduleId: 'notes' }],
  bank: [{ action: 'bank', moduleId: 'finance' }],
  bitwarden: [{ action: 'vault', moduleId: 'accounts' }],
  paper: [],
};

export function MigrateItemLine({ item }: { item: MigrateItemStatus }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-2)',
        minHeight: 44,
      }}
    >
      <span data-testid={`migrate-item-${item.id}`}>
        {item.done ? '✓ ' : ''}
        {s.items[item.id]}
      </span>
      {item.manual ? (
        <Button size="sm" variant="ghost" onClick={() => void setManualDone(item.id, !item.done)}>
          {item.done ? s.untick : s.tick}
        </Button>
      ) : null}
    </li>
  );
}

/**
 * The tiles. A tile opens the existing importer of the target module (switching the module on
 * first, like the start-data list does) and remembers only the origin id. Used by the assistant
 * step and by the dialog in Settings → Sync & Backup.
 */
export function MigratePicker({ onLeave }: { onLeave?: () => void }) {
  const overview = useMigrateOverview();
  const states = useModuleStates();
  const openImporter = useOnboardingHost((h) => h.open);
  const closeSetup = useSetupHost((h) => h.close);
  const navigate = useNavigate();

  async function start(origin: Origin, moduleId: string) {
    await chooseOrigin(origin);
    const manifest = getManifest(moduleId);
    if (!manifest) return;
    if (!states?.[moduleId]) await enableModule(manifest);
    if (origin === 'bitwarden') {
      // The vault import lives behind the master password in the vault itself.
      closeSetup();
      onLeave?.();
      void navigate('/accounts?tools=1');
      return;
    }
    openImporter(moduleId);
  }

  if (!overview || !states) return null;
  const chosen = new Set(Object.keys(overview.state.origins));
  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <p className={patternStyles.muted}>{s.optional}</p>
      {ORIGINS.map((origin) => {
        const info = s.origins[origin]!;
        const items = overview.items.filter((i) => i.origin === origin);
        const picked = chosen.has(origin);
        return (
          <section
            key={origin}
            aria-label={info.title}
            data-testid={`migrate-${origin}`}
            style={{
              display: 'grid',
              gap: 'var(--space-2)',
              padding: 'var(--space-3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <strong>
              {info.title} {picked ? <Badge>{s.chosen}</Badge> : null}
            </strong>
            <span className={patternStyles.muted}>{info.how}</span>
            <div className={patternStyles.hstackWrap}>
              {TARGETS[origin].map((tg) => (
                <Button key={tg.action} onClick={() => void start(origin, tg.moduleId)}>
                  {s.actions[tg.action]}
                </Button>
              ))}
              {origin === 'paper' && !picked ? (
                <Button variant="ghost" onClick={() => void chooseOrigin('paper')}>
                  {info.title}
                </Button>
              ) : null}
            </div>
            {items.length > 0 ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label={s.subLabel}>
                {items.map((i) => (
                  <MigrateItemLine key={i.id} item={i} />
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/** Assistant step "Umzug von einer anderen App": skippable, nothing is counted without an import. */
export default function MigrateStep({ registerCommit }: SetupStepProps) {
  const overview = useMigrateOverview();
  useEffect(() => {
    if (!overview || !hasMigrateChoice(overview.state)) return registerCommit(null);
    // Chosen origin + a finished import (or "Papier") = done; otherwise "Später".
    registerCommit(async () =>
      migrateOutcome(overview.state, overview.items) === 'done' ? undefined : 'skipped',
    );
    return () => registerCommit(null);
  }, [overview, registerCommit]);
  return <MigratePicker />;
}
