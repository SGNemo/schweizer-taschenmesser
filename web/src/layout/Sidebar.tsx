import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { setFavourite, useStoredFavourites } from '@/core/settings/nav';
import { areaOfPath, type NavArea, type NavItem, type NavTree } from '@/core/modules/areas';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Icon, Logo, OverlayScroll, Wordmark } from '@/ui';
import { useNewChangelog } from '@/core/changelog/useNewChangelog';
import { useClockOn } from '@/core/settings/clock';
import { LogoClock } from './LogoClock';
import { NewDot } from './NewDot';
import { SupporterBadge } from './SupporterBadge';
import styles from './Sidebar.module.css';

interface Props {
  tree: NavTree;
  /** 64 px icon rail instead of the 260 px sidebar. */
  rail: boolean;
  /** The rail is forced by the viewport width, so there is nothing to expand to. */
  canExpand: boolean;
}

/**
 * The favourites as a compact bar of icon chips in the module hues (identity v3); the current module has a ring.
 * They are set with the pin on a module's row below, or in Settings → Darstellung → Favoriten.
 */
function FavouriteBar({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  return (
    <>
      <h2 className={styles.heading}>{t.nav.favourites}</h2>
      <ul className={styles.favbar}>
        {items.map((i) => (
          <li key={i.to} className={styles.fav}>
            <Link
              to={i.to}
              className={styles.favLink}
              data-hue={i.hue}
              aria-label={i.label}
              title={i.label}
              aria-current={
                pathname === i.to || pathname.startsWith(`${i.to}/`) ? 'page' : undefined
              }
            >
              <Icon name={i.icon} size={20} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** U01: the favourites' room while the setting is read, so the module list below does not move down when they come. */
function FavouritesPending() {
  return (
    <div className={styles.favPending} aria-hidden="true" data-testid="favourites-pending">
      <p className={styles.heading}>{t.nav.favourites}</p>
      <div className={styles.favbar}>
        <span className={styles.fav}>
          <span className={styles.favLink} />
        </span>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  favourite,
  shown,
}: {
  item: NavItem;
  favourite: boolean;
  /** Ids of the favourites currently shown (basis of a toggle). */
  shown: string[];
}) {
  const toast = useUiStore((s) => s.toast);
  const id = item.moduleId;
  return (
    <li className={styles.row} data-area={item.area} data-hue={item.hue}>
      <NavLink to={item.to} className={styles.link}>
        <Icon name={item.icon} />
        <span>{item.label}</span>
      </NavLink>
      {id ? (
        <button
          type="button"
          className={styles.pin}
          aria-pressed={favourite}
          aria-label={
            favourite ? t.nav.removeFavourite(item.label) : t.nav.addFavourite(item.label)
          }
          title={favourite ? t.nav.removeFavourite(item.label) : t.nav.addFavourite(item.label)}
          onClick={() => {
            void setFavourite(id, shown).then((changed) => {
              if (!changed) toast(t.nav.favouritesFull);
            });
          }}
        >
          <Icon name="pin" size={16} />
        </button>
      ) : null}
    </li>
  );
}

/**
 * Whether an area shows its modules (F06): what the user chose by hand, else open only for the area of the current
 * page – so the list fits a 1080 screen. A hand choice (opened or folded) wins over the default.
 */
export function areaOpen(id: string, active: boolean, open: string[], closed: string[]): boolean {
  if (closed.includes(id)) return false;
  return open.includes(id) || active;
}

/** One area as a quiet block (tinted in the area colour) with its modules; the head folds it. */
function AreaGroup({ area, shown, active }: { area: NavArea; shown: string[]; active: boolean }) {
  const closed = !useUiStore((s) => areaOpen(area.id, active, s.openAreas, s.closedAreas));
  const toggle = useUiStore((s) => s.toggleAreaOpen);
  const listId = `area-${area.id}`;
  return (
    <section className={styles.group} data-area={area.id}>
      <button
        type="button"
        className={styles.groupHead}
        aria-expanded={!closed}
        aria-controls={listId}
        aria-label={t.nav.toggleArea(area.label)}
        onClick={() => toggle(area.id, !closed)}
      >
        <span>{area.label}</span>
        <span className={styles.chevron} data-open={!closed}>
          <Icon name="chevronRight" size={16} />
        </span>
      </button>
      {closed ? null : (
        <ul id={listId} className={styles.list}>
          {area.items.map((i) => (
            <ItemRow
              key={i.to}
              item={i}
              favourite={i.moduleId ? shown.includes(i.moduleId) : false}
              shown={shown}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * An icon of the collapsed rail: the name is the accessible name and a tooltip drawn from it in CSS (on hover and on
 * keyboard focus, which a `title` never shows); nothing else takes width.
 */
function RailLink({
  to,
  icon,
  label,
  active,
  area,
  dot,
  first,
}: {
  to: string;
  icon: NavItem['icon'];
  label: string;
  active: boolean;
  area?: NavItem['area'];
  dot?: boolean;
  /** Home, set off from the areas below it. */
  first?: boolean;
}) {
  return (
    <li data-area={area} className={first ? styles.railFirst : undefined}>
      <Link
        to={to}
        className={styles.railLink}
        aria-current={active ? 'page' : undefined}
        aria-label={label}
      >
        <Icon name={icon} size={20} />
        {dot ? <NewDot floating /> : null}
      </Link>
    </li>
  );
}

export function Sidebar({ tree, rail, canExpand }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const setSidebar = useUiStore((s) => s.setSidebar);
  const newChanges = useNewChangelog();
  const shown = tree.favourites.flatMap((i) => (i.moduleId ? [i.moduleId] : []));
  const activeArea = areaOfPath(tree, pathname)?.id;
  const clockOn = useClockOn();
  const favouritesReady = useStoredFavourites().ready;

  const link = (
    <a
      className={rail ? `${styles.brand} ${styles.brandTile}` : styles.brand}
      href="/"
      aria-label={t.nav.homeAria}
      onClick={(e) => {
        e.preventDefault();
        void navigate('/');
      }}
    >
      {rail ? <Logo tile size="2.5rem" /> : <Wordmark height={44} title={t.appName} />}
    </a>
  );
  // The clock sits next to the home link, not in it: it opens the Uhr module (while that is on) or nothing.
  const brand = clockOn ? (
    <div className={rail ? styles.brandRail : styles.brandRow}>
      {link}
      <LogoClock variant={rail ? 'rail' : 'wide'} />
    </div>
  ) : (
    link
  );

  if (rail) {
    return (
      <>
        {brand}
        <nav aria-label={t.nav.main} className={styles.nav}>
          <ul className={styles.list}>
            <RailLink to="/" icon="home" label={t.nav.home} active={pathname === '/'} first />
            {tree.areas.map((a) => (
              <RailLink
                key={a.id}
                to={a.to}
                icon={a.icon}
                label={a.label}
                area={a.id}
                active={activeArea === a.id}
              />
            ))}
          </ul>
        </nav>
        <ul className={`${styles.list} ${styles.footer}`}>
          <RailLink
            to="/library"
            icon="grid"
            label={t.nav.library}
            active={pathname.startsWith('/library')}
          />
          <RailLink
            to="/settings"
            icon="settings"
            label={t.nav.settings}
            active={pathname.startsWith('/settings')}
            dot={newChanges}
          />
          {canExpand ? (
            <li>
              <button
                type="button"
                className={styles.railLink}
                aria-label={t.nav.expandSidebar}
                onClick={() => setSidebar('wide')}
              >
                <Icon name="panelOpen" size={20} />
              </button>
            </li>
          ) : null}
        </ul>
      </>
    );
  }

  return (
    <>
      {brand}
      <SupporterBadge placement="sidebar" />
      <nav aria-label={t.nav.main} className={styles.nav}>
        {tree.favourites.length > 0 ? (
          <FavouriteBar items={tree.favourites} />
        ) : favouritesReady ? null : (
          <FavouritesPending />
        )}
        <OverlayScroll>
          <ul className={styles.list}>
            <li className={styles.row}>
              <NavLink to="/" end className={`${styles.link} ${styles.home}`}>
                <Icon name="home" />
                <span>{t.nav.home}</span>
              </NavLink>
            </li>
          </ul>
          {tree.areas.map((a) => (
            <AreaGroup key={a.id} area={a} shown={shown} active={a.id === activeArea} />
          ))}
        </OverlayScroll>
      </nav>
      <ul className={`${styles.list} ${styles.footer}`}>
        <li className={styles.row}>
          <NavLink to="/library" className={styles.link}>
            <Icon name="grid" />
            <span>{t.nav.library}</span>
          </NavLink>
        </li>
        <li className={styles.row}>
          <NavLink to="/settings" className={styles.link}>
            <Icon name="settings" />
            <span>{t.nav.settings}</span>
            {newChanges ? <NewDot /> : null}
          </NavLink>
        </li>
        <li className={styles.row}>
          <button type="button" className={styles.link} onClick={() => setSidebar('narrow')}>
            <Icon name="panelClose" />
            <span>{t.nav.collapseSidebar}</span>
          </button>
        </li>
      </ul>
    </>
  );
}
