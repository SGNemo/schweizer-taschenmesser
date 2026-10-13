import { compareText } from '@/core/i18n/format';
import type { ConnectorDef } from './types';

// Connectors are discovered like modules: one folder each, `index.ts` default-exports the definition.
const found = import.meta.glob<{ default: ConnectorDef }>('../../connectors/*/index.ts', {
  eager: true,
});

export const connectors: readonly ConnectorDef[] = Object.values(found)
  .map((m) => m.default)
  .sort((a, b) => compareText(a.name, b.name));

export function getConnector(id: string): ConnectorDef | undefined {
  return connectors.find((c) => c.id === id);
}
