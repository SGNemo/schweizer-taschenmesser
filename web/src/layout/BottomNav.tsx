import { Link, useLocation, useNavigate } from 'react-router';
import { areaOfPath, type NavTree } from '@/core/modules/areas';
import { availableManifests } from '@/core/modules/available';
import { usePageActionStore } from '@/core/shell/pageAction';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Icon } from '@/ui';
import styles from './BottomNav.module.css';

/** Areas shown in the bottom bar, one on each side of the plus; the rest lives in the "Mehr" sheet. */
export const BOTTOM_AREA_SLOTS = 2;

export interface PlusTarget {
  /** The text under the plus. */
  label: string;
  /** The accessible name; it always contains `label` (WCAG 2.5.3, label in name). */
  name: string;
  kind: 'page' | 'module' | 'capture';
  disabled: boolean;
  run: () => void;
}

/**
 * What the plus in the middle of the bottom bar does here (Identity 4.0, rule 4: one entry point per screen). On a
 * module page it is the module's action: the one the page declared (`PageAction`), else the module's first
 * `quickAdd` entry; everywhere else (overview, library, settings) the quick capture. A fixed name per context.
 */
export function usePlusTarget(): PlusTarget {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const action = usePageActionStore((s) => s.action);
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);
  const manifest = availableManifests().find(
    (m) => pathname === `/${m.id}` || pathname.startsWith(`/${m.id}/`),
  );
  if (manifest && action)
    return {
      label: action.short,
      name: t.nav.plusThing(action.short),
      kind: 'page',
      disabled: action.disabled,
      run: action.run,
    };
  const quick = manifest?.contributions?.quickAdd?.[0];
  if (manifest && quick)
    return {
      label: t.nav.create,
      name: t.nav.plusModule(quick.label),
      kind: 'module',
      disabled: false,
      run: () => void navigate(quick.to),
    };
  return {
    label: t.nav.create,
    name: t.nav.plusCapture,
    kind: 'capture',
    disabled: false,
    run: () => setQuickAddOpen(true),
  };
}

/** Phone: Übersicht · area 1 · plus · area 2 · Mehr (DESIGN-SPEC § 2). The plus is the screen's one filled action. */
export function BottomNav({ tree, onMore }: { tree: NavTree; onMore: () => void }) {
  const { pathname } = useLocation();
  const activeArea = areaOfPath(tree, pathname)?.id;
  const plus = usePlusTarget();
  const areas = tree.areas.slice(0, BOTTOM_AREA_SLOTS).map((a) => ({
    key: a.id,
    to: a.to,
    label: a.label,
    icon: a.icon,
    active: activeArea === a.id,
    area: a.id as string | undefined,
  }));
  const home = {
    key: 'home',
    to: '/',
    label: t.nav.home,
    icon: 'home' as const,
    active: pathname === '/',
    area: undefined as string | undefined,
  };
  const link = (i: typeof home | (typeof areas)[number]) => (
    <Link
      key={i.key}
      to={i.to}
      className={styles.link}
      data-area={i.area}
      aria-current={i.active ? 'page' : undefined}
    >
      <Icon name={i.icon} />
      <span className={styles.label}>{i.label}</span>
    </Link>
  );
  return (
    <nav aria-label={t.nav.main} className={styles.bottom} data-bottom-bar>
      {link(home)}
      {areas.slice(0, 1).map(link)}
      <button
        type="button"
        className={`${styles.link} ${styles.add}`}
        aria-label={plus.name}
        disabled={plus.disabled}
        onClick={plus.run}
        data-plus={plus.kind}
        data-testid="bottom-plus"
      >
        <span className={styles.plus} aria-hidden="true">
          <Icon name="plus" size={22} />
        </span>
        <span className={styles.label}>{plus.label}</span>
      </button>
      {areas.slice(1).map(link)}
      <button type="button" className={styles.link} onClick={onMore}>
        <Icon name="more" />
        <span className={styles.label}>{t.nav.more}</span>
      </button>
    </nav>
  );
}
