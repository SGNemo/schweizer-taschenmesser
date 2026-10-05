import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { setFavourite } from '@/core/settings/nav';
import { areaOfPath, type NavArea, type NavItem, type NavTree } from '@/core/modules/areas';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Icon, Wordmark } from '@/ui';
import { SupporterBadge } from './SupporterBadge';
import styles from './Sidebar.module.css';

interface Props {
  tree: NavTree;
  /** 76 px icon rail instead of the 248 px sidebar. */
  rail: boolean;
  /** The rail is forced by the viewport width, so there is nothing to expand to. */
  canExpand: boolean;
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
    <li className={styles.row}>
      <NavLink to={item.to} className={styles.link}>
        <Icon name={item.icon} />
        <span>{item.label}</span>
      </NavLink>
      {id ? (
        <button
          type="button"
          className={styles.star}
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
          <Icon name="star" size={16} />
        </button>
      ) : null}
    </li>
  );
}

function AreaGroup({ area, shown }: { area: NavArea; shown: string[] }) {
  const closed = useUiStore((s) => s.closedAreas.includes(area.id));
  const toggle = useUiStore((s) => s.toggleAreaOpen);
  const listId = `area-${area.id}`;
  return (
    <section className={styles.group}>
      <button
        type="button"
        className={styles.groupHead}
        aria-expanded={!closed}
        aria-controls={listId}
        aria-label={t.nav.toggleArea(area.label)}
        onClick={() => toggle(area.id)}
      >
        <Icon name={area.icon} />
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

function RailLink({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: NavItem['icon'];
  label: string;
  active: boolean;
}) {
  return (
    <li>
      <Link to={to} className={styles.railLink} aria-current={active ? 'page' : undefined}>
        <Icon name={icon} size={22} />
        <span>{label}</span>
      </Link>
    </li>
  );
}

export function Sidebar({ tree, rail, canExpand }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const setSidebar = useUiStore((s) => s.setSidebar);
  const openTools = useUiStore((s) => s.openTools);
  const shown = tree.favourites.flatMap((i) => (i.moduleId ? [i.moduleId] : []));
  const activeArea = areaOfPath(tree, pathname)?.id;

  const brand = (
    <a
      className={styles.brand}
      href="/"
      aria-label={t.nav.homeAria}
      onClick={(e) => {
        e.preventDefault();
        void navigate('/');
      }}
    >
      <Wordmark height={rail ? 28 : 44} title={t.appName} />
    </a>
  );

  if (rail) {
    return (
      <>
        {brand}
        <nav aria-label={t.nav.main} className={styles.nav}>
          <ul className={styles.list}>
            <RailLink to="/" icon="home" label={t.nav.home} active={pathname === '/'} />
            {tree.areas.map((a) => (
              <RailLink
                key={a.id}
                to={a.to}
                icon={a.icon}
                label={a.label}
                active={activeArea === a.id}
              />
            ))}
          </ul>
        </nav>
        <ul className={styles.list}>
          <li>
            <button type="button" className={styles.railLink} onClick={() => openTools()}>
              <Icon name="wrench" size={22} />
              <span>{t.nav.tools}</span>
            </button>
          </li>
          <RailLink
            to="/settings"
            icon="settings"
            label={t.nav.settings}
            active={pathname.startsWith('/settings')}
          />
          {canExpand ? (
            <li>
              <button
                type="button"
                className={styles.railLink}
                aria-label={t.nav.expandSidebar}
                title={t.nav.expandSidebar}
                onClick={() => setSidebar('wide')}
              >
                <Icon name="panelOpen" size={22} />
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
        <ul className={styles.list}>
          <li className={styles.row}>
            <NavLink to="/" end className={`${styles.link} ${styles.home}`}>
              <Icon name="home" />
              <span>{t.nav.home}</span>
            </NavLink>
          </li>
        </ul>
        {tree.favourites.length > 0 ? (
          <>
            <h2 className={styles.heading}>{t.nav.favourites}</h2>
            <ul className={styles.list}>
              {tree.favourites.map((i) => (
                <ItemRow key={i.to} item={i} favourite shown={shown} />
              ))}
            </ul>
          </>
        ) : null}
        <h2 className={styles.heading}>{t.nav.areasHeading}</h2>
        {tree.areas.map((a) => (
          <AreaGroup key={a.id} area={a} shown={shown} />
        ))}
      </nav>
      <ul className={styles.list}>
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
