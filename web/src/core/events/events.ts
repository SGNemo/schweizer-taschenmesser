/**
 * Central catalogue of cross-module events. Adding an event here is the
 * "defined interface" through which modules communicate.
 */
export type DataPolicy = 'keep' | 'delete';

export interface EventMap {
  'module.enabled': { moduleId: string };
  'module.disabled': { moduleId: string; policy: DataPolicy };
}
