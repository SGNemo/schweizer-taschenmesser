/**
 * The one place that mounts a module's UI inside the planner (planner hub 2, package 4a; CONCEPT-ROWS idea 4,
 * hand-off 04): a thing's plan panel under its expanded row.
 *
 *  - Lazy (`contributions.planPanel`), a two-line `Skeleton` while the code loads.
 *  - An error boundary: a panel that throws shows X7 in its own place and the sheet lives on. The diagnostics log gets
 *    the module id and the error's name only – never its message (it may carry the thing's content).
 *  - Never for `accounts`: nothing is mounted, not even the default.
 *  - Module off or not on this device: X5, no code loaded.
 *  - A module without a panel: the core default – the source's `detail`, its links, „Ganz öffnen“.
 *
 * Panels draw their foot with `PlanPanelFoot` (every action in the foot, at most three, „Ganz öffnen“ last on the right)
 * and a thing that no longer exists with `PanelGone` (X3 + X4); both read the host's context, so the panel contract stays
 * `PlanPanelProps`. The host writes nothing: opening and closing a panel is page state only.
 */
import {
  Component,
  createContext,
  createElement,
  Suspense,
  useContext,
  useMemo,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router';
import { recordEntry } from '@/core/diagnostics/errorLog';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Button, Skeleton } from '@/ui';
import { useModuleStates } from './activation';
import { availableManifests } from './available';
import { lazyComponent } from './lazy';
import type { PlanPanelProps } from './types';
import styles from './PlanPanelHost.module.css';

/** The vault never shows anything in the plan (hard rule „AI privacy“, `exclusion.test.ts`). */
const NEVER = 'accounts';

/** What the host knows of the row: the source's route and the planner's way to take the thing out of the plan. */
interface PanelContext {
  /** The thing's route in its module (`PlannableItem.to`): „Ganz öffnen“, the old jump. */
  to: string;
  /** What the row knows beyond its title (the source's `detail`, its links): the default panel's body. */
  detail?: ReactNode;
  links?: ReactNode;
  /** X4 „Aus dem Plan nehmen“ for a thing that is gone; the planner's own undoable action. */
  onTakeOut?: () => void;
}
const Ctx = createContext<PanelContext | undefined>(undefined);

/**
 * A panel's foot: the module's actions on the left (at most two; the main one `secondary`, others ghost), X2 „Ganz
 * öffnen“ always last on the right. Every action of a panel lives here, nowhere in its body.
 */
export function PlanPanelFoot({ children }: { children?: ReactNode }) {
  const ctx = useContext(Ctx);
  const navigate = useNavigate();
  return (
    <div className={styles.foot} data-panel-foot="">
      {children ? <span className={styles.footStart}>{children}</span> : null}
      {ctx ? (
        <Button variant="ghost" data-panel-open="" onClick={() => void navigate(ctx.to)}>
          {t.planner.panel.open}
        </Button>
      ) : null}
    </div>
  );
}

/** A note inside a panel: its first three lines, small, at most the reading measure (a ToDo's note). */
export function PanelNote({ children }: { children: ReactNode }) {
  return <p className={`${styles.line} ${styles.note}`}>{children}</p>;
}

/** A small head inside a panel (a list's section): caps, 600, muted. */
export function PanelHead({ children }: { children: ReactNode }) {
  return <p className={styles.head}>{children}</p>;
}

/** The thing behind the row no longer exists here: X3, and X4 takes the row out of the plan. */
export function PanelGone() {
  const ctx = useContext(Ctx);
  return (
    <>
      <p className={styles.line}>{t.planner.panel.gone}</p>
      <div className={styles.foot} data-panel-foot="">
        {ctx?.onTakeOut ? (
          <Button variant="secondary" onClick={ctx.onTakeOut}>
            {t.planner.panel.takeOut}
          </Button>
        ) : null}
      </div>
    </>
  );
}

/** X7 where he acted, `role="alert"`; what he typed stays (the panel keeps its own state). */
export function PanelError() {
  return (
    <p className={styles.line} role="alert">
      {t.planner.panel.failed}
    </p>
  );
}

/** Two quiet lines while a panel reads (no spinner). */
export function PanelLoading() {
  return (
    <div className={styles.loading} role="status" aria-label={t.ui.loading}>
      <Skeleton height="1rem" width="60%" />
      <Skeleton height="1rem" width="40%" />
    </div>
  );
}

