import { Suspense, type CSSProperties } from 'react';
import type { ToolManifest } from '@/core/tools/types';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button, Icon } from '@/ui';
import { ToolBody } from './lazyTools';
import { ToolPlate } from './ToolPlate';
import { ToolSignature } from './ToolSignature';
import styles from './ToolStage.module.css';

/** Where a detached tool lives (`router.tsx`), and the window features it opens with. */
export const toolWindowPath = (id: string) => `/tool/${id}`;
const WINDOW_FEATURES = 'popup,width=540,height=760';

/** Detaching opens a browser window: only where there is one (the desktop app and Android keep the panel). */
export const canDetachTool = (): boolean => getPlatform().kind === 'web';

export function detachTool(tool: ToolManifest): boolean {
  const w = window.open(toolWindowPath(tool.id), `nemo-tool-${tool.id}`, WINDOW_FEATURES);
  return w !== null;
}

interface StageProps {
  tool: ToolManifest;
  /** Panel: the dialog title already names the tool. A detached window prints it as the page's h1. */
  heading?: boolean;
  /** Set when the head may offer "In eigenem Fenster öffnen". */
  onDetach?: () => void;
}

/**
 * One tool in its own colours: a head (plate, one line what it does, the signature) on a tinted
 * surface, then the tool. Used by the panel and by the detached window.
 */
export const ToolStage = ({ tool, heading = false, onDetach }: StageProps) => (
  <section
    className={styles.stage}
    data-hue={tool.identity.hue}
    data-type={tool.identity.type ?? 'sans'}
    data-tool={tool.id}
    aria-label={tool.name}
    style={
      tool.identity.hue2
        ? ({ '--module-color-2': `var(--mod-${tool.identity.hue2})` } as CSSProperties)
        : undefined
    }
  >
    <header className={styles.head}>
      <ToolPlate tool={tool} size="lg" />
      <div className={styles.headText}>
        {heading ? <h1 className={styles.name}>{tool.name}</h1> : null}
        <p className={styles.about}>{tool.description}</p>
      </div>
      <span className={styles.signature}>
        <ToolSignature id={tool.identity.signature} size={40} />
      </span>
      {onDetach ? (
        <Button variant="ghost" size="sm" className={styles.detach} onClick={onDetach}>
          <Icon name="external" size={16} />
          {t.tools.panel.detach}
        </Button>
      ) : null}
    </header>
    <div className={styles.body}>
      <Suspense fallback={<p role="status">…</p>}>
        <ToolBody tool={tool} />
      </Suspense>
    </div>
  </section>
);
