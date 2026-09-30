import { useEffect, useState } from 'react';
import { allTools } from '@/core/tools/registry';
import {
  DEFAULT_TOOLS,
  isEnabled,
  moveTool,
  orderTools,
  toolsSettingsSchema,
  TOOLS_SCOPE,
} from '@/core/tools/layout';
import { setSettings, useSettings } from '@/core/settings/settings';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { Button, Icon, patternStyles, Switch } from '@/ui';

const s = t.setup.steps.tools;

/** Tools on/off and their order as a local draft; written on "Weiter". */
export default function ToolsStep({ registerCommit }: SetupStepProps) {
  const [saved] = useSettings(TOOLS_SCOPE, toolsSettingsSchema, DEFAULT_TOOLS);
  const [draft, setDraft] = useState<typeof DEFAULT_TOOLS | undefined>();
  const [showDev, setShowDev] = useState(false);
  const values = draft ?? saved;

  useEffect(() => {
    registerCommit(draft ? () => setSettings(TOOLS_SCOPE, draft).then(() => undefined) : null);
    return () => registerCommit(null);
  }, [registerCommit, draft]);

  if (!values) return null;
  const ordered = orderTools(allTools, values);
  const shown = ordered.filter((tool) => showDev || tool.group !== 'dev');
  const ids = ordered.map((tool) => tool.id);
  return (
    <>
      <Switch label={s.showDev} checked={showDev} onChange={setShowDev} />
      <ul className={patternStyles.gridList}>
        {shown.map((tool) => (
          <li
            key={tool.id}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 44 }}
          >
            <span className={patternStyles.grow}>
              <Switch
                label={`${tool.name} (${s.groups[tool.group]})`}
                hint={tool.description}
                checked={isEnabled(tool, values)}
                onChange={(on) =>
                  setDraft({ ...values, enabled: { ...values.enabled, [tool.id]: on } })
                }
              />
            </span>
            <Button
              aria-label={s.up(tool.name)}
              onClick={() => setDraft({ ...values, order: moveTool(ids, tool.id, -1) })}
            >
              <Icon name="chevronUp" size={16} />
            </Button>
            <Button
              aria-label={s.down(tool.name)}
              onClick={() => setDraft({ ...values, order: moveTool(ids, tool.id, 1) })}
            >
              <Icon name="chevronDown" size={16} />
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}
