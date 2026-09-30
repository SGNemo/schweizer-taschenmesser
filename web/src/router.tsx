import { Suspense, useEffect, useMemo } from 'react';
import { Navigate, useRoutes, type RouteObject } from 'react-router';
import { lazyComponent } from '@/core/modules/lazy';
import { useModuleStates, type ModuleStates } from '@/core/modules/activation';
import { visibleManifests } from '@/core/modules/registry';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { AppShell } from '@/layout/AppShell';
import { PageContainer, PageFallback } from '@/layout/PageContainer';
import { Dashboard } from '@/pages/dashboard/Dashboard';
import { ModuleLibrary } from '@/pages/ModuleLibrary';
import { NotFound } from '@/pages/NotFound';
import { Settings } from '@/pages/Settings';
import { ToolLibrary } from '@/pages/ToolLibrary';

function ModuleDisabled() {
  const toast = useUiStore((s) => s.toast);
  useEffect(() => {
    toast(t.errors.moduleDisabled);
  }, [toast]);
  return <Navigate to="/library" replace />;
}

export function buildRoutes(states: ModuleStates): RouteObject[] {
  const moduleRoutes = visibleManifests.flatMap((m) =>
    states[m.id]
      ? m.routes.map((r) => {
          const Cmp = lazyComponent(r.component);
          return {
            path: r.path.replace(/^\//, ''),
            element: (
              <PageContainer variant={r.layout ?? m.layout ?? 'content'}>
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
            <PageContainer variant="wide">
              <Dashboard />
            </PageContainer>
          ),
        },
        {
          path: 'library',
          element: (
            <PageContainer variant="wide">
              <ModuleLibrary />
            </PageContainer>
          ),
        },
        {
          path: 'tools',
          element: (
            <PageContainer variant="wide">
              <ToolLibrary />
            </PageContainer>
          ),
        },
        {
          path: 'settings',
          element: (
            <PageContainer variant="narrow">
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
