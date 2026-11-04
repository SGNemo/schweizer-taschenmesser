/**
 * What a module tells the automation engine (`manifest.automation`, lazy like `services`): which
 * of its collections report writes as events, which domain events it can report, which state checks
 * to run, and which of its `aiSchema.actions` rules may call. A module without this file is neither
 * a trigger nor a target; the vault never has one (`exclusion.test.ts`).
 */
import type { WriteSignal } from '@/core/db/writeHook';
import type { Detector } from './scheduler';
import type { AutomationEvent } from './types';

export type FieldType = 'text' | 'number' | 'date' | 'time' | 'boolean';

export interface AutomationEventDef {
  /** Fields the event carries (`event.data`): what conditions compare and `{field}` templates read. */
  fields: Record<string, FieldType>;
}

export interface ModuleAutomation {
  /**
   * Collections whose local writes become `<module>.<collection>.created|updated|deleted|restored`
   * events (fields: the stored fields of the entry plus `id`). Anything not listed stays silent.
   */
  watch?: Record<string, AutomationEventDef>;
  /** Domain events the module reports itself (derived from a write, or from a detector). Keys: full event type. */
  events?: Record<string, AutomationEventDef>;
  /** More events for the same write (e.g. `todos.task.completed` when `done` turns true). */
  derive?: (signal: WriteSignal, base: AutomationEvent) => AutomationEvent[];
  /** State checks the scheduler runs (at most every 10 minutes): due soon, below minimum, price changed. */
  detectors?: Detector[];
  /** Ids of this module's `aiSchema.actions` that rules may call. Never a `delete`. */
  actions?: string[];
}

export type LoadAutomation = () => Promise<{ default: ModuleAutomation }>;
