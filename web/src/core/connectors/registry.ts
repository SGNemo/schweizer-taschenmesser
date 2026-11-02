import { compareText } from '@/core/i18n/format';
import type { ConnectorDef } from './types';

// Connectors are discovered like modules: one folder each, `index.ts` default-exports the definition.
const found = import.meta.glob<{ default: ConnectorDef }>('../../connectors/*/index.ts', {
  eager: true,
});

export const connectors: readonly ConnectorDef[] = Object.values(found)
  .map((m) => m.default)
  .sort((a, b) => compareText(a.name, b.name));

/** What the maturity filter for connectors looks at. */
export interface ConnectorMaturityContext {
  /** "In Arbeit anzeigen" (`stores/ui.ts`). */
  showPreview: boolean;
  /** The connector is connected (its status): a connected preview connector stays listed. */
  connected: boolean;
}

/**
 * The maturity rule for connectors: a `preview` connector is listed in Settings → Verbindungen
 * only while "In Arbeit anzeigen" is on or it is connected. Nothing else reads it: setup steps,
 * the home line and the focus row only ever show a connected connector.
 */
export const isVisible = (def: ConnectorDef, ctx: ConnectorMaturityContext): boolean =>
  def.maturity !== 'preview' || ctx.showPreview || ctx.connected;

export function getConnector(id: string): ConnectorDef | undefined {
  return connectors.find((c) => c.id === id);
}