/** Lazy components are made once per module and kind, never per render (the pattern of the home widgets). */
const panels = new Map<string, unknown>();
function panelFor<P extends object>(
  key: string,
  loader: () => Promise<{ default: ComponentType<P> }>,
): ComponentType<P> {
  let c = panels.get(key) as ComponentType<P> | undefined;
  if (!c) {
    c = lazyComponent(
      loader as unknown as () => Promise<{ default: ComponentType }>,
    ) as unknown as ComponentType<P>;
    panels.set(key, c);
  }
  return c;
}

class PanelBoundary extends Component<
  { moduleId: string; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    // The module id and the error's name only: a message may carry the thing's title or content.
    const name = error instanceof Error ? error.name : 'Error';
    recordEntry({ at: now(), source: `plan-panel-${this.props.moduleId}`, message: name });
  }

  override render() {
    return this.state.failed ? <PanelError /> : this.props.children;
  }
}

/**
 * What the row knows of the thing beyond its title – its `detail` line and its links. The default panel's body; a
 * module panel with nothing of its own to show (a ToDo without note or checklist) draws it too.
 */
export function PanelDefaultBody() {
  const ctx = useContext(Ctx);
  return (
    <>
      {ctx?.detail ? <p className={styles.line}>{ctx.detail}</p> : null}
      {ctx?.links}
    </>
  );
}

/** The default panel: the row's detail and links, and „Ganz öffnen“. */
function DefaultPanel() {
  return (
    <>
      <PanelDefaultBody />
      <PlanPanelFoot />
    </>
  );
}

export interface PlanPanelHostProps {
  moduleId: string;
  /** The row's source id (`PlannableItem.id`). */
  id: string;
  /** The thing's route in its module. */
  to: string;
  compact?: boolean;
  onDone?: () => void;
  /** X4 for a thing that is gone (the planner's own action). */
  onTakeOut?: () => void;
  /** The default panel's body: the source's `detail` line and the links as `PanelLine`s. */
  detail?: ReactNode;
  links?: ReactNode;
}

export function PlanPanelHost({
  moduleId,
  id,
  to,
  compact = false,
  onDone,
  onTakeOut,
  detail,
  links,
}: PlanPanelHostProps) {
  const states = useModuleStates();
  const manifest = availableManifests().find((m) => m.id === moduleId);
  const loader = manifest?.contributions?.planPanel;
  const ctx = useMemo(
    () => ({ to, detail, links, ...(onTakeOut ? { onTakeOut } : {}) }),
    [to, detail, links, onTakeOut],
  );
  if (moduleId === NEVER) return null;
  if (!manifest) return <p className={styles.line}>{t.planner.panel.unavailable}</p>;
  if (!states) return <PanelLoading />;
  if (!states[moduleId]) return <p className={styles.line}>{t.planner.panel.unavailable}</p>;
  // Resolved only for a module that may show here (never cached for `accounts` or a module that is off).
  const Panel = loader ? panelFor(`panel:${moduleId}`, loader) : undefined;
  return (
    <Ctx.Provider value={ctx}>
      <PanelBoundary moduleId={moduleId}>
        {Panel ? (
          <Suspense fallback={<PanelLoading />}>
            {/* The module's component, made once per module (`panelFor`), rendered by reference. */}
            {createElement<PlanPanelProps>(Panel, { id, compact, ...(onDone ? { onDone } : {}) })}
          </Suspense>
        ) : (
          <DefaultPanel />
        )}
      </PanelBoundary>
    </Ctx.Provider>
  );
}

/** One module's strip: lazy, behind the same boundary (it logs the module id and the error's name only). */
function FootStrip({
  moduleId,
  loader,
}: {
  moduleId: string;
  loader: () => Promise<{ default: ComponentType }>;
}) {
  const Strip = panelFor(`foot:${moduleId}`, loader);
  return (
    <PanelBoundary moduleId={moduleId}>
      <Suspense fallback={null}>{createElement(Strip)}</Suspense>
    </PanelBoundary>
  );
}

/**
 * The strips modules keep at the foot of the planner page (`contributions.planPageFoot`): mounted once by the page,
 * only for modules that are on and on this device, never for `accounts`. Nothing while the states load.
 */
export function PlanPageFoot() {
  const states = useModuleStates();
  if (!states) return null;
  const strips = availableManifests().flatMap((m) => {
    const loader = m.contributions?.planPageFoot;
    return loader && m.id !== NEVER && states[m.id] ? [{ id: m.id, loader }] : [];
  });
  if (strips.length === 0) return null;
  return (
    <div className={styles.pageFoot} data-plan-page-foot="">
      {strips.map((s) => (
        <FootStrip key={s.id} moduleId={s.id} loader={s.loader} />
      ))}
    </div>
  );
}
