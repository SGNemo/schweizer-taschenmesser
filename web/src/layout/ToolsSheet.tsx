import { createElement, lazy, Suspense, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useFocusSettings } from '@/core/settings/focus';
import { readRecentTools, recordToolUse } from '@/core/tools/recent';
import { allTools } from '@/core/tools/registry';
import { useTools } from '@/core/tools/state';
import type { ToolManifest } from '@/core/tools/types';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { Dialog, Icon, IconButton } from '@/ui';
import styles from './ToolsSheet.module.css';

/** Tool components are code-split and created once, outside of render. */
const lazyTools = new Map(allTools.map((tool) => [tool.id, lazy(tool.component)] as const));

/** The toolbar: a grid of tiles; a tile opens the tool in the same sheet. */
export function ToolsSheet() {
  const toolsOpen = useUiStore((s) => s.toolsOpen);
  const activeTool = useUiStore((s) => s.activeTool);
  const openTools = useUiStore((s) => s.openTools);
  const closeTools = useUiStore((s) => s.closeTools);
  const tools = useTools();
  const tool = useMemo(
    () => tools?.all.find((x) => x.id === activeTool && tools.active.includes(x)),
    [tools, activeTool],
  );

  const [focus] = useFocusSettings();
  const toolId = tool?.id;
  // Opening a tool counts as using it (device-local, off with "Verlauf in der Suche").
  useEffect(() => {
    if (toolId && focus.searchHistory) recordToolUse(toolId);
  }, [toolId, focus.searchHistory]);
  // Up to three tools used last, shown above the tiles once there are more than a handful.
  const recent = useMemo(() => {
    if (!toolsOpen || tool || !focus.searchHistory || (tools?.active.length ?? 0) <= 4) return [];
    const active = tools?.active ?? [];
    return readRecentTools().flatMap((id) => active.filter((x) => x.id === id));
  }, [toolsOpen, tool, tools, focus.searchHistory]);

  return (
    <Dialog
      open={toolsOpen}
      onClose={closeTools}
      title={tool ? tool.name : t.tools.title}
      size="wide"
      headerStart={
        tool ? (
          <IconButton label={t.tools.back} onClick={() => openTools(null)}>
            <Icon name="chevronLeft" />
          </IconButton>
        ) : undefined
      }
    >
      {toolsOpen ? (
        tool ? (
          <div className={styles.tool}>
            <Suspense fallback={<p role="status">…</p>}>
              <ToolBody tool={tool} />
            </Suspense>
          </div>
        ) : (
          <div className={styles.grid}>
            {recent.length > 0 ? (
              <section aria-label={tComfort.get().tools.recent}>
                <h3 className={styles.recentTitle}>{tComfort.get().tools.recent}</h3>
                <ul className={styles.tiles}>
                  {recent.map((x) => (
                    <li key={x.id}>
                      <button type="button" className={styles.tile} onClick={() => openTools(x.id)}>
                        <Icon name={x.icon} size={26} />
                        <span>{x.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <ul className={styles.tiles} aria-label={t.tools.title}>
              {(tools?.active ?? []).map((x) => (
                <li key={x.id}>
                  <button type="button" className={styles.tile} onClick={() => openTools(x.id)}>
                    <Icon name={x.icon} size={26} />
                    <span>{x.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            {tools && tools.active.length === 0 ? <p>{t.tools.none}</p> : null}
            <Link to="/tools" className={styles.manage} onClick={closeTools}>
              {t.tools.manage}
            </Link>
          </div>
        )
      ) : null}
    </Dialog>
  );
}

function ToolBody({ tool }: { tool: ToolManifest }) {
  return createElement(lazyTools.get(tool.id)!);
}
