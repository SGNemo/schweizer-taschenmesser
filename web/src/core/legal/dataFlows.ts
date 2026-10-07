/**
 * Every case where data leaves the device, as the app states it in Settings → Über Nemo → Rechtliches → Datenschutz.
 * The texts live in `strings.legal.ts` (`tLegal.flows`, German + English). `docs/legal/DATA-FLOWS.md` carries the same ids (pinned by
 * `dataFlows.test.ts`) and adds recipients, code references and legal-basis placeholders. Change one → change the
 * other, then the website and the README.
 */
import { tLegal } from '@/strings.legal';

export const DATA_FLOW_IDS = [
  'local',
  'sync',
  'push',
  'ics',
  'update',
  'ai-cloud',
  'ai-model',
  'google',
  'supporter',
  'currency',
  'ip',
  'links',
] as const;
export type DataFlowId = (typeof DATA_FLOW_IDS)[number];

export interface DataFlow {
  id: DataFlowId;
  title: string;
  /** What is sent, exactly. */
  what: string;
  /** Who receives it. */
  to: string;
  /** When it happens and whether it is optional. */
  when: string;
}

export const dataFlows = (l: typeof tLegal.de = tLegal.get()): DataFlow[] =>
  DATA_FLOW_IDS.map((id) => ({ id, ...l.flows[id] }));
