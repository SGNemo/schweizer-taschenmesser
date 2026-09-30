import { connectors } from '@/core/connectors/registry';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { ConnectorCard } from '@/pages/settings/ConnectorsSection';
import { HelpHint, patternStyles } from '@/ui';

const s = t.setup.steps.connectors;

/**
 * Shows the connectors of this build with the same card as the settings (login, client id, status).
 * Everything there is an explicit action; a login still waiting for the browser is abandoned when
 * the assistant closes (see `connectOAuth`), so nothing half-connected is left behind.
 */
export default function ConnectorsStep(_props: SetupStepProps) {
  if (connectors.length === 0) return <p>{s.none}</p>;
  return (
    <>
      <p className={patternStyles.muted}>
        {t.connectors.intro} <HelpHint text={t.help.connectors} label={t.help.label} />
      </p>
      {connectors.map((def) => (
        <section
          key={def.id}
          aria-label={def.name}
          style={{ display: 'grid', gap: 'var(--space-2)' }}
        >
          <ConnectorCard def={def} />
          <details>
            <summary>{s.scopes}</summary>
            <ul>
              {def.features.map((f) => (
                <li key={f.id}>
                  {s.scopeLine(f.label, f.scopes.length ? f.scopes.join(', ') : s.noScopes)}
                </li>
              ))}
            </ul>
            {def.authType === 'oauth-pkce' ? (
              <>
                <p>{s.testingNote}</p>
                <p>{s.stepsNote}</p>
              </>
            ) : null}
          </details>
        </section>
      ))}
    </>
  );
}
