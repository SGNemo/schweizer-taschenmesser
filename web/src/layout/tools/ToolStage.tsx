import { Suspense } from 'react';
import type { ToolManifest } from '@/core/tools/types';
import { getPlatform } from '@/core/platform';
import { toolWindowPath } from '@/core/tools/window';
import { t } from '@/strings';
import { Button, HeadSurface, Icon } from '@/ui';
import { SignatureMark } from '@/ui/identity';
import { ToolBody } from './lazyTools';
import { ToolPlate } from './ToolPlate';
import styles from './ToolStage.module.css';

const WINDOW_FEATURES = 'popup,width=540,height=760';

/** Detaching opens a browser window: only where there is one (the desktop app and Android keep the panel). */
export const canDetachTool = (): boolean => getPlatform().kind === 'web';

export function detachTool(tool: ToolManifest): boolean {
  // The opener is kept on purpose: same origin, and the return value tells whether the browser blocked the popup.
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
  <HeadSurface
    as="section"
    className={styles.stage}
    hue={tool.identity.hue}
    hue2={tool.identity.hue2}
    size="compact"
    type={tool.identity.type ?? 'sans'}
    signature={tool.identity.signature}
    aria-label={tool.name}
    tabIndex={-1}
    data={{ 'data-tool': tool.id }}
  >
    <header className={styles.head}>
      <ToolPlate tool={tool} size="lg" />
      <div className={styles.headText}>
        {heading ? <h1 className={styles.name}>{tool.name}</h1> : null}
        <p className={styles.about} title={tool.description}>
          {tool.description}
        </p>
      </div>
      <span className={styles.signature}>
        <SignatureMark id={tool.identity.signature} size={40} />
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
  </HeadSurface>
);
