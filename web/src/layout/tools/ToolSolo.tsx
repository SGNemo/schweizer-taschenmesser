import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';
import { getPlatform } from '@/core/platform';
import { Toaster } from '@/ui';
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
  // Only the browser detaches tools; the apps keep them in the panel.
  if (getPlatform().kind !== 'web') return <Navigate to={`/tools/${id ?? ''}`} replace />;
  return (
    <main className={styles.solo}>
      {tool ? (
        <ToolStage tool={tool} heading />
      ) : (
        <p>
          {t.tools.panel.soloMissing}{' '}
          {/* Opens the full app in a new tab: this window skipped the background services, the app must start normally there. */}
          <a href="/tools" target="_blank" rel="noreferrer">
            {t.tools.manage}
          </a>
        </p>
      )}
      <Toaster />
    </main>
  );
}
