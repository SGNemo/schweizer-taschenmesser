import { useTools } from '@/core/tools/state';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { SettingsGroup, SortableList } from '@/ui';
import { ToolRow } from '../tools/ToolRow';
import styles from './settings.module.css';

/**
 * Which tools are on and their order: the same setters as the tools sheet (synced scope `tools`) and the same row
 * as on `/tools` (`ToolRow`, Identity 4.0). The list is the toolbar's order, so a row can be dragged; "Öffnen" and
 * the two moves in the "⋯" menu show only for a tool that is on.
 */
export function ToolsSection() {
  const tools = useTools();
  const openTools = useUiStore((st) => st.openTools);
  const toast = useUiStore((st) => st.toast);
  if (!tools) return null;
  const s = t.settings.tools;
  const lib = t.tools.library;
  /** One place up or down in this list; the toast says the new place in the toolbar and offers the way back. */
  const move = async (id: string, name: string, dir: -1 | 1) => {
    const before = tools.all.map((x) => x.id);
    const order = [...before];
    const a = order.indexOf(id);
    const b = a + dir;
    if (a < 0 || b < 0 || b >= order.length) return;
    [order[a], order[b]] = [order[b]!, order[a]!];
    const on = new Set(tools.active.map((x) => x.id));
    const inBar = order.filter((x) => on.has(x));
    await tools.reorder(order);
    toast(lib.moved(name, inBar.indexOf(id) + 1, inBar.length), {
      label: t.ui.undo,
      run: () => void tools.reorder(before),
    });
  };
  return (
    <SettingsGroup id="tools" title={s.title} description={s.description}>
      <SortableList
        items={tools.all}
        getId={(tool) => tool.id}
        getLabel={(tool) => tool.name}
        onReorder={(order) => void tools.reorder(order)}
        renderItem={(tool, i, handle) => (
          <div id={`tools--${tool.id}`} className={styles.toolItem}>
            <ToolRow
              tool={tool}
              on={tools.active.some((a) => a.id === tool.id)}
              switchLabel={tool.name}
              onToggle={(on) => void tools.setEnabled(tool.id, on)}
              handle={handle}
              open={{ label: lib.open(tool.name), run: () => openTools(tool.id) }}
              move={{
                up:
                  i > 0
                    ? { label: s.moveUp(tool.name), run: () => move(tool.id, tool.name, -1) }
                    : undefined,
                down:
                  i < tools.all.length - 1
                    ? { label: s.moveDown(tool.name), run: () => move(tool.id, tool.name, 1) }
                    : undefined,
              }}
            />
          </div>
        )}
      />
    </SettingsGroup>
  );
}
