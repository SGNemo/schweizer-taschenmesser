import { useModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import type { IconName } from '@/ui';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  moduleId?: string;
}

/** Navigation entries of all enabled modules (only routes flagged `nav`). */
export function useModuleNavItems(): NavItem[] {
  const states = useModuleStates();
  if (!states) return [];
  return availableManifests()
    .filter((m) => states[m.id])
    .flatMap((m) =>
      m.routes
        .filter((r) => r.nav)
        .map((r) => ({
          to: r.path.replace(/\/\*$/, ''),
          label: r.label,
          icon: m.icon,
          moduleId: m.id,
        })),
    );
}
