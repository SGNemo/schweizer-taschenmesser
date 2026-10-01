import { Suspense, useEffect, useMemo } from 'react';
import { Navigate, useRoutes, type RouteObject } from 'react-router';
import { lazyComponent } from '@/core/modules/lazy';
import { useModuleStates, type ModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { AppShell } from '@/layout/AppShell';
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

export function buildRoutes(states: ModuleStates): RouteObject[] {
  const moduleRoutes = availableManifests().flatMap((m) =>
    states[m.id]
      ? m.routes.map((r) => {
          const Cmp = lazyComponent(r.component);
          return {
            path: r.path.replace(/^\//, ''),
            element: (
              <PageContainer key={m.id} variant={r.layout ?? m.layout ?? 'content'}>
                <Suspense fallback={<PageFallback />}>
                  <Cmp />
                </Suspense>
              </PageContainer>
            ),
          } satisfies RouteObject;
        })
      : [{ path: `${m.id}/*`, element: <ModuleDisabled /> } satisfies RouteObject],
  );

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
        ...moduleRoutes,
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
