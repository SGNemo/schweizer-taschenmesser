import { useTools } from '@/core/tools/state';
import { t } from '@/strings';
import { Badge, Icon, IconButton, SettingRow, SettingsGroup, SortableList, Switch } from '@/ui';
import styles from './settings.module.css';

/** Which tools are on and their order: the same setters as the tools sheet (synced scope `tools`). */
export function ToolsSection() {
  const tools = useTools();
  if (!tools) return null;
  const s = t.settings.tools;
  return (
    <SettingsGroup id="tools" title={s.title} description={s.description}>
      <SortableList
        items={tools.all}
        getId={(tool) => tool.id}
        getLabel={(tool) => tool.name}
        onReorder={(order) => void tools.reorder(order)}
        renderItem={(tool, i, handle) => (
          <SettingRow id={`tools--${tool.id}`} label={tool.name} description={tool.description}>
            <span className={styles.row}>
              {tool.maturity === 'preview' ? <Badge>{t.settings.maturity.badge}</Badge> : null}
              {handle}
              <IconButton
                label={s.moveUp(tool.name)}
                disabled={i === 0}
                onClick={() => void tools.move(tool.id, -1)}
              >
                <Icon name="chevronUp" />
              </IconButton>
              <IconButton
                label={s.moveDown(tool.name)}
                disabled={i === tools.all.length - 1}
                onClick={() => void tools.move(tool.id, 1)}
              >
                <Icon name="chevronDown" />
              </IconButton>
              <Switch
                label={tool.name}
                labelHidden
                checked={tools.active.some((a) => a.id === tool.id)}
                onChange={(on) => void tools.setEnabled(tool.id, on)}
              />
            </span>
          </SettingRow>
        )}
      />
    </SettingsGroup>
  );
}
