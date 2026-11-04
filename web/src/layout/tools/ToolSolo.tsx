import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { useTools } from '@/core/tools/state';
import { t } from '@/strings';
import { ToolStage } from './ToolStage';
import styles from './ToolSolo.module.css';

/**
 * `/tool/:id`: one tool alone in a small browser window (detached from the panel). No shell, no
 * navigation; the tool keeps its colours. A tool that is off or unknown says so and links home.
 */
export function ToolSolo() {
  const { id } = useParams();
  const tools = useTools();
  const tool = tools?.active.find((x) => x.id === id);
  useEffect(() => {
    if (tool) document.title = `${tool.name} · Nemo`;
  }, [tool]);
  if (!tools) return null;
  return (
    <main className={styles.solo}>
      {tool ? (
        <ToolStage tool={tool} heading />
      ) : (
        <p>
          {t.tools.none} <Link to="/tools">{t.tools.manage}</Link>
        </p>
      )}
    </main>
  );
}
