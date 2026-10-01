import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useNativeShare } from '@/quickCapture/nativeShare';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { OnboardingHost } from '@/core/importer/host';
import { Fab, Icon, IconButton, Toaster, Wordmark } from '@/ui';
import { CommandPalette } from './CommandPalette';
import { SetupHost } from './setup/SetupHost';
import { ToolsSheet } from './ToolsSheet';
import { PendingImports } from './PendingImports';
import { UpdateBanner } from './UpdateBanner';
import { QuickAdd } from './QuickAdd';
import { SyncBadge } from './SyncBadge';
import { MoreSheet } from './MoreSheet';
import { useModuleNavItems, type NavItem } from './useNavItems';
import styles from './AppShell.module.css';

const BOTTOM_MODULE_SLOTS = 3;

function SideLink({ item, home }: { item: NavItem; home?: boolean }) {
  return (
    <li>
      <NavLink
        to={item.to}
        className={home ? `${styles.navLink} ${styles.homeLink}` : styles.navLink}
        end={item.to === '/'}
      >
        <Icon name={item.icon} />
        {item.label}
      </NavLink>
    </li>
  );
}

export function AppShell() {
  const moduleItems = useModuleNavItems();
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);
  const openTools = useUiStore((s) => s.openTools);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useNativeShare();

  // Global shortcuts: Ctrl/Cmd+K opens the command palette, Alt+Home goes to the home screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!useUiStore.getState().paletteOpen);
      } else if (e.altKey && e.key === 'Home') {
        e.preventDefault();
        void navigate('/');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaletteOpen, navigate]);

  // PWA shortcuts: "Suchen" (`/?search=1`) opens the palette, "Schnell erfassen" the capture sheet.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('search')) {
      setPaletteOpen(true);
      void navigate(location.pathname, { replace: true });
    } else if (params.get('capture')) {
      // PWA / Android shortcut "Schnell erfassen" (`/?capture=1`).
      setQuickAddOpen(true);
      void navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on the first render of the shell
  }, []);

  // Move focus to the main region on navigation (screen readers / keyboard users).
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [location.pathname]);

  const top: NavItem = { to: '/', label: t.nav.home, icon: 'home' };
  const library: NavItem = { to: '/library', label: t.nav.library, icon: 'grid' };
  const settings: NavItem = { to: '/settings', label: t.nav.settings, icon: 'settings' };
  const bottomItems = [top, ...moduleItems.slice(0, BOTTOM_MODULE_SLOTS)];
  const overflow = [...moduleItems.slice(BOTTOM_MODULE_SLOTS), library, settings];

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        {t.nav.skipToContent}
      </a>

      <aside className={styles.sidebar}>
        <a
          className={`${styles.brand} ${styles.brandLink}`}
          href="/"
          aria-label={t.nav.homeAria}
          onClick={(e) => {
            e.preventDefault();
            void navigate('/');
          }}
        >
          <Wordmark height={44} title={t.appName} />
        </a>
        <nav aria-label={t.nav.main} className={styles.sidebarNav}>
          <ul className={styles.navList}>
            <SideLink item={top} home />
          </ul>
          <h2 className={styles.navHeading}>{t.nav.modules}</h2>
          <ul className={styles.navList}>
            {moduleItems.map((i) => (
              <SideLink key={i.to} item={i} />
            ))}
          </ul>
        </nav>
        <ul className={styles.navList}>
          <SideLink item={library} />
          <SideLink item={settings} />
        </ul>
      </aside>

      <div className={styles.col}>
        <header className={styles.topbar}>
          <Link
            to="/"
            className={`${styles.brand} ${styles.brandLink} ${styles.hideDesktop}`}
            aria-label={t.nav.homeAria}
          >
            <Wordmark height={32} title={t.appName} />
          </Link>
          <button type="button" className={styles.searchBtn} onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={18} />
            <span>{t.actions.search}</span>
            <kbd className={`${styles.kbd} ${styles.hideMobile}`}>{t.palette.hint}</kbd>
          </button>
          <IconButton label={t.tools.open} onClick={() => openTools()}>
            <Icon name="wrench" />
          </IconButton>
          <SyncBadge />
        </header>
        <UpdateBanner />
        <PendingImports />
        <main id="main" tabIndex={-1} className={styles.main}>
          <Outlet />
        </main>
      </div>

      <nav aria-label={t.nav.main} className={styles.bottom}>
        {bottomItems.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.to === '/'} className={styles.bottomLink}>
            <Icon name={i.icon} />
            {i.label}
          </NavLink>
        ))}
        <button type="button" className={styles.bottomLink} onClick={() => setMoreOpen(true)}>
          <Icon name="more" />
          {t.nav.more}
        </button>
      </nav>

      <Fab label={t.actions.quickAdd} onClick={() => setQuickAddOpen(true)} />
      <QuickAdd />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} items={overflow} />
      <CommandPalette />
      <ToolsSheet />
      <OnboardingHost />
      <SetupHost />
      <Toaster />
    </div>
  );
}
