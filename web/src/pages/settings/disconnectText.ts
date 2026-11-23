import type { ConnectorDef } from '@/core/connectors/types';
import { t } from '@/strings';

/**
 * The disconnect dialog's promise (M7, launch review 2026-11): only a service with a revoke endpoint
 * gets "Der Zugriff wird beim Dienst widerrufen"; Spotify has none, so its text says where to remove
 * the app's access instead.
 */
export function disconnectText(def: Pick<ConnectorDef, 'oauth'>): string {
  return def.oauth?.revokeUrl ? t.connectors.disconnectBody : t.connectors.disconnectBodyNoRevoke;
}
