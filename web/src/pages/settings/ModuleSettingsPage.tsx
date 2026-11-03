import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router';
import { CopySchemaButton } from '@/core/dataapi/CopySchemaButton';
import { JSON_IMPORTER_ID } from '@/core/dataapi/importer';
import { hasStartData, importersOf } from '@/core/dataapi/onboarding';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { useModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import type { ModuleManifest } from '@/core/modules/types';
import { changedKeys, fieldBlocks } from '@/core/settings/moduleBlocks';
import { settingsPath } from '@/core/settings/registry/paths';
import { getSettings, useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { tSettings2 } from '@/strings.settings2';
import { Badge, EmptyState, Icon, SettingRow, SettingsGroup } from '@/ui';
import { FieldRow } from './ModuleSection';
import styles from './ModuleSettingsPage.module.css';
import settingsStyles from './settings.module.css';

/** Modules that have a settings page of their own: fields or start data, in the "Module" category (the vault sits under Sicherheit). */
const hasPage = (m: ModuleManifest) =>
  (m.settings.category ?? 'module') === 'module' &&
  (m.settings.fields.length > 0 || hasStartData(m));

/** How many settings of each module differ from their default (live), by module id. */
function useChangedCounts(
  manifests: readonly ModuleManifest[],
): Record<string, number> | undefined {
  const ids = manifests.map((m) => m.id).join(',');
  return useLiveQuery(async () => {
    const out: Record<string, number> = {};
    for (const m of manifests) {
      const v = await getSettings(`module.${m.id}`, m.settings.schema, m.settings.defaults);
      out[m.id] = changedKeys(
        m.settings.fields,
        v as Record<string, unknown>,
        m.settings.defaults,
      ).length;
    }
    return out;
  }, [ids]);
}

/** Module identity in the page head: chip in the module hue (grey in "Ruhig"), name, one line. */
function ModuleHead({ manifest, changed }: { manifest: ModuleManifest; changed?: number }) {
  const o = tSettings2.use().modulePage;
  return (
    <header
      id={`module-${manifest.id}`}
      className={styles.head}
      data-hue={manifest.identity.hue}
      data-testid="module-settings-head"
    >
      <span className={styles.chip} aria-hidden="true">
        <Icon name={manifest.icon} size={20} />
      </span>
      <div className={styles.headText}>
        <h2 className={styles.name}>{manifest.name}</h2>
        <p className={styles.desc}>{manifest.description}</p>
      </div>
      {changed ? <Badge>{o.changed(changed)}</Badge> : null}
      <Link to={`/library#module-${manifest.id}`} className={styles.libraryLink}>
        {o.library}
      </Link>
    </header>
  );
}

/** `/settings/module/<id>`: one module's settings in the same five blocks for every module. */
export function ModuleSettingsPage() {
  const { moduleId } = useParams();
  const states = useModuleStates();
  const o = tSettings2.use().modulePage;
  const manifest = availableManifests().find((m) => m.id === moduleId);
  if (!states) return null;
  if (!manifest || !states[manifest.id] || !hasPage(manifest)) {
    return (
      <EmptyState compact title={o.notFound}>
        <Link to={settingsPath('module')}>{o.all}</Link>
      </EmptyState>
    );
  }
  return <ModuleSettingsBody manifest={manifest} />;
}

function ModuleSettingsBody({ manifest }: { manifest: ModuleManifest }) {
  const o = tSettings2.use().modulePage;
  const { schema, defaults, fields } = manifest.settings;
  const [values, patch] = useSettings(`module.${manifest.id}`, schema, defaults);
  if (!values) return null;
  const v = values as Record<string, unknown>;
  const sectionId = `module-${manifest.id}`;
  const startData = hasStartData(manifest);
  const blocks = fieldBlocks(fields, startData);
  const changed = changedKeys(fields, v, defaults).length;
  const rows = (list: typeof fields) =>
    list.map((f) => (
      <FieldRow
        key={f.key}
        sectionId={sectionId}
        field={f}
        value={v[f.key]}
        onChange={(value) => void patch({ [f.key]: value })}
      />
    ));
  return (
    <div className={styles.page} data-testid={`module-settings-${manifest.id}`}>
      <ModuleHead manifest={manifest} changed={changed} />
      {blocks.map((b) => {
        const title = o.blocks[b.group];
        const body = (
          <>
            {rows(b.fields)}
            {b.group === 'data' && startData ? (
              <SettingRow
                id={`${sectionId}--startdata`}
                label={t.onboarding.rowLabel}
                description={t.onboarding.rowHint}
              >
                <span className={settingsStyles.row}>
                  {importersOf(manifest).some((i) => i.id === JSON_IMPORTER_ID) ? (
                    <CopySchemaButton manifest={manifest} />
                  ) : null}
                  <StartDataButton moduleId={manifest.id} setupLink={false} />
                </span>
              </SettingRow>
            ) : null}
          </>
        );
        return b.group === 'advanced' ? (
          <details key={b.group} className={styles.fold} data-testid="module-settings-advanced">
            <summary className={styles.foldSummary}>{title}</summary>
            <div className={styles.foldBody}>{body}</div>
          </details>
        ) : (
          <SettingsGroup key={b.group} id={`${sectionId}-${b.group}`} title={title}>
            {body}
          </SettingsGroup>
        );
      })}
    </div>
  );
}

/** The "Module" category's list: every module with settings, one line each, linking to its page. */
export function ModuleList() {
  const states = useModuleStates();
  const o = tSettings2.use().modulePage;
  const manifests = availableManifests().filter((m) => states?.[m.id] && hasPage(m));
  const counts = useChangedCounts(manifests);
  if (manifests.length === 0) return null;
  return (
    <section aria-labelledby="module-list" data-testid="module-list">
      <h2 id="module-list" className={styles.listTitle}>
        {o.listTitle}
      </h2>
      <p className={styles.listHint}>{o.listHint}</p>
      <ul className={styles.list}>
        {manifests.map((m) => (
          <li key={m.id}>
            <Link
              to={`/settings/module/${m.id}`}
              className={styles.listLink}
              data-hue={m.identity.hue}
              data-testid={`module-link-${m.id}`}
            >
              <span className={styles.chip} aria-hidden="true">
                <Icon name={m.icon} size={20} />
              </span>
              <span className={styles.headText}>
                <span className={styles.listName}>{m.name}</span>
                <span className={styles.listDesc}>
                  {counts?.[m.id] ? o.changed(counts[m.id]!) : o.default}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
