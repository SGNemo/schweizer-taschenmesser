import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useNativeShare } from '@/quickCapture/nativeShare';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { isFocusPath } from '@/core/focus/path';
import { OnboardingHost } from '@/core/importer/host';
import { isDevBuild } from '@/core/update/buildInfo';
import { areaOfPath, rememberAreaModule } from '@/core/modules/areas';
import { Fab, Toaster, useMediaQuery } from '@/ui';
import { CommandPalette } from './CommandPalette';
import { FocusWatcher } from './FocusWatcher';
import { SetupHost } from './setup/SetupHost';
import { ToolsSheet } from './ToolsSheet';
import { PendingImports } from './PendingImports';
import { UpdateBanner } from './UpdateBanner';
import { SeedBanner } from './devTools';
import { QuickAdd } from './QuickAdd';
import { ShortcutSheet } from './ShortcutSheet';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav, BOTTOM_AREA_SLOTS } from './BottomNav';
import { MoreSheet } from './MoreSheet';
import { useNavTree } from './useNavItems';
import { useShortcuts } from './useShortcuts';
import styles from './AppShell.module.css';

let devNoticeShown = false;

export function AppShell() {
  const tree = useNavTree();
  const sidebar = useUiStore((s) => s.sidebar);
  const wide = useMediaQuery('(min-width: 1200px)');
  const rail = sidebar === 'narrow' || !wide;
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);

  // Dev-Preview builds say so once per start (a module flag survives StrictMode's double effect).
  useEffect(() => {
    if (!isDevBuild() || devNoticeShown) return;
    devNoticeShown = true;
    useUiStore.getState().toast(t.devPreview.notice);
  }, []);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useNativeShare();
  useShortcuts();

  // Global shortcuts: Ctrl/Cmd+K opens the command palette, Ctrl/Cmd+. the tools, Alt+Home goes home.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!useUiStore.getState().paletteOpen);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        // Ctrl/Cmd+. toggles the tools sheet.
        e.preventDefault();
        const ui = useUiStore.getState();
        if (ui.toolsOpen) ui.closeTools();
        else ui.openTools();
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

  // The module visited last in an area is where the area page leads next time.
  useEffect(() => {
    const area = areaOfPath(tree, location.pathname);
    const item = area?.items.find(
      (i) => location.pathname === i.to || location.pathname.startsWith(`${i.to}/`),
    );
    if (area && item) rememberAreaModule(area.id, item.to);
  }, [tree, location.pathname]);

  // Move focus to the main region on navigation (screen readers / keyboard users).
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [location.pathname]);

  const overflowAreas = tree.areas.slice(BOTTOM_AREA_SLOTS);
  // A focus screen (`/<module>/focus/…`) shows one thing: no menus, no quick add, no banners.
  const focusing = isFocusPath(location.pathname);

  return (
    <div className={styles.shell} data-rail={rail} data-focus={focusing ? 'true' : undefined}>
      <a href="#main" className={styles.skip}>
        {t.nav.skipToContent}
      </a>

      {focusing ? null : (
        <aside className={styles.sidebar}>
          <Sidebar tree={tree} rail={rail} canExpand={wide} />
        </aside>
      )}

      <div className={styles.col}>
        {focusing ? null : (
          <>
            <TopBar />
            <UpdateBanner />
            <PendingImports />
            {SeedBanner ? (
              <Suspense fallback={null}>
                <SeedBanner />
              </Suspense>
            ) : null}
          </>
        )}
        <main id="main" tabIndex={-1} className={styles.main}>
          <Outlet />
        </main>
      </div>

      {focusing ? null : (
        <>
          <BottomNav tree={tree} onMore={() => setMoreOpen(true)} />
          <Fab label={t.actions.quickAdd} onClick={() => setQuickAddOpen(true)} />
          <QuickAdd />
          <ShortcutSheet />
          <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} areas={overflowAreas} />
          <CommandPalette />
          <ToolsSheet />
          <OnboardingHost />
          <SetupHost />
        </>
      )}
      <FocusWatcher />
      <Toaster />
    </div>
  );
}
