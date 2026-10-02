import { Suspense, useEffect, useMemo } from 'react';
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
import { PageContainer, PageFallback } from '@/layout/PageContainer';
import { Home } from '@/home/Home';
import { ModuleLibrary } from '@/pages/ModuleLibrary';
import { NotFound } from '@/pages/NotFound';
import { Settings } from '@/pages/Settings';
import { ShareTarget } from '@/pages/ShareTarget';
import { ToolLibrary } from '@/pages/ToolLibrary';

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
  system: '/disk?tab=system',
};

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
                  <Suspense fallback={<PageFallback />}>
                    <Cmp />
                  </Suspense>
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
              <ModuleLibrary />
            </PageContainer>
          ),
        },
        {
          path: 'tools',
          element: (
            <PageContainer key="ToolLibrary" variant="wide">
              <ToolLibrary />
            </PageContainer>
          ),
        },
        { path: 'tools/:id', element: <ToolRoute /> },
        {
          path: 'share',
          element: (
            <PageContainer key="ShareTarget" variant="narrow">
              <ShareTarget />
            </PageContainer>
          ),
        },
        {
          path: 'settings',
          element: (
            <PageContainer key="Settings" variant="narrow">
              <Settings />
            </PageContainer>
          ),
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
