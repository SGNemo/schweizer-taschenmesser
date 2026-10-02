import { createElement, lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router';
import { allTools } from '@/core/tools/registry';
import { useTools } from '@/core/tools/state';
import type { ToolManifest } from '@/core/tools/types';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Dialog, Icon, IconButton } from '@/ui';
import styles from './ToolsSheet.module.css';

/** Tool components are code-split and created once, outside of render. */
const lazyTools = new Map(allTools.map((tool) => [tool.id, lazy(tool.component)] as const));

/** The toolbar: a grid of tiles; a tile opens the tool in the same sheet. */
export function ToolsSheet() {
  const { toolsOpen, activeTool, openTools, closeTools } = useUiStore();
  const tools = useTools();
  const tool = useMemo(
    () => tools?.all.find((x) => x.id === activeTool && tools.active.includes(x)),
    [tools, activeTool],
  );

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
