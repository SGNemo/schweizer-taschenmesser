import { CopySchemaButton } from '@/core/dataapi/CopySchemaButton';
import { JSON_IMPORTER_ID } from '@/core/dataapi/importer';
import { importersOf } from '@/core/dataapi/onboarding';
import { useModuleStates } from '@/core/modules/activation';
import { visibleManifests } from '@/core/modules/registry';
import { getPlatform } from '@/core/platform';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';

const s = t.setup.steps.aiimport;

export const aiImportModules = (states: Readonly<Record<string, boolean>>) =>
  visibleManifests.filter(
    (m) => states[m.id] && importersOf(m).some((i) => i.id === JSON_IMPORTER_ID),
  );

/** "Schema für KI kopieren" per module. Only the format description is copied, never data. */
export default function AiImportStep(_props: SetupStepProps) {
  const states = useModuleStates();
  if (!states) return null;
  const modules = aiImportModules(states);
  if (modules.length === 0) return <p>{s.none}</p>;
  return (
    <>
      <p style={{ color: 'var(--text-muted)' }}>{s.hint}</p>
      {getPlatform().kind === 'desktop' ? <p>{s.desktop}</p> : null}
      <ul
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--space-2)' }}
      >
        {modules.map((m) => (
          <li
            key={m.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 44,
            }}
          >
            <span>{m.name}</span>
            <CopySchemaButton manifest={m} />
          </li>
        ))}
      </ul>
    </>
  );
}
