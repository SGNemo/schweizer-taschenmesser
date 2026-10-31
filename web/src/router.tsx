import { lazy, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { Navigate, useParams, useRoutes, type RouteObject } from 'react-router';
import { lazyComponent } from '@/core/modules/lazy';
import { useModuleStates, type ModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { areaTarget, buildNavTree, type NavArea } from '@/core/modules/areas';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { AppShell } from '@/layout/AppShell';
import { ComponentSheet } from '@/layout/devTools';
import { AreaFrame } from '@/layout/AreaFrame';
import { NoReadAid } from '@/ui';
import { PageContainer, PageFallback } from '@/layout/PageContainer';
import { Home } from '@/home/Home';
import { NotFound } from '@/pages/NotFound';

import { ModuleErrorBoundary } from '@/layout/ModuleErrorBoundary';

// Pages that a start rarely needs load on first visit (still precached, so they work offline):
// keeps them off the critical path of every start (docs/perf/COLD-START-2026-10.md).
const ModuleLibrary = lazy(() =>
  import('@/pages/ModuleLibrary').then((m) => ({ default: m.ModuleLibrary })),
);
const ToolLibrary = lazy(() =>
  import('@/pages/ToolLibrary').then((m) => ({ default: m.ToolLibrary })),
);
const OAuthCallback = lazy(() =>
  import('@/pages/OAuthCallback').then((m) => ({ default: m.OAuthCallback })),
);
const ShareTarget = lazy(() =>
  import('@/pages/ShareTarget').then((m) => ({ default: m.ShareTarget })),
);
const settingsPage = () => import('@/pages/settings/SettingsLayout');
const SettingsLayout = lazy(() => settingsPage().then((m) => ({ default: m.SettingsLayout })));
const SettingsIndex = lazy(() => settingsPage().then((m) => ({ default: m.SettingsIndex })));
const CategoryPage = lazy(() => settingsPage().then((m) => ({ default: m.CategoryPage })));

const page = (node: ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>;

function ModuleDisabled() {
  const toast = useUiStore((s) => s.toast);
  useEffect(() => {
    toast(t.errors.moduleDisabled);
  }, [toast]);
  return <Navigate to="/library" replace />;
}

/** `/tools/:id` opens the tools sheet on that tool, then leaves the URL behind on the home screen. */
function ToolRoute() {
  const { id } = useParams();
  const openTools = useUiStore((s) => s.openTools);
  useEffect(() => {
    openTools(id ?? null);
  }, [id, openTools]);
  return <Navigate to="/" replace />;
}

/** Area page: no content of its own, it opens the module last used in the area. */
function AreaRedirect({ area }: { area: NavArea }) {
  return <Navigate to={areaTarget(area)} replace />;
}

/** Old paths: retired modules lead to the home screen, merged pages to their new place. */
const LEGACY_REDIRECTS: Readonly<Record<string, string>> = {
  news: '/',
  habits: '/',
  timetrack: '/',
  shopping: '/lists',
  packing: '/lists',
  launcher: '/bookmarks?view=links',
  contracts: '/vault',
  birthdays: '/people',
  gifts: '/people',
  reminders: '/calendar?tab=reminders',
  system: '/disk?tab=system',
};

/** Credential screens: the reading aid never touches them (DESIGN-SPEC §4c). */
const NO_READ_AID_MODULES: ReadonlySet<string> = new Set(['vault', 'accounts']);

export function buildRoutes(states: ModuleStates): RouteObject[] {
  const moduleRoutes = availableManifests().flatMap((m) =>
    states[m.id]
      ? m.routes.map((r) => {
          const Cmp = lazyComponent(r.component);
          return {
            path: r.path.replace(/^\//, ''),
            element: (
              <PageContainer key={m.id} variant={r.layout ?? m.layout ?? 'content'}>
                <AreaFrame>
                  <ModuleErrorBoundary manifest={m}>
                    <Suspense fallback={<PageFallback />}>
                      {NO_READ_AID_MODULES.has(m.id) ? (
                        <NoReadAid>
                          <Cmp />
                        </NoReadAid>
                      ) : (
                        <Cmp />
                      )}
                    </Suspense>
                  </ModuleErrorBoundary>
                </AreaFrame>
              </PageContainer>
            ),
          } satisfies RouteObject;
        })
      : [{ path: `${m.id}/*`, element: <ModuleDisabled /> } satisfies RouteObject],
  );

  const areaRoutes = buildNavTree(availableManifests(), states, undefined).areas.map((area) => ({
    path: area.to.replace(/^\//, ''),
    element: <AreaRedirect area={area} />,
  }));

  return [
    {
      element: <AppShell />,
      children: [
        {
          index: true,
          element: (
            <PageContainer key="Home" variant="wide">
              <Home />
            </PageContainer>
          ),
        },
        {
          path: 'library',
          element: (
            <PageContainer key="ModuleLibrary" variant="wide">
              {page(<ModuleLibrary />)}
            </PageContainer>
          ),
        },
        {
          path: 'tools',
          element: (
            <PageContainer key="ToolLibrary" variant="wide">
              {page(<ToolLibrary />)}
            </PageContainer>
          ),
        },
        { path: 'tools/:id', element: <ToolRoute /> },
        {
          path: 'oauth/callback',
          element: (
            <PageContainer key="OAuthCallback" variant="narrow">
              {page(<OAuthCallback />)}
            </PageContainer>
          ),
        },
        {
          path: 'share',
          element: (
            <PageContainer key="ShareTarget" variant="narrow">
              {page(<ShareTarget />)}
            </PageContainer>
          ),
        },
        {
          path: 'settings',
          element: (
            <PageContainer key="Settings" variant="wide">
              {page(<SettingsLayout />)}
            </PageContainer>
          ),
          children: [
            { index: true, element: page(<SettingsIndex />) },
            { path: ':category', element: page(<CategoryPage />) },
          ],
        },
        ...(ComponentSheet
          ? [
              {
                path: 'dev/components',
                element: (
                  <PageContainer key="ComponentSheet" variant="content">
                    <Suspense fallback={<PageFallback />}>
                      <ComponentSheet />
                    </Suspense>
                  </PageContainer>
                ),
              } satisfies RouteObject,
            ]
          : []),
        ...areaRoutes,
        ...moduleRoutes,
        ...Object.entries(LEGACY_REDIRECTS).flatMap(([from, to]) => [
          { path: from, element: <Navigate to={to} replace /> },
          { path: `${from}/*`, element: <Navigate to={to} replace /> },
        ]),
        {
          path: '*',
          element: (
            <PageContainer>
              <NotFound />
            </PageContainer>
          ),
        },
      ],
    },
  ];
}

export function AppRoutes() {
  const states = useModuleStates();
  const routes = useMemo(() => (states ? buildRoutes(states) : null), [states]);
  // Routes are only known once module states are loaded; avoids a redirect flash on deep links.
  const element = useRoutes(routes ?? []);
  return routes ? (
    element
  ) : (
    <p role="status" className="sr-only">
      …
    </p>
  );
}
