import { useContext } from 'react';
import { UNSAFE_LocationContext } from 'react-router';
import type { IconName } from '@/ui/icons';
import { availableManifests } from './available';
import type { ModuleHue, ModuleManifest, SignatureId } from './types';

/** What a dialog needs to wear a module's identity (S02): hue, icon plate and signature mark. */
export interface ModuleIdentityMark {
  hue: ModuleHue;
  hue2?: ModuleHue;
  icon: IconName;
  signature: SignatureId;
}

/** The module whose page `pathname` is (`/<id>` or below), the same match the module frame uses. */
export function moduleOfPath(pathname: string): ModuleManifest | undefined {
  return availableManifests().find(
    (m) => pathname === `/${m.id}` || pathname.startsWith(`/${m.id}/`),
  );
}

/** The identity of the module whose page is `pathname`; undefined outside module pages. */
export function identityOfPath(pathname: string): ModuleIdentityMark | undefined {
  const m = moduleOfPath(pathname);
  if (!m) return undefined;
  const { hue, hue2, signature } = m.identity;
  return { hue, hue2, icon: m.icon, signature };
}

/**
 * The identity of the module page that is showing now (by route). Safe outside a router (tests, the
 * recovery screen): then there is no module and the answer is undefined. Reads the location context
 * directly because `useLocation` throws outside a router.
 */
export function useCurrentModuleIdentity(): ModuleIdentityMark | undefined {
  const ctx = useContext(UNSAFE_LocationContext) as { location?: { pathname: string } } | null;
  const pathname = ctx?.location?.pathname;
  return pathname ? identityOfPath(pathname) : undefined;
}
