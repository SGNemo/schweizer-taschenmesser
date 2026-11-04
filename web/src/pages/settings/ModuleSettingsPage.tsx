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
import { tSettingsV3 } from '@/strings.settingsV3';
import { useUiStore } from '@/stores/ui';
import { tComfort } from '@/strings.comfort';
import { Badge, Button, EmptyState, Icon, SettingRow, SettingsGroup } from '@/ui';
import { FieldRow } from './ModuleSection';
import { STATUS_LOOK } from './categoryLook';
import { PageHead } from './PageHead';
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

/** The module's icon large on a tinted plate: decoration only, never a number. */
function HeadMark({ manifest }: { manifest: ModuleManifest }) {
  return (
    <span className={styles.mark}>
      <Icon name={manifest.icon} size={48} />
    </span>
  );
}

/** Module identity in the page head (identity v3): tinted head in the module's hues with its area pattern, icon plate and a large icon mark. */
function ModuleHead({
  manifest,
  changed,
  onResetAll,
}: {
  manifest: ModuleManifest;
  changed?: number;
  onResetAll?: () => void;
}) {
  const o = tSettings2.use().modulePage;
  const c = tSettings2.use().changed;
  const v3 = tSettingsV3.use();
  return (
    <PageHead
      hue={manifest.identity.hue}
      hue2={manifest.identity.hue2}
      area={manifest.area ?? 'system'}
      icon={manifest.icon}
      eyebrow={v3.modulesEyebrow}
      title={manifest.name}
      titleId={`module-${manifest.id}`}
      description={manifest.description}
      decoration={<HeadMark manifest={manifest} />}
      testId="module-settings-head"
      actions={
        <>
          {changed ? <Badge>{o.changed(changed)}</Badge> : null}
          {changed && onResetAll ? (
            <Button variant="ghost" onClick={onResetAll} data-testid="module-reset-all">
              {c.resetModule}
            </Button>
          ) : null}
          <Link to={`/library#module-${manifest.id}`} className={styles.libraryLink}>
            {o.library}
          </Link>
        </>
      }
    />
  );
}

/** The head of a module route that has no module page (unknown, off, loading): the settings title, nothing more. */
function PlainHead() {
  return (
    <PageHead
      {...STATUS_LOOK}
      icon="settings"
      eyebrow={tSettingsV3.use().modulesEyebrow}
      title={t.settings.title}
    />
  );
}

/** `/settings/module/<id>`: one module's settings in the same five blocks for every module. */
export function ModuleSettingsPage() {
  const { moduleId } = useParams();
  const states = useModuleStates();
  const o = tSettings2.use().modulePage;
  const manifest = availableManifests().find((m) => m.id === moduleId);
  // Loading or no page for this module: the layout leaves the head to this page, so it keeps the one h1.
  if (!states) return <PlainHead />;
  if (!manifest || !states[manifest.id] || !hasPage(manifest)) {
    return (
      <>
        <PlainHead />
        <EmptyState compact title={o.notFound}>
          <Link to={settingsPath('module')}>{o.all}</Link>
        </EmptyState>
      </>
    );
  }
  return <ModuleSettingsBody manifest={manifest} />;
}

function ModuleSettingsBody({ manifest }: { manifest: ModuleManifest }) {
  const o = tSettings2.use().modulePage;
  const { schema, defaults, fields } = manifest.settings;
  const [values, patch] = useSettings(`module.${manifest.id}`, schema, defaults);
  const toast = useUiStore((st) => st.toast);
  if (!values) return null;
  const v = values as Record<string, unknown>;
  const sectionId = `module-${manifest.id}`;
  const startData = hasStartData(manifest);
  const blocks = fieldBlocks(fields, startData);
  const changedList = changedKeys(fields, v, defaults);
  const changed = changedList.length;
  const resetAll = () => {
    const before = Object.fromEntries(changedList.map((k) => [k, v[k]]));
    void patch(Object.fromEntries(changedList.map((k) => [k, defaults[k]])));
    toast(tComfort.get().reset.done(manifest.name), {
      label: t.ui.undo,
      run: () => void patch(before),
    });
  };
  const rows = (list: typeof fields) =>
    list.map((f) => (
      <FieldRow
        key={f.key}
        sectionId={sectionId}
        field={f}
        value={v[f.key]}
        defaultValue={defaults[f.key]}
        onChange={(value) => void patch({ [f.key]: value })}
      />
    ));
  return (
    <section
      aria-labelledby={sectionId}
      className={styles.page}
      data-testid={`module-settings-${manifest.id}`}
    >
      <ModuleHead manifest={manifest} changed={changed} onResetAll={resetAll} />
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
    </section>
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
